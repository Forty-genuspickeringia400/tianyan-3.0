export class FederatedMemoryBoundary {
  resolve(task) {
    const sharedScopes = ['task-summary', 'task-evidence', 'shared-lessons'];
    const privateScopes = ['workspace-root', 'unrelated-memory', 'external-secrets'];
    const accessibleScopes = task.mode === 'federated'
      ? [...sharedScopes, 'delegation-notes', 'subtask-briefs']
      : sharedScopes;

    return {
      boundary_id: `fmb-${task.task_id}`,
      mode: task.mode,
      accessible_scopes: accessibleScopes,
      blocked_scopes: privateScopes,
      export_policy: {
        allow_evidence_types: ['analysis', 'intent', 'plan', 'tool_output', 'reflection'],
        deny_evidence_types: ['raw-workspace-scan', 'unrelated-private-memory'],
      },
      handoff_rules: [
        '只共享 task-scoped 摘要、证据和 delegation notes。',
        '禁止把 workspace 根目录或无关长期记忆直接暴露给子协作单元。',
        '聚合阶段只回收 deliverable 结果与必要验证证据。',
      ],
      rule: 'share only task-scoped memory slices in federation mode',
    };
  }
}
