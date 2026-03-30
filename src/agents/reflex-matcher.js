export class ReflexMatcherAgent {
  name = 'reflex-matcher';

  match(task) {
    const text = String(task.goal || '').toLowerCase();
    return {
      matched: /(status|summary|summarize|list|状态|总结|列出)/.test(text),
      confidence: /(status|summary|summarize|list|状态|总结|列出)/.test(text) ? 0.85 : 0.2,
    };
  }
}
