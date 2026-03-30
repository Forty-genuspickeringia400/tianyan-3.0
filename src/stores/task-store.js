import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from '../utils/json-file.js';

const filePath = path.join(config.dataDir, 'tasks.json');

export class TaskStore {
  list() {
    return readJson(filePath, []);
  }

  get(taskId) {
    return this.list().find((task) => task.task_id === taskId) || null;
  }

  save(task) {
    const tasks = this.list();
    const index = tasks.findIndex((item) => item.task_id === task.task_id);
    if (index >= 0) tasks[index] = task;
    else tasks.unshift(task);
    writeJson(filePath, tasks);
    return task;
  }
}
