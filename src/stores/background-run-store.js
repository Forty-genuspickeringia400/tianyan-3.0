import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from '../utils/json-file.js';

const filePath = path.join(config.dataDir, 'background-runs.json');

export class BackgroundRunStore {
  list() {
    return readJson(filePath, []);
  }

  save(run) {
    const runs = this.list();
    runs.unshift(run);
    writeJson(filePath, runs);
    return run;
  }
}
