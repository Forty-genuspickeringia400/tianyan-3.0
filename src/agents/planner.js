import { createEvent, createEvidence } from '../core/task-factory.js';
import { EVENT_TYPES } from '../domain/task.js';

function makeSteps(goal, mode, analysis = {}, productTrack = 'runtime-studio') {
  const base = [
    { step_id: 's1', title: 'Understand goal', description: goal, status: 'done' },
    { step_id: 's2', title: 'Check memory and constraints', status: 'done' },
    { step_id: 's3', title: 'Map product/runtime/skill deliverables', status: 'done' },
  ];

  if (analysis.should_split) {
    base.push({ step_id: 's4', title: 'Create subtasks for major deliverables', status: 'pending' });
  }

  base.push({ step_id: 's5', title: `Package for ${productTrack}`, status: 'pending' });

  if (mode === 'reflex') {
    return [...base, { step_id: 's6', title: 'Respond with minimal safe action', status: 'pending' }];
  }

  return [
    ...base,
    { step_id: 's7', title: 'Execute selected tools/plugins', status: 'pending' },
    { step_id: 's8', title: 'Verify result before reply', status: 'pending' },
  ];
}

export class PlannerAgent {
  name = 'planner';

  async run(ctx) {
    const analysis = ctx.task_card.analysis || {};
    const productTrack = ctx.task_card.product_track || 'runtime-studio';
    const steps = makeSteps(ctx.task_card.goal, ctx.task_card.mode, analysis, productTrack);
    const plan = {
      summary: ctx.task_card.mode === 'reflex' ? 'Fast path plan' : 'Productized delivery plan',
      steps,
      deliverables: analysis.deliverables || [],
      complexity: analysis.complexity || 'unknown',
      product_track: productTrack,
    };

    return {
      task_patch: {
        plan,
        status: 'planned',
      },
      evidence: [createEvidence('log', plan)],
      events: [createEvent(ctx.task_card.task_id, EVENT_TYPES.PLAN_GENERATED, this.name, { stepCount: steps.length, deliverableCount: (analysis.deliverables || []).length, productTrack })],
      next_action: 'decide',
    };
  }
}
