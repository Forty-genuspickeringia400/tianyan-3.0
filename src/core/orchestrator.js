import { config } from '../config.js';
import { EVENT_TYPES } from '../domain/task.js';
import { buildSubtaskExecutionPlan } from './subtask-queue.js';
import { buildSubtasksFromAnalysis } from './subtasks.js';
import { transitionTask } from './state-machine.js';
import { createEvent, createEvidence, createTaskCard, patchTask } from './task-factory.js';

export class Orchestrator {
  constructor(deps) {
    Object.assign(this, deps);
  }

  refreshRuntimeProfile(task, extra = {}) {
    if (!this.architectureService?.buildTaskRuntimeProfile) return task;
    const profile = this.architectureService.buildTaskRuntimeProfile(task, extra);
    task.evolution_mapping = profile.evolution_mapping;
    task.runtime_chain = profile.runtime_chain;
    task.feedback_loop = profile.feedback_loop;
    task.runtime_rhythm = profile.runtime_rhythm;
    task.reflex_profile = profile.reflex_profile;
    task.protocols = {
      ...(task.protocols || {}),
      ...(profile.protocol_versions || {}),
    };
    return task;
  }

  async createAndRun(input, context = {}) {
    const task = createTaskCard(input, context);
    this.refreshRuntimeProfile(task);
    this.taskStore.save(task);
    await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.INPUT_RECEIVED, 'system', { input }));
    return this.run(task.task_id);
  }

  async run(taskId) {
    const task = this.taskStore.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    let reflexResult = task.reflex_profile?.matched !== undefined
      ? { matched: task.reflex_profile.matched }
      : null;
    let routeSummary = task.runtime_chain?.route || [];
    this.refreshRuntimeProfile(task, { routes: routeSummary, reflex: reflexResult });

    if (task.status === 'new') {
      await this.applyAgent(task, this.sensor);
      await this.applyAgent(task, this.interpreter);
      task.workflow = this.workflowService.prepare(task);
      task.schedule = this.schedulerService.schedule(task);
      task.io = this.ioService.describe(task);
      this.refreshRuntimeProfile(task, { routes: routeSummary, reflex: reflexResult });
      await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.WORKFLOW_SCHEDULED, 'scheduler', {
        workflow: task.workflow,
        schedule: task.schedule,
      }));
      this.taskStore.save(task);
    }

    const memoryHit = this.memoryService.search(task.goal || JSON.stringify(task.input));
    if (memoryHit.records.length) {
      task.evidence.push(memoryHit.evidence);
    }
    await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.MEMORY_HIT, 'memory', { count: memoryHit.records.length }));

    task.analysis = this.processorService.analyze(task);
    task.evidence.push(createEvidence('analysis', task.analysis));
    this.refreshRuntimeProfile(task, { routes: routeSummary, reflex: reflexResult });
    this.taskStore.save(task);

    if (task.mode === 'reflex') {
      reflexResult = this.reflexMatcher.match(task);
      task.evidence.push(createEvidence('reflex', reflexResult));
      if (reflexResult.matched && task.status === 'understood') {
        task.plan = {
          summary: 'Reflex plan',
          steps: [{ step_id: 'r1', title: 'Immediate safe response', status: 'pending' }],
          deliverables: task.analysis.deliverables,
          complexity: task.analysis.complexity,
        };
        transitionTask(task, 'approved');
        this.refreshRuntimeProfile(task, { routes: routeSummary, reflex: reflexResult });
        this.taskStore.save(task);
      }
    } else {
      if (task.status === 'understood') {
        await this.applyAgent(task, this.planner);
      }
      if (task.status === 'planned' || task.status === 'understood') {
        await this.applyAgent(task, this.decider);
      }
    }

    const guard = this.guardrailService.check(task);
    if (!guard.allowed) {
      if (task.status !== 'escalated') {
        transitionTask(task, guard.requiresApproval ? 'escalated' : 'blocked');
      }
      task.next_action = guard.reason;
      task.evidence.push(createEvidence('guardrail', guard));
      this.refreshRuntimeProfile(task, { routes: routeSummary, reflex: reflexResult });
      await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.RISK_FLAGGED, 'guardrail', guard));
      this.taskStore.save(task);
      return task;
    }

    if (task.status === 'approved' || task.status === 'retrying' || task.status === 'executing') {
      if (task.status === 'approved' || task.status === 'retrying') {
        transitionTask(task, 'executing');
      }
      this.taskStore.save(task);

      const routes = this.routerService.route(task);
      routeSummary = routes;
      this.refreshRuntimeProfile(task, { routes, reflex: reflexResult });
      await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.TASK_ROUTED, 'router', { routes }));

      if (task.mode === 'federated' && !task.delegation) {
        task.federated_boundary = this.federatedMemoryBoundary.resolve(task);
        task.delegation = this.delegationManager.createPlan(
          task,
          task.analysis,
          this.agentRegistry.list(),
          task.federated_boundary,
        );
        await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.DELEGATION_CREATED, 'delegation-manager', {
          assignments: task.delegation.assignments.length,
        }));
      }

      if (!Array.isArray(task.subtasks) || !task.subtasks.length) {
        const subtasks = buildSubtasksFromAnalysis(task, task.analysis);
        for (const subtask of subtasks) {
          this.refreshRuntimeProfile(subtask);
          this.taskStore.save(subtask);
          await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.AGENT_SPAWNED, 'subtask-builder', {
            subtask_id: subtask.task_id,
            deliverable: subtask.deliverable,
            dependencies: subtask.dependencies,
          }));
        }
        task.subtasks = subtasks.map((item) => item.task_id);
      }

      task.subtask_queue = buildSubtaskExecutionPlan(task, this.taskStore.list());
      this.refreshRuntimeProfile(task, { routes, reflex: reflexResult });
      this.taskStore.save(task);

      const adapters = this.toolRegistry.select(task, task.analysis);
      await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.TOOL_CALLED, 'executor', { adapters: adapters.map((tool) => tool.name) }));
      const execution = await this.executorService.execute(task, { analysis: task.analysis, tools: adapters });
      task.result = {
        summary: 'Execution completed successfully.',
        output: execution.output,
        success: execution.success,
      };
      if (execution.plan) task.plan = execution.plan;
      if (execution.evidence?.length) task.evidence.push(...execution.evidence);
      await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.TOOL_FINISHED, 'executor', execution.output));

      const shouldAutoRunSubtasks =
        config.autoRunSubtasks &&
        task.analysis?.should_split &&
        task.depth < config.maxSubtaskDepth &&
        task.context?.autoRunSubtasks !== false;

      let subtaskResults = [];
      if (shouldAutoRunSubtasks && task.subtasks?.length) {
        subtaskResults = await this.runSubtasks(task.task_id);
        task.result.output.subtask_results = subtaskResults;
        task.subtask_queue = buildSubtaskExecutionPlan(task, this.taskStore.list());
      }

      if (task.mode === 'background') {
        task.result.output.dream_cycle = this.evolutionService.runDreamCycle(task);
        await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.DREAM_COMPLETED, 'evolution', {
          run_id: task.result.output.dream_cycle.run_id,
        }));
      }

      if (task.mode === 'federated') {
        task.result.output.federation = this.delegationManager.aggregate(task, subtaskResults);
      }

      this.refreshRuntimeProfile(task, { routes, reflex: reflexResult });
      transitionTask(task, execution.success ? 'verifying' : 'failed');
      this.taskStore.save(task);
    }

    if (task.status === 'verifying') {
      await this.applyAgent(task, this.verifier);
      if (!task.verification?.passed) {
        transitionTask(task, 'failed');
        task.next_action = 'inspect verification failure or retry';
        this.refreshRuntimeProfile(task, { routes: routeSummary, reflex: reflexResult });
        this.taskStore.save(task);
        return task;
      }

      await this.applyAgent(task, this.responder);
      await this.applyAgent(task, this.reflector);
      task.insight = this.insightService.summarize(task);
      task.cleanup_report = this.cleanerService.compact(task);
      task.deployment = this.deployerService.summarize(task);
      if (this.metaCore.policy.requireVerificationBeforeDone) {
        transitionTask(task, 'closed');
        await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.TASK_CLOSED, 'system', {}));
      }
      this.memoryService.learn(task, task.reflection || {});
      this.evolutionService.captureTaskOutcome(task);
      this.refreshRuntimeProfile(task, { routes: routeSummary, reflex: reflexResult });
      this.taskStore.save(task);
    }

    return task;
  }

  async runSubtasks(taskId) {
    const task = this.taskStore.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const childTasks = this.taskStore
      .list()
      .filter((item) => item.parent_task_id === task.task_id)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    const plan = buildSubtaskExecutionPlan(task, this.taskStore.list());
    const results = [];

    if (plan.status === 'blocked') {
      task.subtask_queue = plan;
      this.refreshRuntimeProfile(task, { routes: task.runtime_chain?.route || [] });
      this.taskStore.save(task);
      return results;
    }

    for (const wave of plan.waves) {
      for (const readyTask of wave.ready) {
        const child = childTasks.find((item) => item.task_id === readyTask.task_id);
        if (!child) continue;
        const ran = await this.run(child.task_id);
        results.push({
          task_id: ran.task_id,
          goal: ran.goal,
          status: ran.status,
          deliverable: ran.deliverable || null,
          artifacts: ran.result?.output?.artifacts || [],
          dependencies: ran.dependencies || [],
          wave: wave.index,
        });
        await this.eventBus.publish(createEvent(task.task_id, EVENT_TYPES.AGENT_COMPLETED, 'subtask-runner', {
          subtask_id: ran.task_id,
          status: ran.status,
          wave: wave.index,
        }));
      }
    }

    task.subtask_queue = buildSubtaskExecutionPlan(task, this.taskStore.list());
    this.refreshRuntimeProfile(task, { routes: task.runtime_chain?.route || [] });
    this.taskStore.save(task);
    return results;
  }

  async approve(taskId) {
    const task = this.taskStore.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    task.context = { ...(task.context || {}), approved: true };
    if (task.status === 'escalated' || task.status === 'blocked') {
      transitionTask(task, 'approved');
    }
    this.refreshRuntimeProfile(task, { routes: task.runtime_chain?.route || [] });
    this.taskStore.save(task);
    return this.run(taskId);
  }

  async retry(taskId) {
    const task = this.taskStore.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status === 'failed' || task.status === 'blocked' || task.status === 'escalated') {
      transitionTask(task, 'retrying');
      this.refreshRuntimeProfile(task, { routes: task.runtime_chain?.route || [] });
      this.taskStore.save(task);
    }
    return this.run(taskId);
  }

  async applyAgent(task, agent) {
    const output = await agent.run({
      task_card: task,
      context_slice: task.context,
      memory_slice: [],
      policy_slice: this.metaCore.policy,
    });
    patchTask(task, output);
    this.refreshRuntimeProfile(task, { routes: task.runtime_chain?.route || [] });
    if (output.events?.length) {
      for (const event of output.events) {
        await this.eventBus.publish(event);
      }
    }
    this.taskStore.save(task);
    return task;
  }
}
