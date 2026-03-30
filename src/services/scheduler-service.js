export class SchedulerService {
  schedule(task) {
    const wave = task.mode === 'federated' ? 'parallel' : 'serial';
    return {
      queue: task.mode,
      wave,
      priority: task.priority || 'P1',
      auto_run_subtasks: task.context?.autoRunSubtasks !== false,
      scheduled_at: new Date().toISOString(),
    };
  }
}
