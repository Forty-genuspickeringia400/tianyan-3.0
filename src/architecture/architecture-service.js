import {
  BALANCE_LAWS,
  EVOLUTION_MAP,
  EXPLICITLY_PARKED,
  MODE_RUNTIME_MAP,
  ORGAN_ROLE_MAP,
  PROTOCOL_CALIBRATION,
  ROLE_STAFFING,
} from './evolution-spec.js';

const LIFECYCLE_ALLOWED = ['new', 'understood', 'planned', 'approved', 'executing', 'verifying', 'responding', 'closed', 'blocked', 'retrying', 'escalated', 'failed'];
const LAYER_ORDER = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

const BASE_LAYERS = [
  {
    id: 'L0',
    title: 'Meta Core',
    modules: ['Mission', 'Policy', 'Persona', 'Preference Memory'],
    summary: 'Global mission, policy, persona, and preferences.',
    release_gate: 'mission-and-policy-visible',
  },
  {
    id: 'L1',
    title: 'Cognition Loop',
    modules: ['Sensor', 'Interpreter', 'Planner', 'Decider', 'Reflector', 'Reflex Matcher', 'Verifier'],
    summary: 'Per-task understanding, planning, reflection, verification, and System1/System2 routing.',
    release_gate: 'task-understanding-visible',
  },
  {
    id: 'L2',
    title: 'Coordination Hub',
    modules: ['Router', 'Event Bus', 'Workflow', 'Scheduler'],
    summary: 'Routes tasks, emits events, schedules execution, and coordinates flows.',
    release_gate: 'workflow-and-events-visible',
  },
  {
    id: 'L3',
    title: 'Capability Services',
    modules: ['Memory', 'Guardrail', 'Processor', 'IO', 'Insight', 'Cleaner'],
    summary: 'Reusable memory, safety, processing, IO, insight, and cleanup services.',
    release_gate: 'evidence-and-safety-visible',
  },
  {
    id: 'L4',
    title: 'Execution Layer',
    modules: ['Executor', 'Deployer', 'Responder'],
    summary: 'Turns plans into artifacts, bundles, installs, verification, and final responses.',
    release_gate: 'delivery-chain-visible',
  },
  {
    id: 'L5',
    title: 'Evolution Layer',
    modules: ['Consolidator', 'Learner', 'Simulator', 'Optimizer', 'Lifecycle Manager'],
    summary: 'Dream/background learning, replay, optimization, and evolution lifecycle.',
    release_gate: 'dream-cycle-visible',
  },
  {
    id: 'L6',
    title: 'Federation Layer',
    modules: ['Agent Registry', 'Delegation Manager', 'Federated Memory Boundary'],
    summary: 'Local runnable collaboration runtime with delegation, boundaries, and aggregation.',
    release_gate: 'local-federation-visible',
  },
];

const BASE_MODE_DEFINITIONS = {
  deliberate: {
    id: 'deliberate',
    label: 'deep-think',
    flow: 'sensor -> interpret -> memory -> plan -> decide -> route -> execute -> verify -> respond -> reflect',
    use_when: '复杂任务、可验证交付、需要 bundle / skill-pack / install / verify 时。',
    default_route: ['sensor', 'interpreter', 'memory', 'planner', 'decider', 'router', 'executor', 'verifier', 'responder', 'reflector'],
    mapped_targets: ['L0', 'L1', 'L2', 'L3', 'L4', 'modes', 'protocols'],
    reflex_guard: '仅把 reflex 作为快速命中候选；高风险或未命中自动回退完整 deliberate。',
  },
  reflex: {
    id: 'reflex',
    label: 'reflex',
    flow: 'sensor -> reflex matcher -> workflow -> execute -> verify -> respond',
    use_when: '低风险、快速总结、轻量状态问答。',
    default_route: ['sensor', 'reflex-matcher', 'workflow', 'executor', 'verifier', 'responder'],
    mapped_targets: ['L1', 'L2', 'modes', 'protocols'],
    reflex_guard: 'reflex matcher 先判定，未命中、风险过高或需要交付物时回退 deliberate。',
  },
  background: {
    id: 'background',
    label: 'dream',
    flow: 'events -> consolidator -> learner -> simulator -> optimizer -> lifecycle manager',
    use_when: '做学习回放、抽取经验、沉淀优化建议。',
    default_route: ['events', 'consolidator', 'learner', 'simulator', 'optimizer', 'lifecycle-manager'],
    mapped_targets: ['L2', 'L5', 'modes'],
    reflex_guard: '不走前台 reflex，专注 dream cycle 的后台节律。',
  },
  federated: {
    id: 'federated',
    label: 'group',
    flow: 'meta core -> delegation -> bounded subtasks -> aggregate -> decide -> verify -> respond',
    use_when: '需要多 deliverable、多子任务、受边界约束的本地群体协作时。',
    default_route: ['meta-core', 'delegation-manager', 'bounded-subtasks', 'aggregate', 'decider', 'verifier', 'responder'],
    mapped_targets: ['L0', 'L1', 'L2', 'L4', 'L6', 'modes', 'protocols'],
    reflex_guard: '不做跨网络自治扩张，只在 task-scoped boundary 内做本地协作。',
  },
};

function countBy(items = [], select) {
  return items.reduce((acc, item) => {
    const key = select(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function flattenUnique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function summarizeEvidence(evidence = []) {
  const counts = countBy(evidence, (item) => item.type || 'unknown');
  return {
    total: evidence.length,
    by_type: counts,
    latest: evidence[evidence.length - 1] || null,
  };
}

function summarizeArtifacts(task) {
  const output = task.result?.output || {};
  const bundle = output.bundle || null;
  const federation = output.federation || null;
  const dreamCycle = output.dream_cycle || null;
  return {
    bundle_ready: Boolean(bundle?.zip),
    bundle_zip: bundle?.zip || null,
    bundle_markdown: bundle?.bundle_markdown || null,
    skill_pack_ready: Boolean(bundle?.skill_pack?.installation || output.bundle?.skill_pack),
    runtime_summary: output.runtime_summary || null,
    federation,
    dream_cycle: dreamCycle
      ? {
          run_id: dreamCycle.run_id,
          learned_count: dreamCycle.learner?.learned_count || 0,
          status: dreamCycle.lifecycle?.status || 'completed',
        }
      : null,
    artifact_types: output.artifacts || [],
  };
}

function buildLifecyclePhases(task, events = []) {
  const seen = new Set(['new']);
  const checkpoints = [{ label: 'new', reached: true }];

  for (const event of events) {
    if (event.type === 'intent.resolved') seen.add('understood');
    if (event.type === 'plan.generated') seen.add('planned');
    if (event.type === 'decision.made') seen.add('approved');
    if (event.type === 'task.routed' || event.type === 'tool.called') seen.add('executing');
    if (event.type === 'verification.passed' || event.type === 'verification.failed') seen.add('verifying');
    if (event.type === 'response.ready') seen.add('responding');
    if (event.type === 'task.closed') seen.add('closed');
    if (event.type === 'risk.flagged' && task.status === 'escalated') seen.add('escalated');
  }

  for (const state of LIFECYCLE_ALLOWED.slice(1)) {
    checkpoints.push({
      label: state,
      reached: seen.has(state) || task.status === state,
      current: task.status === state,
    });
  }

  return checkpoints;
}

function expandMappedTargets(targets = []) {
  const expanded = [];
  for (const target of targets) {
    const match = /^L(\d)-L(\d)$/.exec(target);
    if (match) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      for (let value = start; value <= end; value += 1) {
        expanded.push(`L${value}`);
      }
      continue;
    }
    expanded.push(target);
  }
  return flattenUnique(expanded);
}

function includesTarget(entry, target) {
  return expandMappedTargets(entry.mapped_to || []).includes(target);
}

function summarizeVersion(version) {
  return {
    version: version.version,
    label: version.label,
    theme: version.theme,
    mapped_to: expandMappedTargets(version.mapped_to || []),
    retained: version.retained || [],
    engineered: version.engineered || [],
    parked: version.parked || [],
  };
}

function mapStatusToBadge(status) {
  if (['closed', 'ready', 'active', 'passed', 'engineered'].includes(status)) return 'ready';
  if (['failed', 'blocked', 'parked'].includes(status)) return 'risk';
  if (['standby', 'pending', 'warming'].includes(status)) return 'standby';
  return 'ready';
}

export class ArchitectureService {
  constructor({ metaCore, agentRegistry }) {
    this.metaCore = metaCore;
    this.agentRegistry = agentRegistry;
  }

  getEvolutionVersionsForTargets(targets = []) {
    const normalizedTargets = flattenUnique(targets.flatMap((target) => expandMappedTargets([target])));
    return EVOLUTION_MAP.filter((entry) => normalizedTargets.some((target) => includesTarget(entry, target))).map(summarizeVersion);
  }

  getLayerLineage(layerId) {
    return this.getEvolutionVersionsForTargets([layerId]);
  }

  getModeLineage(modeId) {
    const mode = BASE_MODE_DEFINITIONS[modeId] || BASE_MODE_DEFINITIONS.deliberate;
    return this.getEvolutionVersionsForTargets(mode.mapped_targets || []);
  }

  getLayers() {
    return BASE_LAYERS.map((layer) => {
      const organMap = ORGAN_ROLE_MAP.find((item) => item.engineering_layer.startsWith(layer.id));
      const lineage = this.getLayerLineage(layer.id);
      return {
        ...layer,
        organ_view: organMap?.organ_view || null,
        runtime_roles: organMap?.runtime_roles || layer.modules,
        lineage_versions: lineage.map((entry) => entry.version),
        lineage_themes: flattenUnique(lineage.map((entry) => entry.theme)),
        retained_highlights: flattenUnique(lineage.flatMap((entry) => entry.retained || [])).slice(0, 4),
        engineered_highlights: flattenUnique(lineage.flatMap((entry) => entry.engineered || [])).slice(0, 4),
        parked_highlights: flattenUnique(lineage.flatMap((entry) => entry.parked || [])).slice(0, 4),
        note: organMap?.note || null,
      };
    });
  }

  getModeRoute(modeId) {
    return [...(BASE_MODE_DEFINITIONS[modeId]?.default_route || BASE_MODE_DEFINITIONS.deliberate.default_route)];
  }

  getModeRoutingSummary() {
    return Object.keys(BASE_MODE_DEFINITIONS).map((modeId) => {
      const base = BASE_MODE_DEFINITIONS[modeId];
      const runtime = MODE_RUNTIME_MAP[modeId] || {};
      const lineage = this.getModeLineage(modeId);
      return {
        id: base.id,
        label: runtime.label || base.label,
        flow: base.flow,
        route: base.default_route,
        route_summary: base.default_route.join(' -> '),
        use_when: base.use_when,
        routing_kind: runtime.routing_kind,
        feedback_style: runtime.feedback_style,
        rhythm: runtime.rhythm,
        reflex_guard: base.reflex_guard,
        lineage_versions: lineage.map((entry) => entry.version),
        lineage_themes: flattenUnique(lineage.map((entry) => entry.theme)),
      };
    });
  }

  getModes() {
    return this.getModeRoutingSummary().map((mode) => ({
      ...mode,
      recommended_entry: mode.id === 'background'
        ? '从“跑一次梦境”按钮进入。'
        : mode.id === 'federated'
          ? '创建带多 deliverable 的任务最容易看到效果。'
          : mode.id === 'reflex'
            ? '适合快速摘要 / 状态类任务。'
            : '适合需要完整交付和验收的主任务。',
    }));
  }

  getEvolutionReport({ tasks = [], backgroundRuns = [], installRecords = [] } = {}) {
    const modeRouting = this.getModeRoutingSummary();
    const versionMap = EVOLUTION_MAP.map((entry) => ({
      ...summarizeVersion(entry),
      carried_into_agentx: entry.version === 'v6.0'
        ? '首页 / API / 工作台同步暴露七层、四模式与协议。'
        : entry.version === 'v5.0'
          ? 'TaskCard / Event Bus / 状态机 / 主链闭环被保留为工程骨架。'
          : entry.version === 'v4.0'
            ? '平衡法则、生命周期与社会大脑被压缩进 balance laws、L5/L6。'
            : entry.version === 'v3.0'
              ? '意根 / 意识 / 梦被分别收束为 reflex / deliberate/federated / background。'
              : entry.version === 'v2.0'
                ? '反馈环、反射弧、节律被收进 workflow / feedback loop / dream cycle。'
                : '器官隐喻被保留为 organ -> layer -> runtime role 对照表。',
    }));
    const carriedVersions = flattenUnique(tasks.flatMap((task) => (task.evolution_mapping?.carried_versions || [])));
    const activeModes = flattenUnique(tasks.map((task) => task.mode));

    return {
      headline: '天衍3.0 不是重讲 1.0-6.0，而是把演进档案压成可运行的七层 + 四模式 + 主链协议。',
      version_map: versionMap,
      layer_lineage: this.getLayers().map((layer) => ({
        id: layer.id,
        title: layer.title,
        organ_view: layer.organ_view,
        lineage_versions: layer.lineage_versions,
        engineered_highlights: layer.engineered_highlights,
        parked_highlights: layer.parked_highlights,
        note: layer.note,
      })),
      organ_role_map: ORGAN_ROLE_MAP,
      mode_routing: modeRouting,
      balance_laws: BALANCE_LAWS,
      role_staffing: ROLE_STAFFING,
      protocol_calibration: PROTOCOL_CALIBRATION,
      explicitly_parked: EXPLICITLY_PARKED,
      retained_items: flattenUnique(EVOLUTION_MAP.flatMap((entry) => entry.retained || [])),
      engineered_items: flattenUnique(EVOLUTION_MAP.flatMap((entry) => entry.engineered || [])),
      parked_items: flattenUnique(EVOLUTION_MAP.flatMap((entry) => entry.parked || [])).concat(EXPLICITLY_PARKED).filter((item, index, list) => list.indexOf(item) === index),
      coverage: {
        layers_visible: LAYER_ORDER.length,
        modes_visible: modeRouting.length,
        carried_versions: carriedVersions.length ? carriedVersions : versionMap.map((entry) => entry.version),
        active_modes: activeModes,
        background_runs: backgroundRuns.length,
        accepted_installs: installRecords.filter((record) => record.accepted).length,
      },
      summary_cards: [
        {
          id: 'retained',
          title: '保留项',
          lines: [
            '保留器官隐喻，但只作为解释视图。',
            '保留快慢双系统、反馈环、梦境整理与群体协作。',
            '保留平衡 / 生命周期 / 协议收口这三条主线。',
          ],
        },
        {
          id: 'engineered',
          title: '工程化项',
          lines: [
            '全部压进 L0-L6、四模式、TaskCard、Event Bus、状态机。',
            '首页 / API / 工作台同时展示映射、路由、节律与反馈。',
            'L5/L6 限定为本地可解释 runtime，而不是玄学扩张层。',
          ],
        },
        {
          id: 'parked',
          title: '搁置项',
          lines: EXPLICITLY_PARKED,
        },
      ],
    };
  }

  getRuntimeLayers({ tasks = [], backgroundRuns = [], installRecords = [] } = {}) {
    const closedTasks = tasks.filter((task) => task.status === 'closed');
    const federatedTasks = tasks.filter((task) => task.mode === 'federated');
    const activeTasks = tasks.filter((task) => ['new', 'understood', 'planned', 'approved', 'executing', 'verifying', 'responding', 'retrying'].includes(task.status));

    return this.getLayers().map((layer) => {
      let status = 'ready';
      let reason = '基础实现已到位。';
      let signals = [];

      if (layer.id === 'L0') {
        signals = ['mission', 'policy', 'persona', 'preferences'];
        reason = 'Meta Core 已在 API、首页与演进映射板可见。';
      }
      if (layer.id === 'L1') {
        status = tasks.length ? 'active' : 'ready';
        signals = [`tasks=${tasks.length}`, `active=${activeTasks.length}`];
        reason = tasks.length ? '已有任务经过 sensor / interpreter / planner / decider / reflex / verifier 链路。' : '等待第一条任务进入认知链。';
      }
      if (layer.id === 'L2') {
        status = tasks.length ? 'active' : 'ready';
        signals = [`events=${tasks.reduce((sum, task) => sum + (task.evidence?.length || 0), 0)}`];
        reason = tasks.length ? 'Workflow / Scheduler / Router 已在任务执行与可观测链中生效。' : '协调内核已就位，等待任务驱动。';
      }
      if (layer.id === 'L3') {
        status = tasks.some((task) => (task.evidence?.length || 0) > 0) ? 'active' : 'ready';
        signals = [`installs=${installRecords.length}`];
        reason = 'Memory / Guardrail / Processor / IO / Insight / Cleaner 都有运行期痕迹。';
      }
      if (layer.id === 'L4') {
        status = closedTasks.length ? 'active' : 'ready';
        signals = [`closed=${closedTasks.length}`, `acceptedInstalls=${installRecords.filter((record) => record.accepted).length}`];
        reason = closedTasks.length ? '已有 bundle / package / install / verify 主链结果。' : '执行链与交付链已就位，等待首个关闭任务。';
      }
      if (layer.id === 'L5') {
        status = backgroundRuns.length ? 'active' : 'ready';
        signals = [`dreamRuns=${backgroundRuns.length}`];
        reason = backgroundRuns.length ? 'Evolution Layer 已产出真实 dream cycle 记录。' : '演化链已就位，等待第一次 dream cycle。';
      }
      if (layer.id === 'L6') {
        status = federatedTasks.length ? 'active' : 'ready';
        signals = [`registryAgents=${this.agentRegistry.list().length}`, `federatedTasks=${federatedTasks.length}`];
        reason = federatedTasks.length ? 'Federation Layer 已生成 delegation / boundary / aggregation。' : '本地 federation runtime 已就位，等待 federated 任务。';
      }

      return {
        ...layer,
        status,
        status_badge: mapStatusToBadge(status),
        signals,
        reason,
      };
    });
  }

  getRuntimeModes({ tasks = [], backgroundRuns = [] } = {}) {
    return this.getModes().map((mode) => {
      const used = tasks.filter((task) => task.mode === mode.id);
      const latest = used[0] || null;
      const status = used.length || (mode.id === 'background' && backgroundRuns.length) ? 'ready' : 'standby';
      return {
        ...mode,
        status,
        used_count: used.length,
        latest_task_id: latest?.task_id || null,
        latest_status: latest?.status || null,
      };
    });
  }

  resolveLayerStatus(layerId, task) {
    if (layerId === 'L0') return task.goal ? 'active' : 'warming';
    if (layerId === 'L1') return task.plan || task.sensor ? 'active' : 'idle';
    if (layerId === 'L2') return task.workflow || task.schedule ? 'active' : 'idle';
    if (layerId === 'L3') return task.analysis || task.evidence?.length ? 'active' : 'idle';
    if (layerId === 'L4') return task.result ? 'active' : 'waiting';
    if (layerId === 'L5') return task.mode === 'background' || task.reflection || task.result?.output?.dream_cycle ? 'active' : 'standby';
    if (layerId === 'L6') return task.mode === 'federated' || task.delegation ? 'active' : 'standby';
    return 'idle';
  }

  buildTaskRuntimeProfile(task, { routes = [], reflex = null } = {}) {
    const mode = this.getModes().find((item) => item.id === task.mode) || this.getModes()[0];
    const route = routes.length ? routes : this.getModeRoute(task.mode);
    const activeLayers = this.getLayers()
      .map((layer) => ({ id: layer.id, status: this.resolveLayerStatus(layer.id, task) }))
      .filter((layer) => !['idle', 'standby', 'waiting'].includes(layer.status) || ['L5', 'L6'].includes(layer.id) && task.mode === (layer.id === 'L5' ? 'background' : 'federated'))
      .map((layer) => layer.id);
    const lineage = this.getEvolutionVersionsForTargets([...activeLayers, 'modes', 'protocols']);
    const feedbackCheckpoints = [
      'workflow scheduled',
      'guardrail checked',
      'execution evidence stored',
      'verification before done',
      task.mode === 'background' ? 'dream cycle replayed' : 'response + reflection closed',
    ];

    return {
      evolution_mapping: {
        carried_versions: lineage.map((entry) => entry.version),
        version_labels: lineage.map((entry) => `${entry.version} ${entry.label}`),
        mapped_layers: activeLayers,
        retained: flattenUnique(lineage.flatMap((entry) => entry.retained || [])).slice(0, 8),
        engineered: flattenUnique(lineage.flatMap((entry) => entry.engineered || [])).slice(0, 8),
        parked: flattenUnique(lineage.flatMap((entry) => entry.parked || [])).concat(EXPLICITLY_PARKED).filter((item, index, list) => list.indexOf(item) === index).slice(0, 8),
      },
      runtime_chain: {
        requested_mode: task.context?.mode || task.mode,
        active_mode: task.mode,
        product_track: task.product_track || 'runtime-studio',
        flow: mode.flow,
        route,
        route_summary: route.join(' -> '),
        routing_kind: mode.routing_kind,
        active_layers: activeLayers,
        fallback_mode: task.mode === 'reflex' ? 'deliberate' : null,
        summary: `${mode.label} 走 ${mode.routing_kind}，当前主链为 ${route.join(' -> ')}。`,
      },
      feedback_loop: {
        style: mode.feedback_style,
        checkpoints: feedbackCheckpoints,
        closure_rules: ROLE_STAFFING.closure_rules,
        summary: `${mode.feedback_style}；未通过 verify 不宣称 done。`,
      },
      runtime_rhythm: {
        lane: mode.rhythm,
        foreground: task.mode !== 'background',
        scheduler_hint: task.mode === 'background' ? '适合批量 consolidation / replay。' : '跟随前台任务即时推进。',
        summary: `${mode.rhythm}；${task.mode === 'background' ? '后台整理优先' : '前台交付优先'}`,
      },
      reflex_profile: {
        enabled: ['reflex', 'deliberate'].includes(task.mode),
        matcher: 'reflex-matcher',
        matched: reflex?.matched ?? null,
        fallback_to: task.mode === 'reflex' ? 'deliberate' : null,
        summary: task.mode === 'background'
          ? 'background 不走 reflex；直接进入 dream lane。'
          : task.mode === 'federated'
            ? 'federated 以前台 deliberate 审批为主，不放大 reflex 自治。'
            : task.mode === 'reflex'
              ? 'reflex 先尝试快通道，未命中或高风险则回退 deliberate。'
              : 'deliberate 保留 reflex 作为前置探测，但主链仍是完整闭环。',
      },
      protocol_versions: { ...PROTOCOL_CALIBRATION },
      mode_descriptor: mode,
    };
  }

  buildTaskEvolutionReport(task) {
    const profile = task.runtime_chain && task.evolution_mapping
      ? {
          evolution_mapping: task.evolution_mapping,
          runtime_chain: task.runtime_chain,
          feedback_loop: task.feedback_loop,
          runtime_rhythm: task.runtime_rhythm,
          reflex_profile: task.reflex_profile,
          protocol_versions: task.protocols,
          mode_descriptor: this.getModes().find((item) => item.id === task.mode) || this.getModes()[0],
        }
      : this.buildTaskRuntimeProfile(task, { routes: task.runtime_chain?.route || [] });

    return {
      task_id: task.task_id,
      lineage: this.getEvolutionVersionsForTargets([...(profile.evolution_mapping?.mapped_layers || []), 'modes', 'protocols']),
      ...profile,
    };
  }

  buildTaskObservability(task, { events = [], allTasks = [] } = {}) {
    const layers = this.getLayers().map((layer) => ({
      ...layer,
      status: this.resolveLayerStatus(layer.id, task),
    }));
    const childTasks = allTasks.filter((item) => item.parent_task_id === task.task_id);
    const evolution = this.buildTaskEvolutionReport(task);

    return {
      task_id: task.task_id,
      mode: {
        id: task.mode,
        label: task.mode_label,
      },
      lifecycle: {
        current: task.status,
        allowed: LIFECYCLE_ALLOWED,
        phases: buildLifecyclePhases(task, events),
        next_action: task.next_action,
      },
      protocols: task.protocols,
      layers,
      sensor: task.sensor,
      workflow: task.workflow,
      schedule: task.schedule,
      delegation: task.delegation,
      federated_boundary: task.federated_boundary,
      insight: task.insight,
      cleanup_report: task.cleanup_report,
      registry: this.agentRegistry.list(),
      evidence_summary: summarizeEvidence(task.evidence || []),
      artifact_summary: summarizeArtifacts(task),
      subtask_summary: {
        total: childTasks.length,
        closed: childTasks.filter((item) => item.status === 'closed').length,
        failed: childTasks.filter((item) => item.status === 'failed').length,
        queue: task.subtask_queue || null,
      },
      mode_orchestration: {
        requested_mode: task.context?.mode || null,
        active_mode: task.mode,
        product_track: task.product_track || 'runtime-studio',
        fallback_mode: evolution.runtime_chain?.fallback_mode || null,
        explanation: task.mode === 'background'
          ? '该任务被收进 L5 Evolution Layer，执行 dream cycle 并留下学习回放。'
          : task.mode === 'federated'
            ? '该任务经过 L6 Federation Layer，使用本地 delegation / boundary / aggregation。'
            : task.mode === 'reflex'
              ? '该任务走低风险快速路径，未命中或高风险回退 deliberate。'
              : '该任务走完整 deliberate 主链。',
      },
      evolution,
      architecture_visibility: {
        seven_layers_visible: true,
        four_modes_visible: true,
        lifecycle_visible: true,
        evidence_visible: true,
        package_visible: Boolean(task.result?.output?.bundle),
        evolution_visible: true,
      },
    };
  }
}

