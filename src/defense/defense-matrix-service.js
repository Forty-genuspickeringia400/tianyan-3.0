function badge(status) {
  if (['active', 'ready', 'sealed'].includes(status)) return 'ready';
  if (['warn', 'degraded'].includes(status)) return 'warn';
  return 'risk';
}

export class DefenseMatrixService {
  constructor({ metaCore, memoryService, eventStore, guardrailService, cleanerService, verifier, federatedMemoryBoundary, networkSecurityService }) {
    this.metaCore = metaCore;
    this.memoryService = memoryService;
    this.eventStore = eventStore;
    this.guardrailService = guardrailService;
    this.cleanerService = cleanerService;
    this.verifier = verifier;
    this.federatedMemoryBoundary = federatedMemoryBoundary;
    this.networkSecurityService = networkSecurityService;
  }

  buildMatrix({ tasks = [], installRecords = [] } = {}) {
    const memoryRecords = this.memoryService.memoryStore?.list?.() || [];
    const totalEvents = tasks.reduce((sum, task) => sum + this.eventStore.list(task.task_id).length, 0);
    const cleanedTasks = tasks.filter((task) => Boolean(task.cleanup_report)).length;
    const verifiedTasks = tasks.filter((task) => task.verification?.passed).length;
    const escalatedTasks = tasks.filter((task) => task.status === 'escalated').length;
    const failedTasks = tasks.filter((task) => task.status === 'failed' || task.status === 'blocked').length;
    const federatedTasks = tasks.filter((task) => task.mode === 'federated');
    const boundarySample = this.federatedMemoryBoundary.resolve({ task_id: 'sample', mode: 'federated' });
    const networkSecurity = this.networkSecurityService.getHomeReport({ tasks, installRecords });

    const matrix = [
      {
        id: 'shi-gou',
        chinese_name: '尸狗',
        engineering_name: 'Risk Gate / Guardrail',
        linked_services: ['GuardrailService', 'metaCore.policy', 'NetworkSecurityService'],
        status: escalatedTasks ? 'active' : 'ready',
        signals: [`approval_keywords=${(this.metaCore.policy.blockedWithoutApproval || []).length}`, `escalated=${escalatedTasks}`, `egress=${networkSecurity.summary.egress_mode}`],
        summary: '负责高风险动作闸门，未经审批不放行，并联动网络出口审批。',
      },
      {
        id: 'fu-shi',
        chinese_name: '伏矢',
        engineering_name: 'Verification Seal',
        linked_services: ['VerifierAgent'],
        status: verifiedTasks ? 'sealed' : 'warn',
        signals: [`verified=${verifiedTasks}`, `failed=${failedTasks}`],
        summary: '负责 verify before done，未验证不宣称完成。',
      },
      {
        id: 'que-yin',
        chinese_name: '雀阴',
        engineering_name: 'Cleaner / Purge Lane',
        linked_services: ['CleanerService'],
        status: cleanedTasks ? 'active' : 'warn',
        signals: [`cleaned=${cleanedTasks}`],
        summary: '负责清理证据、压缩摘要和输出收口。',
      },
      {
        id: 'tun-zei',
        chinese_name: '吞贼',
        engineering_name: 'Archive Memory',
        linked_services: ['MemoryService', 'MemoryStore'],
        status: memoryRecords.length ? 'active' : 'warn',
        signals: [`memory_records=${memoryRecords.length}`],
        summary: '负责经验归档、复用与记忆沉淀。',
      },
      {
        id: 'fei-du',
        chinese_name: '非毒',
        engineering_name: 'Observability Sentinel',
        linked_services: ['EventStore', 'ArchitectureService', 'NetworkSecurityService'],
        status: totalEvents ? 'active' : 'warn',
        signals: [`events=${totalEvents}`, `posture=${networkSecurity.summary.posture}`],
        summary: '负责事件、证据、观测面与网络姿态留痕。',
      },
      {
        id: 'chu-hui',
        chinese_name: '除秽',
        engineering_name: 'Boundary Isolation',
        linked_services: ['FederatedMemoryBoundary', 'NetworkSecurityService'],
        status: federatedTasks.length ? 'active' : 'ready',
        signals: [`federated_tasks=${federatedTasks.length}`, `deny_types=${boundarySample.export_policy.deny_evidence_types.length}`, `ingress=${networkSecurity.summary.ingress_exposure}`],
        summary: '负责 task-scoped 边界、共享切片、入口收敛和越权阻断。',
      },
      {
        id: 'chou-fei',
        chinese_name: '臭肺',
        engineering_name: 'Recovery / Fault Tolerance',
        linked_services: ['retry-lifecycle', 'approval-gate', 'audit-trail'],
        status: failedTasks ? 'warn' : 'ready',
        signals: [`failed_or_blocked=${failedTasks}`, `retryable=${failedTasks + escalatedTasks}`, `audit_layers=${networkSecurity.summary.total_layers}`],
        summary: '负责失败收敛、重试入口、回滚与人工接管。',
      },
    ].map((item) => ({ ...item, status_badge: badge(item.status) }));

    return {
      matrix,
      engineering_view: {
        matrix_type: 'seven-spirit-engineering-defense-matrix',
        posture: networkSecurity.summary.posture,
        domains: ['execution-safety', 'verification', 'cleanup', 'memory', 'observability', 'boundary', 'recovery', 'network-security'],
      },
      summary: {
        total_spirits: matrix.length,
        active_or_ready: matrix.filter((item) => ['active', 'ready', 'sealed'].includes(item.status)).length,
        escalated_tasks: escalatedTasks,
        failed_or_blocked_tasks: failedTasks,
        network_posture: networkSecurity.summary.posture,
      },
      boundaries: [
        '高风险动作需要 approval。',
        '未 verify 不宣称 done。',
        'federated 只共享 task-scoped slices。',
        'cleanup / archive / rollback 必须留审计记录。',
        '默认不扩大网络暴露面，远程出口动作需要额外审查。',
      ],
    };
  }

  getHomeReport({ tasks = [], installRecords = [] } = {}) {
    return this.buildMatrix({ tasks, installRecords });
  }

  getTaskReport(task, { allTasks = [], installRecords = [] } = {}) {
    const relatedTasks = [task, ...allTasks.filter((item) => item.parent_task_id === task.task_id)];
    const matrix = this.buildMatrix({ tasks: relatedTasks, installRecords });
    return {
      ...matrix,
      task_guardrail_snapshot: this.guardrailService.check(task),
      task_cleanup_snapshot: task.cleanup_report || this.cleanerService.compact(task),
      task_boundary_snapshot: task.federated_boundary || (task.mode === 'federated' ? this.federatedMemoryBoundary.resolve(task) : null),
    };
  }
}
