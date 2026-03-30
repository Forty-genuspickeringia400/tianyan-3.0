export class IOService {
  describe(task) {
    return {
      input_channel: task.context?.channel || 'http',
      source: task.context?.source || 'manual',
      artifact_root: task.task_id,
      expects_bundle: true,
      expects_events: true,
    };
  }
}
