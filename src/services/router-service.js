export class RouterService {
  route(task) {
    if (task.mode === 'reflex') {
      return ['reflex-matcher', 'executor', 'responder'];
    }
    if (task.mode === 'background') {
      return ['workflow', 'executor', 'reflector', 'responder', 'evolution'];
    }
    if (task.mode === 'federated') {
      return ['delegation-manager', 'executor', 'responder'];
    }
    return ['planner', 'decider', 'executor', 'responder'];
  }
}
