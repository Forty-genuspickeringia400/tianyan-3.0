import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from '../utils/json-file.js';

const filePath = path.join(config.dataDir, 'events.json');

export class EventStore {
  list(taskId = null) {
    const events = readJson(filePath, []);
    return taskId ? events.filter((event) => event.task_id === taskId) : events;
  }

  append(event) {
    const events = this.list();
    events.unshift(event);
    writeJson(filePath, events);
    return event;
  }
}
