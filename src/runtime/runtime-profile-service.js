import { config } from '../config.js';
import { TASK_STATUSES } from '../domain/task.js';

export class RuntimeProfileService {
  getProfile() {
    return {
      mode: 'runtime-studio',
      release_version: config.projectVersion,
      state_machine: TASK_STATUSES,
      run_modes: ['deliberate', 'reflex', 'background', 'federated'],
      approval_policy: {
        required_for: ['deploy', 'delete', 'remove', 'publish', 'message', 'email', 'restart', 'shutdown', 'migrate'],
        recovery: ['approve', 'retry'],
      },
      execution: {
        auto_subtasks: true,
        bundle_exports: [
          'README.md',
          'index.json',
          'bundle/bundle.md',
          'bundle/manifest.json',
          'bundle/bundle.zip',
          'skill-pack/README.md',
          'skill-pack/index.json',
          'skill-pack/manifest.json',
          'skill-pack/<generated>/SKILL.md',
          'skill-pack/<generated>/skill.json',
          'skill-pack/<generated>-<version>.skill',
        ],
        audit_trail: ['tasks', 'events', 'memory', 'background-runs'],
      },
      channels: ['http-api', 'web-ui', 'skill-contract', 'skill-pack-export', 'package-explorer'],
    };
  }
}
