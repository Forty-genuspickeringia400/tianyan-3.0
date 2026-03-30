import { createEvidence } from '../core/task-factory.js';

export class ExecutorService {
  constructor(adapterRuntime) {
    this.adapterRuntime = adapterRuntime;
  }

  async execute(task, runtime = {}) {
    const adapters = runtime.tools || [];
    const analysis = runtime.analysis || {};
    const steps = (task.plan?.steps || []).map((step) => ({ ...step, status: 'done' }));

    const adapter_outputs = [];
    for (const adapter of adapters) {
      const prepared = adapter.run(task, analysis);
      const action_results = [];
      for (const action of prepared.actions || []) {
        const result = await this.adapterRuntime.execute(action, {
          task,
          analysis,
          cwd: runtime.cwd,
        });
        action_results.push(result);
      }
      adapter_outputs.push({
        ...prepared,
        action_results,
      });
    }

    const artifacts = adapter_outputs.map((item) => item.artifact).filter(Boolean);
    const action_results = adapter_outputs.flatMap((item) => item.action_results || []);

    const output = {
      completed_steps: steps.length,
      artifacts: artifacts.map((artifact) => artifact.type),
      artifact_details: artifacts,
      execution_mode: task.mode,
      note: task.context?.approved
        ? 'Executed with approval where required.'
        : 'Executed under current safety policy.',
      keywords: analysis.keywords || [],
      adapter_outputs,
      action_results,
      subtasks_created: Array.isArray(task.subtasks) ? task.subtasks.length : 0,
      runtime_summary: {
        total_actions: action_results.length,
        successful_actions: action_results.filter((item) => item.success).length,
        failed_actions: action_results.filter((item) => !item.success).length,
      },
    };

    return {
      success: action_results.every((item) => item.success),
      output,
      evidence: [
        createEvidence('tool_output', output),
        createEvidence('execution-adapters', adapter_outputs),
        createEvidence('adapter-runtime', output.runtime_summary),
      ],
      plan: task.plan ? { ...task.plan, steps } : null,
    };
  }
}
