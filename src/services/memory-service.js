import { createEvidence } from '../core/task-factory.js';
import { makeId } from '../utils/id.js';

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export class MemoryService {
  constructor(memoryStore) {
    this.memoryStore = memoryStore;
  }

  search(query) {
    const tokens = new Set(tokenize(query));
    const records = this.memoryStore.list()
      .map((record) => {
        const haystack = tokenize(`${record.title} ${record.content} ${(record.tags || []).join(' ')}`);
        const score = haystack.reduce((sum, token) => sum + (tokens.has(token) ? 1 : 0), 0);
        return { ...record, score };
      })
      .filter((record) => record.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      records,
      evidence: createEvidence('memory', records.map(({ title, content, score }) => ({ title, content, score }))),
    };
  }

  learn(task, reflection) {
    return this.memoryStore.save({
      memory_id: makeId('mem'),
      scope: 'task',
      title: `Learning from ${task.task_id}`,
      content: JSON.stringify(reflection),
      tags: ['learning', task.mode, task.risk_level],
    });
  }
}
