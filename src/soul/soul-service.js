function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function overlapScore(a, b) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 1;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.max(left.size, 1);
}

function statusFromScore(score) {
  if (score >= 0.72) return 'aligned';
  if (score >= 0.45) return 'partial';
  return 'drifting';
}

export class SoulService {
  constructor({ metaCore, memoryService, evolutionService }) {
    this.metaCore = metaCore;
    this.memoryService = memoryService;
    this.evolutionService = evolutionService;
  }

  buildMissionAlignment(goals = []) {
    const missionText = [
      this.metaCore.mission.current,
      ...(this.metaCore.mission.successCriteria || []),
    ].join(' ');
    const samples = goals.length ? goals : [this.metaCore.mission.current];
    const score = samples.reduce((sum, goal) => sum + overlapScore(goal, missionText), 0) / samples.length;
    const normalized = Number((score * 100).toFixed(1));
    return {
      score: normalized,
      status: statusFromScore(score),
      summary: score >= 0.72
        ? '当前任务与使命主线保持一致。'
        : score >= 0.45
          ? '当前任务部分命中主线，建议继续压向可审计/可交付目标。'
          : '检测到与使命主线存在漂移，需重新对齐到可观察、可回滚的主线。',
    };
  }

  buildThreeSouls({ tasks = [] } = {}) {
    const memoryRecords = this.memoryService.memoryStore?.list?.() || [];
    const plannedTasks = tasks.filter((task) => Boolean(task.plan));
    const reflectiveTasks = tasks.filter((task) => Boolean(task.reflection));

    return [
      {
        id: 'main-soul',
        chinese_name: '主魂',
        engineering_name: '核心意识 / Core Consciousness',
        mapped_to: ['metaCore.mission', 'metaCore.policy', 'metaCore.persona'],
        status: 'active',
        signals: [
          `mission=${this.metaCore.mission.current ? 'loaded' : 'missing'}`,
          `policy_rules=${(this.metaCore.policy.blockedWithoutApproval || []).length}`,
        ],
        summary: '主魂固定负责使命、策略边界、人格核与完成定义。',
      },
      {
        id: 'awareness-soul',
        chinese_name: '觉魂',
        engineering_name: '推理规划 / Reasoning & Planning',
        mapped_to: ['PlannerAgent', 'DeciderAgent', 'RouterService'],
        status: plannedTasks.length ? 'active' : 'warming',
        signals: [
          `planned_tasks=${plannedTasks.length}`,
          `reflections=${reflectiveTasks.length}`,
        ],
        summary: '觉魂把输入压成计划、决策、路线与工作流，不等于失控自治。',
      },
      {
        id: 'essence-soul',
        chinese_name: '精魂',
        engineering_name: '偏好记忆 / Preference Memory',
        mapped_to: ['metaCore.preferences', 'MemoryService', 'MemoryStore'],
        status: memoryRecords.length ? 'active' : 'warming',
        signals: [
          `preferences=${Object.keys(this.metaCore.preferences || {}).length}`,
          `memory_records=${memoryRecords.length}`,
        ],
        summary: '精魂负责偏好、记忆与复用经验，是真实映射到 preference + memory 的正式子能力。',
      },
    ];
  }

  buildAwakeningStatus({ tasks = [], backgroundRuns = [] } = {}) {
    const governance = this.evolutionService.getGovernanceReport({ tasks, backgroundRuns });
    const recentGoals = tasks.slice(0, 6).map((task) => task.goal || String(task.input || ''));
    const missionAlignment = this.buildMissionAlignment(recentGoals);
    const activeModes = [...new Set(tasks.map((task) => task.mode).filter(Boolean))];
    const escalatedTasks = tasks.filter((task) => task.status === 'escalated').length;
    const failedTasks = tasks.filter((task) => task.status === 'failed' || task.status === 'blocked').length;

    return {
      subsystem: 'L0.5 Spiritual Awakening / 灵性觉醒子系统',
      mapped_layers: ['L0', 'L1', 'L5'],
      mission_alignment: missionAlignment,
      self_model: {
        active_modes: activeModes,
        total_tasks: tasks.length,
        escalated_tasks: escalatedTasks,
        failed_or_blocked_tasks: failedTasks,
        background_runs: backgroundRuns.length,
        summary: tasks.length
          ? `当前 self-model 观察到 ${tasks.length} 条任务、${activeModes.length || 0} 个活动模式。`
          : '当前尚无任务，self-model 处于待激活观察态。',
      },
      evolution_impulse_constraints: [
        {
          source: 'verified_task_reflection',
          allowed: true,
          reason: '允许把已验证任务的反思沉淀成 candidate capsule。',
        },
        {
          source: 'background_dream_replay',
          allowed: true,
          reason: '允许在 dream cycle 中提炼经验、生成建议，但不自动 apply。',
        },
        {
          source: 'system_boundary_mutation',
          allowed: false,
          reason: '禁止自发修改系统提示、工具策略、权限边界。',
        },
      ],
      growth_stage: governance.stage,
      summary: `觉醒状态=${missionAlignment.status}；成长阶段=${governance.stage.label}。`,
    };
  }

  getHomeReport({ tasks = [], backgroundRuns = [] } = {}) {
    return {
      awakening: this.buildAwakeningStatus({ tasks, backgroundRuns }),
      three_souls: this.buildThreeSouls({ tasks }),
    };
  }

  getTaskReport(task, { allTasks = [], backgroundRuns = [] } = {}) {
    const relatedTasks = [task, ...allTasks.filter((item) => item.parent_task_id === task.task_id)];
    return {
      awakening: this.buildAwakeningStatus({ tasks: relatedTasks, backgroundRuns }),
      three_souls: this.buildThreeSouls({ tasks: relatedTasks }).map((item) => ({
        ...item,
        task_relevance: item.id === 'awareness-soul'
          ? task.plan ? 'high' : 'medium'
          : item.id === 'essence-soul'
            ? (task.evidence || []).some((evi) => evi.type === 'memory') ? 'high' : 'medium'
            : 'high',
      })),
    };
  }
}
