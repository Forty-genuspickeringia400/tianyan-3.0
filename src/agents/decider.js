import { createEvent, createEvidence } from '../core/task-factory.js';
import { EVENT_TYPES } from '../domain/task.js';

export class DeciderAgent {
  name = 'decider';

  async run(ctx) {
    const approved = Boolean(ctx.task_card.context?.approved);
    const highRisk = ctx.task_card.risk_level === 'high';

    if (highRisk && !approved) {
      return {
        task_patch: {
          status: 'escalated',
        },
        evidence: [createEvidence('log', { decision: 'require_approval' })],
        events: [createEvent(ctx.task_card.task_id, EVENT_TYPES.DECISION_MADE, this.name, { action: 'require_approval' })],
        next_action: 'approve task to continue',
      };
    }

    return {
      task_patch: {
        status: 'approved',
      },
      evidence: [createEvidence('log', { decision: 'proceed' })],
      events: [createEvent(ctx.task_card.task_id, EVENT_TYPES.DECISION_MADE, this.name, { action: 'proceed' })],
      next_action: 'execute',
    };
  }
}
