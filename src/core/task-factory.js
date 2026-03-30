import { PROTOCOL_CALIBRATION } from '../architecture/evolution-spec.js';
import { TASK_MODE_LABELS } from '../domain/task.js';
import { makeId, nowIso } from '../utils/id.js';

export function createTaskCard(input, context = {}) {
  const timestamp = nowIso();
  const mode = context.mode || 'deliberate';
  return {
    task_id: makeId('task'),
    parent_task_id: context.parent_task_id || null,
    goal: '',
    input,
    context,
    constraints: Array.isArray(context.constraints) ? context.constraints : [],
    risk_level: 'medium',
    priority: context.priority || 'P1',
    mode,
    mode_label: TASK_MODE_LABELS[mode] || mode,
    product_track: context.product_track || 'runtime-studio',
    owner: context.owner || 'orchestrator',
    status: 'new',
    plan: null,
    result: null,
    evidence: [],
    next_action: null,
    depth: Number(context.depth || 0),
    subtasks: [],
    verification: null,
    reflection: null,
    analysis: null,
    sensor: null,
    workflow: null,
    schedule: null,
    delegation: null,
    federated_boundary: null,
    insight: null,
    cleanup_report: null,
    evolution_mapping: {
      carried_versions: [],
      version_labels: [],
      mapped_layers: [],
      retained: [],
      engineered: [],
      parked: [],
    },
    runtime_chain: {
      requested_mode: mode,
      active_mode: mode,
      product_track: context.product_track || 'runtime-studio',
      flow: null,
      route: [],
      route_summary: '',
      routing_kind: null,
      active_layers: [],
      fallback_mode: mode === 'reflex' ? 'deliberate' : null,
      summary: '',
    },
    feedback_loop: {
      style: null,
      checkpoints: [],
      closure_rules: [],
      summary: '',
    },
    runtime_rhythm: {
      lane: null,
      foreground: true,
      scheduler_hint: '',
      summary: '',
    },
    reflex_profile: {
      enabled: ['deliberate', 'reflex'].includes(mode),
      matcher: 'reflex-matcher',
      matched: null,
      fallback_to: mode === 'reflex' ? 'deliberate' : null,
      summary: '',
    },
    protocols: {
      ...PROTOCOL_CALIBRATION,
    },
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function patchTask(task, output = {}) {
  if (output.task_patch) {
    Object.assign(task, output.task_patch);
  }
  if (output.evidence?.length) {
    task.evidence.push(...output.evidence);
  }
  if (output.next_action !== undefined) {
    task.next_action = output.next_action;
  }
  task.updated_at = nowIso();
  return task;
}

export function createEvent(taskId, type, source, payload = {}) {
  return {
    event_id: makeId('evt'),
    task_id: taskId,
    type,
    source,
    payload,
    created_at: nowIso(),
  };
}

export function createEvidence(type, content) {
  return {
    id: makeId('evi'),
    type,
    content,
    created_at: nowIso(),
  };
}
