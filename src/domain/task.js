export const TASK_MODES = [
  'deliberate',
  'reflex',
  'background',
  'federated',
];

export const TASK_MODE_LABELS = {
  deliberate: 'deep-think',
  reflex: 'reflex',
  background: 'dream',
  federated: 'group',
};

export const TASK_STATUSES = [
  'new',
  'understood',
  'planned',
  'approved',
  'executing',
  'verifying',
  'responding',
  'closed',
  'blocked',
  'retrying',
  'escalated',
  'failed',
];

export const EVENT_TYPES = {
  INPUT_RECEIVED: 'input.received',
  INTENT_RESOLVED: 'intent.resolved',
  MEMORY_HIT: 'memory.hit',
  PLAN_GENERATED: 'plan.generated',
  DECISION_MADE: 'decision.made',
  TASK_ROUTED: 'task.routed',
  TOOL_CALLED: 'tool.called',
  TOOL_FINISHED: 'tool.finished',
  RISK_FLAGGED: 'risk.flagged',
  VERIFICATION_PASSED: 'verification.passed',
  VERIFICATION_FAILED: 'verification.failed',
  RESPONSE_READY: 'response.ready',
  TASK_CLOSED: 'task.closed',
  LEARNING_EXTRACTED: 'learning.extracted',
  AGENT_SPAWNED: 'agent.spawned',
  AGENT_COMPLETED: 'agent.completed',
  WORKFLOW_SCHEDULED: 'workflow.scheduled',
  DELEGATION_CREATED: 'delegation.created',
  DREAM_COMPLETED: 'dream.completed',
};
