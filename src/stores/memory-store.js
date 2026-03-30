import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from '../utils/json-file.js';

const filePath = path.join(config.dataDir, 'memory.json');
const fallback = [
  {
    memory_id: 'mem_seed_1',
    scope: 'system',
    title: '天衍1.0 mission',
    content: 'Prefer explicit task cards, explicit state transitions, auditable events, and human approval for risky actions.',
    tags: ['mission', 'policy', 'audit'],
  },
  {
    memory_id: 'mem_seed_2',
    scope: 'system',
    title: 'Execution rule',
    content: 'Do not mark a task complete before verification. High-risk actions require approval.',
    tags: ['execution', 'verification', 'approval'],
  }
];

export class MemoryStore {
  list() {
    return readJson(filePath, fallback);
  }

  save(record) {
    const items = this.list();
    items.unshift(record);
    writeJson(filePath, items);
    return record;
  }
}

