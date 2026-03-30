import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from '../utils/json-file.js';

const filePath = path.join(config.dataDir, 'evolution-records.json');
const fallback = [
  {
    record_id: 'evo_record_seed_1',
    capsule_id: 'capsule_seed_controlled_evolution',
    action: 'suggested',
    from_state: 'seed',
    to_state: 'candidate',
    reason: '初始化天衍3.0 的受控演化基线。',
    approved: false,
    reviewer: 'system-seed',
    source_task_id: null,
    source_run_id: null,
    created_at: '2026-03-15T18:10:00.000+08:00',
  },
];

export class EvolutionRecordStore {
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

