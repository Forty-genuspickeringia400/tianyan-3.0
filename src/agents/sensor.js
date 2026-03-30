import { createEvidence } from '../core/task-factory.js';

function normalizeInput(input) {
  if (typeof input === 'string') return input.trim();
  if (typeof input?.text === 'string') return input.text.trim();
  return JSON.stringify(input);
}

export class SensorAgent {
  name = 'sensor';

  async run(ctx) {
    const text = normalizeInput(ctx.task_card.input);
    const signal = {
      raw_text: text,
      source: ctx.task_card.context?.source || 'manual',
      channel: ctx.task_card.context?.channel || 'http',
      chars: text.length,
      has_constraints: /不要|必须|only|must|forbid|禁止/i.test(text),
      hints: {
        asks_for_reflex: /(status|summary|list|show|状态|总结|列出)/i.test(text),
        asks_for_background: /(dream|background|consolidate|learn|后台|梦境|学习)/i.test(text),
        asks_for_federation: /(group|federat|delegate|multi-agent|群体|协作|拆给多个)/i.test(text),
      },
    };

    return {
      task_patch: {
        sensor: signal,
      },
      evidence: [createEvidence('sensor', signal)],
      next_action: 'interpret',
    };
  }
}
