import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from '../utils/json-file.js';

const filePath = path.join(config.dataDir, 'evolution-capsules.json');
const fallback = [
  {
    capsule_id: 'capsule_seed_controlled_evolution',
    capsule_key: 'seed:controlled-evolution-boundary',
    version: 'v1',
    title: '受控演化边界基线 capsule',
    kind: 'strategy',
    lifecycle_state: 'candidate',
    review_status: 'awaiting-review',
    risk_level: 'medium',
    source_task_id: null,
    source_run_id: null,
    source_mode: 'background',
    proposal: {
      summary: '所有自我进化只允许以经验沉淀、候选策略、受控启用与回滚方式落地。',
      expected_benefit: '把灵性/觉醒与自我进化固定在可审计、可观察、可回滚的工程边界内。',
      guardrails: [
        '不自动修改系统提示、工具策略、权限边界。',
        '高风险 apply / rollback 必须显式 approved=true。',
        'apply 之后仍需 verification / audit trail。',
      ],
    },
    mappings: {
      target_layers: ['L0', 'L5'],
      target_services: ['meta-core', 'evolution-service'],
      chinese_concept: '自我进化边界',
    },
    controls: {
      auto_apply: false,
      requires_approval: true,
      verification_required: true,
      rollback_supported: true,
      blocked_actions: ['system-prompt-mutation', 'tool-policy-change', 'permission-boundary-change'],
    },
    created_at: '2026-03-15T18:10:00.000+08:00',
    updated_at: '2026-03-15T18:10:00.000+08:00',
  },
];

export class EvolutionCapsuleStore {
  list() {
    return readJson(filePath, fallback);
  }

  get(capsuleId) {
    return this.list().find((item) => item.capsule_id === capsuleId) || null;
  }

  findByKey(capsuleKey) {
    return this.list().find((item) => item.capsule_key === capsuleKey) || null;
  }

  save(capsule) {
    const items = this.list();
    const index = items.findIndex((item) => item.capsule_id === capsule.capsule_id);
    if (index >= 0) items[index] = capsule;
    else items.unshift(capsule);
    writeJson(filePath, items);
    return capsule;
  }
}
