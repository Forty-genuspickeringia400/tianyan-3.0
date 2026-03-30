import { buildSubtaskExecutionPlan } from './subtask-queue.js';

export function buildTaskTimeline(task, events = []) {
  const checkpoints = [
    { kind: 'task', label: 'created', at: task.created_at, status: 'new' },
    ...events
      .slice()
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((event) => ({
        kind: 'event',
        label: event.type,
        source: event.source,
        at: event.created_at,
        payload: event.payload,
      })),
    { kind: 'task', label: 'updated', at: task.updated_at, status: task.status },
  ];

  return {
    task_id: task.task_id,
    status: task.status,
    checkpoints,
  };
}

export function buildTaskGraph(rootTask, allTasks = [], allEvents = []) {
  const relevantTasks = allTasks.filter(
    (task) => task.task_id === rootTask.task_id || task.parent_task_id === rootTask.task_id,
  );

  const nodes = relevantTasks.map((task) => ({
    id: task.task_id,
    label: task.goal || task.task_id,
    status: task.status,
    type: task.parent_task_id ? 'subtask' : 'task',
    depth: task.depth || 0,
    deliverable: task.deliverable || null,
    product_track: task.product_track || 'runtime-studio',
    dependencies: task.dependencies || [],
  }));

  const parentEdges = relevantTasks
    .filter((task) => task.parent_task_id)
    .map((task) => ({
      from: task.parent_task_id,
      to: task.task_id,
      type: 'parent-child',
      label: task.deliverable || 'subtask',
    }));

  const dependencyEdges = relevantTasks
    .filter((task) => Array.isArray(task.dependencies) && task.dependencies.length)
    .flatMap((task) => task.dependencies.map((depId) => ({
      from: depId,
      to: task.task_id,
      type: 'depends-on',
      label: 'depends-on',
    })));

  const eventCounts = relevantTasks.map((task) => ({
    task_id: task.task_id,
    events: allEvents.filter((event) => event.task_id === task.task_id).length,
  }));

  return {
    root_task_id: rootTask.task_id,
    nodes,
    edges: [...parentEdges, ...dependencyEdges],
    event_counts: eventCounts,
    queue: buildSubtaskExecutionPlan(rootTask, allTasks),
  };
}
