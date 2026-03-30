function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function findMatches(text, keywords = []) {
  const content = ` ${String(text || '').toLowerCase()} `;
  return keywords.filter((keyword) => content.includes(String(keyword || '').toLowerCase()));
}

function statusBadge(status) {
  if (['enforced', 'active', 'ready', 'sealed'].includes(status)) return 'ready';
  if (['guarded', 'warning', 'warn'].includes(status)) return 'warn';
  return 'risk';
}

function summarizeModeScope(tasks = []) {
  const modes = [...new Set(tasks.map((task) => task.mode).filter(Boolean))];
  return modes.length ? modes.join(' / ') : 'deliberate';
}

export class NetworkSecurityService {
  constructor({ metaCore, runtimeConfig, guardrailService, federatedMemoryBoundary }) {
    this.metaCore = metaCore;
    this.runtimeConfig = runtimeConfig;
    this.guardrailService = guardrailService;
    this.federatedMemoryBoundary = federatedMemoryBoundary;
  }

  buildTaskRisk(task) {
    const sourceText = [task.goal, task.input, JSON.stringify(task.context || {})].join(' ');
    const matchedKeywords = findMatches(sourceText, this.runtimeConfig.networkSecurity.riskyNetworkKeywords || []);
    const guardrail = this.guardrailService.check(task);
    const remoteIntent = matchedKeywords.some((item) => ['公网', 'internet', 'public', 'remote', 'ssh', 'webhook', 'api', 'publish', 'deploy'].includes(item));

    return {
      matched_keywords: matchedKeywords,
      requires_approval: !guardrail.allowed && guardrail.requiresApproval,
      remote_intent: remoteIntent,
      summary: matchedKeywords.length
        ? `检测到 ${matchedKeywords.length} 个网络/远程相关关键词，当前按 ${guardrail.requiresApproval ? '审批闸门' : '受控本地'} 策略处理。`
        : '当前任务没有明显扩大网络暴露面的意图，维持本地优先姿态。',
      guardrail,
    };
  }

  buildConfigurationLayers({ tasks = [], installRecords = [] } = {}) {
    const bindHost = this.runtimeConfig.host;
    const ingressExposure = this.runtimeConfig.networkSecurity.allowLanBinding ? 'lan-or-custom' : 'loopback-only';
    const boundarySample = this.federatedMemoryBoundary.resolve({ task_id: 'netsec-sample', mode: 'federated' });
    const riskyTasks = tasks.map((task) => this.buildTaskRisk(task)).filter((item) => item.matched_keywords.length > 0).length;
    const approvedInstalls = installRecords.filter((item) => item.accepted).length;

    return [
      {
        id: 'ingress-binding',
        title: '入口绑定层',
        status: ingressExposure === 'loopback-only' ? 'enforced' : 'guarded',
        summary: ingressExposure === 'loopback-only'
          ? 'HTTP 控制台默认只绑定 127.0.0.1，先收住暴露面。'
          : '当前允许局域网或自定义绑定，需配合额外边界使用。',
        signals: [`bind_host=${bindHost}`, `exposure=${ingressExposure}`, `port=${this.runtimeConfig.port}`],
      },
      {
        id: 'federation-boundary',
        title: '联邦边界层',
        status: 'enforced',
        summary: 'L6 仍限制为本地 federation runtime，只共享 task-scoped slices。',
        signals: [`plane=${this.runtimeConfig.networkSecurity.federationPlane}`, `allow_types=${boundarySample.export_policy.allow_evidence_types.length}`, `deny_types=${boundarySample.export_policy.deny_evidence_types.length}`],
      },
      {
        id: 'egress-approval',
        title: '出口审批层',
        status: riskyTasks ? 'guarded' : 'enforced',
        summary: '远程部署、发布、发送、Webhook、跨网扩张等动作先走 approval gate，再决定是否放行。',
        signals: [`risky_keywords=${(this.runtimeConfig.networkSecurity.riskyNetworkKeywords || []).length}`, `risky_tasks=${riskyTasks}`, `blocked_words=${(this.metaCore.policy.blockedWithoutApproval || []).length}`],
      },
      {
        id: 'secret-containment',
        title: '密钥封装层',
        status: 'enforced',
        summary: 'Secrets 默认留在 env/runtime/config 边界内，不进入 bundle、skill-pack、审计导出。',
        signals: [`mode=${this.runtimeConfig.networkSecurity.secretsMode}`, `artifact_redaction=enabled`],
      },
      {
        id: 'audit-rollback',
        title: '审计回滚层',
        status: approvedInstalls ? 'active' : 'enforced',
        summary: '事件、安装回执、evolution records 组成网络动作后的追踪与回滚面。',
        signals: [`accepted_installs=${approvedInstalls}`, `audit_trail=events+installs+evolution`],
      },
    ].map((item) => ({ ...item, status_badge: statusBadge(item.status) }));
  }

  buildTopology({ tasks = [] } = {}) {
    const riskyTasks = tasks.map((task) => this.buildTaskRisk(task)).filter((item) => item.remote_intent).length;
    return {
      posture: riskyTasks ? 'local-first / guarded-egress' : 'local-first / loopback-only',
      runtime_plane: this.runtimeConfig.networkSecurity.federationPlane,
      control_plane: {
        ui_api_bind: `${this.runtimeConfig.host}:${this.runtimeConfig.port}`,
        exposure: this.runtimeConfig.networkSecurity.allowLanBinding ? 'controlled-lan-or-custom' : 'localhost-only',
        summary: this.runtimeConfig.networkSecurity.allowLanBinding
          ? '控制台允许自定义网络入口，但默认仍要求审批与边界控制。'
          : '控制台默认只服务本机，优先降低误暴露。',
      },
      data_plane: {
        generated_artifacts: 'local-filesystem',
        federation_scope: 'task-scoped memory slices only',
        secret_boundary: this.runtimeConfig.networkSecurity.secretsMode,
      },
      egress_plane: {
        mode: this.runtimeConfig.networkSecurity.outboundMode,
        approval_gate: 'required for risky network mutations',
        risky_task_count: riskyTasks,
      },
    };
  }

  getHomeReport({ tasks = [], backgroundRuns = [], installRecords = [] } = {}) {
    const configuration_layers = this.buildConfigurationLayers({ tasks, installRecords });
    const topology = this.buildTopology({ tasks, backgroundRuns });
    const enforcedControls = configuration_layers.filter((item) => ['enforced', 'active'].includes(item.status)).length;

    return {
      summary: {
        posture: topology.posture,
        bind_host: this.runtimeConfig.host,
        ingress_exposure: this.runtimeConfig.networkSecurity.allowLanBinding ? 'controlled-lan-or-custom' : 'loopback-only',
        federation_plane: this.runtimeConfig.networkSecurity.federationPlane,
        egress_mode: this.runtimeConfig.networkSecurity.outboundMode,
        total_layers: configuration_layers.length,
        enforced_or_active_layers: enforcedControls,
        active_modes: summarizeModeScope(tasks),
      },
      configuration_layers,
      topology,
      boundaries: [
        '默认不把控制台直接暴露到公网。',
        '跨网络/远程动作先过 approval gate，再决定是否放行。',
        'federated 只共享 task-scoped slices，不共享 workspace 根和外部 secrets。',
        'bundle / skill-pack / 审计导出默认不携带 secrets。',
      ],
      recommended_moves: tasks.length
        ? [
            '继续保持 local-first，只有在明确需要时才扩大入口面。',
            '对 deploy / publish / webhook / remote 相关任务继续保留 approval gate。',
          ]
        : [
            '当前还没有任务，网络安全配置层已就位，可直接承接后续任务。',
          ],
    };
  }

  getTaskReport(task, { allTasks = [], installRecords = [] } = {}) {
    const relatedTasks = [task, ...allTasks.filter((item) => item.parent_task_id === task.task_id)];
    const home = this.getHomeReport({ tasks: relatedTasks, installRecords });
    const taskRisk = this.buildTaskRisk(task);

    return {
      ...home,
      task_posture: {
        recommended_plane: taskRisk.remote_intent ? 'approval-gated local-first' : 'local-only',
        requires_approval: taskRisk.requires_approval,
        matched_keywords: taskRisk.matched_keywords,
        summary: taskRisk.summary,
      },
      runtime_snapshot: {
        bind_host: this.runtimeConfig.host,
        port: this.runtimeConfig.port,
        default_url: `http://${this.runtimeConfig.host}:${this.runtimeConfig.port}`,
        allow_lan_binding: this.runtimeConfig.networkSecurity.allowLanBinding,
      },
    };
  }
}
