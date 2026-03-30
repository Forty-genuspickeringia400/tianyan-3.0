import { makeId, nowIso } from '../utils/id.js';

function takeNewest(tasks = [], limit = 8) {
  return tasks
    .slice()
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))
    .slice(0, limit);
}

function sanitizeTitle(goal = '') {
  return String(goal || 'unnamed evolution').trim().slice(0, 72) || 'unnamed evolution';
}

function mapRisk(task) {
  if (task.status === 'escalated' || task.risk_level === 'high') return 'high';
  if (task.mode === 'federated' || task.mode === 'background') return 'medium';
  return 'low';
}

function decideCapsuleKind(task) {
  if (task.mode === 'background') return 'strategy';
  if ((task.analysis?.deliverables || []).length >= 3) return 'capability';
  return 'workflow';
}

function buildLearningCapsule(task, record) {
  return {
    capsule_id: `capsule-${task.task_id}`,
    source_task_id: task.task_id,
    mode: task.mode,
    goal: task.goal,
    memory_id: record.memory_id,
    lesson: task.reflection?.summary || task.insight?.summary || task.result?.summary || 'Closed task captured for future reuse.',
    verification_passed: Boolean(task.verification?.passed),
  };
}

export class EvolutionService {
  constructor({ taskStore, memoryService, backgroundRunStore, capsuleStore, recordStore, metaCore }) {
    this.taskStore = taskStore;
    this.memoryService = memoryService;
    this.backgroundRunStore = backgroundRunStore;
    this.capsuleStore = capsuleStore;
    this.recordStore = recordStore;
    this.metaCore = metaCore;
  }

  listCapsules() {
    return this.capsuleStore.list().slice().sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
  }

  listRecords() {
    return this.recordStore.list().slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  buildTaskCapsule(task, { sourceRunId = null } = {}) {
    const requiresApproval = mapRisk(task) === 'high';
    const targetLayers = ['L5'];
    if (task.mode === 'federated') targetLayers.push('L6');
    if ((task.evidence || []).some((item) => item.type === 'memory')) targetLayers.push('L3');
    if (task.plan) targetLayers.push('L1');

    return {
      capsule_id: makeId('capsule'),
      capsule_key: `task:${task.task_id}`,
      version: 'v1',
      title: `${task.mode} · ${sanitizeTitle(task.goal)}`,
      kind: decideCapsuleKind(task),
      lifecycle_state: 'candidate',
      review_status: requiresApproval ? 'approval-required' : 'awaiting-review',
      risk_level: mapRisk(task),
      source_task_id: task.task_id,
      source_run_id: sourceRunId,
      source_mode: task.mode,
      proposal: {
        summary: task.reflection?.lessons?.[0] || task.insight?.summary || task.result?.summary || '从已完成任务沉淀可复用策略。',
        expected_benefit: task.verification?.passed
          ? '复用已验证链路，降低重复构建成本。'
          : '保留失败/风险经验，避免再次踩坑。',
        guardrails: [
          '只输出 candidate capsule，不自动放开安全边界。',
          '高风险 apply / rollback 必须 approved=true。',
          '所有状态变化写入 evolution records。',
        ],
      },
      mappings: {
        target_layers: [...new Set(targetLayers)],
        target_services: [
          task.plan ? 'PlannerAgent' : null,
          (task.evidence || []).some((item) => item.type === 'memory') ? 'MemoryService' : null,
          task.mode === 'background' ? 'EvolutionService' : null,
        ].filter(Boolean),
        chinese_concept: '自我进化 capsule',
      },
      controls: {
        auto_apply: false,
        requires_approval: requiresApproval,
        verification_required: true,
        rollback_supported: true,
        blocked_actions: [
          'system-prompt-mutation',
          'tool-policy-change',
          'permission-boundary-change',
          'unsupervised-network-expansion',
        ],
      },
      created_at: nowIso(),
      updated_at: nowIso(),
    };
  }

  captureTaskOutcome(task, { sourceRunId = null } = {}) {
    if (!task || !['closed', 'failed', 'blocked', 'escalated'].includes(task.status)) return null;
    const existing = this.capsuleStore.findByKey(`task:${task.task_id}`);
    if (existing) return existing;

    const capsule = this.buildTaskCapsule(task, { sourceRunId });
    this.capsuleStore.save(capsule);
    this.recordStore.save({
      record_id: makeId('evo-record'),
      capsule_id: capsule.capsule_id,
      action: 'suggested',
      from_state: 'new',
      to_state: capsule.lifecycle_state,
      reason: `从任务 ${task.task_id} 沉淀出 candidate capsule。`,
      approved: false,
      reviewer: 'task-closure',
      source_task_id: task.task_id,
      source_run_id: sourceRunId,
      created_at: nowIso(),
    });
    return capsule;
  }

  reviewCapsule(capsuleId, { decision = 'review', reason = '', approved = false, reviewer = 'api' } = {}) {
    const capsule = this.capsuleStore.get(capsuleId);
    if (!capsule) {
      throw new Error(`Capsule not found: ${capsuleId}`);
    }

    const normalized = String(decision || 'review').toLowerCase();
    const highRisk = capsule.controls?.requires_approval || capsule.risk_level === 'high';
    if (['apply', 'rollback'].includes(normalized) && highRisk && !approved) {
      throw new Error('High-risk evolution decisions require approved=true.');
    }

    const nextState = normalized === 'apply'
      ? 'applied'
      : normalized === 'shelve'
        ? 'shelved'
        : normalized === 'rollback'
          ? 'rolled-back'
          : 'reviewed';

    const reviewStatus = normalized === 'apply'
      ? 'approved'
      : normalized === 'shelve'
        ? 'shelved'
        : normalized === 'rollback'
          ? 'rolled-back'
          : 'review-ready';

    const updated = {
      ...capsule,
      lifecycle_state: nextState,
      review_status: reviewStatus,
      updated_at: nowIso(),
      last_decision: {
        decision: normalized,
        approved,
        reviewer,
        reason: reason || `evolution decision: ${normalized}`,
        at: nowIso(),
      },
    };

    this.capsuleStore.save(updated);
    const record = this.recordStore.save({
      record_id: makeId('evo-record'),
      capsule_id: updated.capsule_id,
      action: normalized === 'rollback' ? 'rolled_back' : normalized,
      from_state: capsule.lifecycle_state,
      to_state: updated.lifecycle_state,
      reason: reason || `evolution decision: ${normalized}`,
      approved: Boolean(approved),
      reviewer,
      source_task_id: capsule.source_task_id,
      source_run_id: capsule.source_run_id,
      created_at: nowIso(),
    });

    return { capsule: updated, record };
  }

  resolveStage({ tasks = [], capsules = [], records = [] } = {}) {
    const closedTasks = tasks.filter((task) => task.status === 'closed').length;
    const applied = capsules.filter((item) => item.lifecycle_state === 'applied').length;
    const candidates = capsules.filter((item) => ['candidate', 'reviewed'].includes(item.lifecycle_state)).length;
    const rolledBack = capsules.filter((item) => item.lifecycle_state === 'rolled-back').length;
    const latestRecord = records[0] || null;

    if (rolledBack && !applied) {
      return {
        id: 'frozen',
        label: '冻结',
        reason: '最近存在回滚且尚未重新通过受控启用。',
      };
    }
    if (candidates) {
      return {
        id: 'candidate',
        label: '候选',
        reason: '当前存在待审核或待决策的 capsule。',
      };
    }
    if (applied >= 1 && closedTasks >= 3) {
      return {
        id: 'mature',
        label: '成熟',
        reason: '已有受控启用的 capsule，且关闭任务积累达到稳定阈值。',
      };
    }
    if (closedTasks >= 1 || latestRecord) {
      return {
        id: 'growth',
        label: '成长',
        reason: '已经开始沉淀经验与记录，但仍以候选孵化为主。',
      };
    }
    return {
      id: 'seed',
      label: '萌芽',
      reason: '演化链路已建立，等待第一批真实任务与学习记录。',
    };
  }

  getGovernanceReport({ tasks = [], backgroundRuns = [], installRecords = [] } = {}) {
    const capsules = this.listCapsules();
    const records = this.listRecords();
    const stage = this.resolveStage({ tasks, capsules, records });
    const latestCapsule = capsules[0] || null;
    const latestRecord = records[0] || null;

    return {
      stage,
      summary: {
        total_capsules: capsules.length,
        candidate_capsules: capsules.filter((item) => ['candidate', 'reviewed'].includes(item.lifecycle_state)).length,
        applied_capsules: capsules.filter((item) => item.lifecycle_state === 'applied').length,
        shelved_capsules: capsules.filter((item) => item.lifecycle_state === 'shelved').length,
        rolled_back_capsules: capsules.filter((item) => item.lifecycle_state === 'rolled-back').length,
        background_runs: backgroundRuns.length,
        install_records: installRecords.length,
      },
      pipeline: {
        stages: ['suggested', 'reviewed', 'applied', 'shelved', 'rolled-back'],
        approvals: '高风险 apply / rollback 必须 approved=true。',
        verification: '所有启用动作都要求 verification_required=true。',
        audit_trail: {
          total_records: records.length,
          latest_record: latestRecord,
        },
      },
      latest_capsule: latestCapsule,
      latest_suggestion: latestCapsule
        ? {
            capsule_id: latestCapsule.capsule_id,
            title: latestCapsule.title,
            status: latestCapsule.lifecycle_state,
            review_status: latestCapsule.review_status,
            summary: latestCapsule.proposal?.summary || '',
          }
        : null,
      boundaries: [
        '不会自动修改系统提示、工具策略、权限边界。',
        '不会绕过 approval / verification / audit trail。',
        '不会把 dream cycle 伪装成失控自治。',
      ],
      capsules: capsules.slice(0, 8),
      records: records.slice(0, 12),
    };
  }

  getTaskReport(task, { tasks = [], backgroundRuns = [], installRecords = [] } = {}) {
    const governance = this.getGovernanceReport({ tasks, backgroundRuns, installRecords });
    const taskCapsules = this.listCapsules().filter((item) => item.source_task_id === task.task_id);
    const taskRecords = this.listRecords().filter((item) => item.source_task_id === task.task_id);

    return {
      stage: governance.stage,
      task_capsules: taskCapsules,
      task_records: taskRecords,
      latest_capsule: taskCapsules[0] || null,
      governance_summary: governance.summary,
      boundaries: governance.boundaries,
    };
  }

  runDreamCycle(triggerTask = null) {
    const runId = makeId('dream');
    const closedTasks = this.taskStore.list().filter((task) => task.status === 'closed');
    const sample = takeNewest(closedTasks, 8);
    const learned = sample.map((task) => {
      const record = this.memoryService.learn(task, {
        learned_from: task.task_id,
        reflection: task.reflection,
        verification: task.verification,
        lifecycle: task.status,
      });
      return buildLearningCapsule(task, record);
    });

    const evolutionCapsules = sample
      .map((task) => this.captureTaskOutcome(task, { sourceRunId: runId }))
      .filter(Boolean)
      .map((capsule) => ({
        capsule_id: capsule.capsule_id,
        title: capsule.title,
        lifecycle_state: capsule.lifecycle_state,
        review_status: capsule.review_status,
      }));

    const modeMix = sample.reduce((acc, task) => {
      acc[task.mode] = (acc[task.mode] || 0) + 1;
      return acc;
    }, {});
    const deliverables = [...new Set(sample.flatMap((task) => task.analysis?.deliverables || []))];

    const run = {
      run_id: runId,
      type: 'dream-cycle',
      trigger_task_id: triggerTask?.task_id || null,
      consolidator: {
        scanned_tasks: closedTasks.length,
        selected_tasks: sample.map((task) => ({
          task_id: task.task_id,
          mode: task.mode,
          goal: task.goal,
          verification_passed: Boolean(task.verification?.passed),
        })),
        rationale: sample.length
          ? '优先抽取最近关闭且已形成产出/反思的任务。'
          : '当前没有关闭任务，dream cycle 仅记录空转结果。',
      },
      learner: {
        learned_count: learned.length,
        capsules: learned,
        mode_mix: modeMix,
      },
      simulator: {
        scenarios: sample.slice(0, 4).map((task, index) => ({
          scenario_id: `sim-${index + 1}`,
          title: `replay-${task.task_id}`,
          objective: `验证 ${task.mode} 模式在相似任务上是否仍保持可交付性。`,
          source_task_id: task.task_id,
        })),
      },
      optimizer: {
        recommendations: [
          '高风险任务继续保持审批后再执行，避免把 guardrail 弱化成提示。',
          '把 skill-pack 任务优先跑 deliberate / federated，可同时验证交付链与多任务编排。',
          'Dream cycle 只生成 candidate capsule，不自动 apply。',
        ],
        focus_deliverables: deliverables.slice(0, 8),
      },
      governance: {
        generated_capsules: evolutionCapsules,
        stage: this.resolveStage({ tasks: this.taskStore.list(), capsules: this.listCapsules(), records: this.listRecords() }),
      },
      lifecycle: {
        stage_order: ['consolidator', 'learner', 'simulator', 'optimizer', 'governance-review', 'lifecycle-manager'],
        status: 'completed',
        updated_at: nowIso(),
      },
      created_at: nowIso(),
    };

    return this.backgroundRunStore.save(run);
  }

  getSummary() {
    const runs = this.backgroundRunStore.list().slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const latest = runs[0] || null;
    const governance = this.getGovernanceReport({ tasks: this.taskStore.list(), backgroundRuns: runs });
    return {
      total_runs: runs.length,
      latest_run_id: latest?.run_id || null,
      latest_status: latest?.lifecycle?.status || null,
      latest_learned_count: latest?.learner?.learned_count || 0,
      latest_recommendations: latest?.optimizer?.recommendations || [],
      stage: governance.stage,
      latest_capsule: governance.latest_capsule,
    };
  }
}
