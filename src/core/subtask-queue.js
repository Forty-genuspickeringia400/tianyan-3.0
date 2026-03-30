function normalizeDeps(taskMap, task) {
  return (task.dependencies || []).filter((depId) => taskMap.has(depId));
}

export function buildSubtaskExecutionPlan(rootTask, allTasks = []) {
  const subtasks = allTasks
    .filter((task) => task.parent_task_id === rootTask.task_id)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const taskMap = new Map(subtasks.map((task) => [task.task_id, task]));
  const pending = new Set(subtasks.map((task) => task.task_id));
  const topoCompleted = new Set();
  const waves = [];

  while (pending.size) {
    const ready = subtasks.filter((task) => {
      if (!pending.has(task.task_id)) return false;
      const deps = normalizeDeps(taskMap, task);
      return deps.every((depId) => topoCompleted.has(depId));
    });

    if (!ready.length) {
      const blocked = subtasks
        .filter((task) => pending.has(task.task_id))
        .map((task) => ({
          task_id: task.task_id,
          deliverable: task.deliverable || null,
          waiting_for: normalizeDeps(taskMap, task),
        }));
      return {
        root_task_id: rootTask.task_id,
        status: 'blocked',
        waves,
        blocked,
        ready_now: [],
        completed_count: subtasks.filter((task) => task.status === 'closed').length,
        total_count: subtasks.length,
      };
    }

    waves.push({
      index: waves.length + 1,
      ready: ready.map((task) => ({
        task_id: task.task_id,
        goal: task.goal,
        deliverable: task.deliverable || null,
        dependencies: normalizeDeps(taskMap, task),
        status: task.status,
      })),
    });

    for (const task of ready) {
      pending.delete(task.task_id);
      topoCompleted.add(task.task_id);
    }
  }

  const completedNow = new Set(subtasks.filter((task) => task.status === 'closed').map((task) => task.task_id));
  const readyNow = subtasks
    .filter((task) => task.status !== 'closed')
    .filter((task) => normalizeDeps(taskMap, task).every((depId) => completedNow.has(depId)))
    .map((task) => ({
      task_id: task.task_id,
      deliverable: task.deliverable || null,
      status: task.status,
    }));

  return {
    root_task_id: rootTask.task_id,
    status: 'ready',
    waves,
    blocked: [],
    ready_now: readyNow,
    completed_count: completedNow.size,
    total_count: subtasks.length,
  };
}
