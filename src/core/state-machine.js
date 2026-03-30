const transitions = {
  new: ['understood', 'failed'],
  understood: ['planned', 'approved', 'escalated', 'blocked', 'failed'],
  planned: ['approved', 'blocked', 'escalated', 'failed'],
  approved: ['executing', 'failed'],
  executing: ['verifying', 'retrying', 'failed'],
  verifying: ['responding', 'failed'],
  responding: ['closed', 'failed'],
  retrying: ['executing', 'failed'],
  blocked: ['approved', 'retrying', 'failed'],
  escalated: ['approved', 'failed'],
  failed: ['retrying', 'closed'],
  closed: [],
};

export function canTransition(from, to) {
  return transitions[from]?.includes(to) ?? false;
}

export function transitionTask(task, to) {
  if (task.status === to) return task;
  if (!canTransition(task.status, to)) {
    throw new Error(`Invalid transition: ${task.status} -> ${to}`);
  }
  task.status = to;
  task.updated_at = new Date().toISOString();
  return task;
}
