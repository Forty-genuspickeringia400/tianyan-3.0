import { createEvent, createEvidence } from '../core/task-factory.js';
import { EVENT_TYPES, TASK_MODE_LABELS } from '../domain/task.js';

function normalizeInput(input) {
  if (typeof input === 'string') return input.trim();
  if (typeof input?.text === 'string') return input.text.trim();
  return JSON.stringify(input);
}

function inferRisk(text) {
  const value = text.toLowerCase();
  if (/(delete|remove|deploy|publish|restart|shutdown|message|email|send|迁移|部署|删除|发送|发布)/.test(value)) return 'high';
  if (/(write|edit|update|patch|修改|更新)/.test(value)) return 'medium';
  return 'low';
}

function inferMode(text, context, sensor = {}) {
  if (context.mode) return context.mode;
  const value = text.toLowerCase();
  if (sensor?.hints?.asks_for_background || /(dream|background|consolidate|learn|后台|梦境|学习)/.test(value)) return 'background';
  if (sensor?.hints?.asks_for_federation || /(group|delegate|multi-agent|federat|群体|协作)/.test(value)) return 'federated';
  if (sensor?.hints?.asks_for_reflex || /(status|summary|summarize|list|看看|状态|总结|列出)/.test(value)) return 'reflex';
  return 'deliberate';
}

function inferProductTrack(text, context) {
  if (context.product_track) return context.product_track;
  if (/(skill|技能|openclaw skill|封装)/i.test(text)) return 'skill-pack';
  return 'runtime-studio';
}

function extractConstraints(text, context) {
  const constraints = [...(Array.isArray(context.constraints) ? context.constraints : [])];
  for (const line of text.split(/\r?\n/)) {
    if (/^(不要|必须|只要|仅|禁止|must|only|do not)/i.test(line.trim())) {
      constraints.push(line.trim());
    }
  }
  return [...new Set(constraints)];
}

export class InterpreterAgent {
  name = 'interpreter';

  async run(ctx) {
    const text = normalizeInput(ctx.task_card.input);
    const goal = text;
    const risk_level = inferRisk(text);
    const mode = inferMode(text, ctx.task_card.context || {}, ctx.task_card.sensor);
    const product_track = inferProductTrack(text, ctx.task_card.context || {});
    const constraints = extractConstraints(text, ctx.task_card.context || {});

    return {
      task_patch: {
        goal,
        risk_level,
        mode,
        mode_label: TASK_MODE_LABELS[mode] || mode,
        product_track,
        constraints,
        status: 'understood',
      },
      evidence: [createEvidence('intent', { goal, risk_level, mode, product_track, constraints })],
      events: [createEvent(ctx.task_card.task_id, EVENT_TYPES.INTENT_RESOLVED, this.name, { goal, risk_level, mode, product_track })],
      next_action: mode === 'reflex' ? 'route_reflex' : 'plan',
    };
  }
}
