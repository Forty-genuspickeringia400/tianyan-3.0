function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function inferDeliverables(goal, productTrack) {
  const text = String(goal || '').toLowerCase();
  const deliverables = [];

  if (/(客户|产品|sell|sku|包装|交付|product)/.test(text)) deliverables.push('product-brief');
  if (/(技能|skill|openclaw)/.test(text) || productTrack === 'skill-pack') deliverables.push('skill-blueprint');
  if (/(运行|runtime|部署|ops|运维)/.test(text) || productTrack === 'runtime-studio') deliverables.push('runtime-playbook');
  if (/(架构|architecture)/.test(text)) deliverables.push('architecture-outline');
  if (/(开发|实现|build|implement)/.test(text)) deliverables.push('implementation-plan');
  if (/(接口|api)/.test(text)) deliverables.push('api-contract');
  if (/(测试|test)/.test(text)) deliverables.push('test-strategy');
  if (/(文档|doc|readme)/.test(text)) deliverables.push('documentation');

  if (!deliverables.length) {
    deliverables.push('product-brief', 'skill-blueprint', 'runtime-playbook', 'implementation-plan');
  }

  return [...new Set(deliverables)];
}

function inferComplexity(goal) {
  const tokens = tokenize(goal);
  if (tokens.length >= 18) return 'high';
  if (tokens.length >= 8) return 'medium';
  return 'low';
}

export class ProcessorService {
  analyze(task) {
    const goal = task.goal || '';
    const complexity = inferComplexity(goal);
    const depth = Number(task.depth || task.context?.depth || 0);
    const productTrack = task.product_track || 'runtime-studio';
    const deliverables = inferDeliverables(goal, productTrack);
    const shouldSplitByIntent = /(系统|platform|orchestrator|workflow|multi-agent|多智能体|产品化|skill)/i.test(goal);
    const should_split = depth < 1 && (complexity === 'high' || deliverables.length >= 3 || shouldSplitByIntent);

    return {
      normalized_goal: goal.trim(),
      keywords: [...new Set(tokenize(goal))].slice(0, 16),
      deliverables,
      complexity,
      should_split,
      split_reason: should_split ? 'complexity-or-deliverables' : 'not-needed',
      depth,
      product_track: productTrack,
    };
  }
}
