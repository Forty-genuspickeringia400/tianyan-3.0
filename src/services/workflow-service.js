export class WorkflowService {
  prepare(task) {
    const workflow_id = `wf-${task.task_id}`;
    const lane = task.mode === 'reflex'
      ? 'fast-safe-lane'
      : task.mode === 'background'
        ? 'dream-lane'
        : task.mode === 'federated'
          ? 'federation-lane'
          : 'deep-think-lane';

    return {
      workflow_id,
      lane,
      stages: ['input', 'understand', 'plan', 'decide', 'execute', 'verify', 'respond'],
      created_at: new Date().toISOString(),
    };
  }
}
