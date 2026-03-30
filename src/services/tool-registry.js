function toMarkdown(title, content) {
  const lines = [`# ${title}`, ''];
  for (const [key, value] of Object.entries(content || {})) {
    if (Array.isArray(value)) {
      lines.push(`## ${key}`);
      lines.push(...value.map((item) => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`));
      lines.push('');
    } else if (value && typeof value === 'object') {
      lines.push(`## ${key}`);
      lines.push('```json');
      lines.push(JSON.stringify(value, null, 2));
      lines.push('```');
      lines.push('');
    } else {
      lines.push(`- **${key}**: ${value}`);
    }
  }
  return lines.join('\n');
}

function makeAdapter(name, deliverable, title, build) {
  return {
    name,
    canHandle(task, analysis) {
      return (analysis.deliverables || []).includes(deliverable) || String(task.goal || '').toLowerCase().includes(deliverable.replace(/-/g, ' '));
    },
    run(task, analysis) {
      const artifact = build(task, analysis);
      return {
        adapter: name,
        deliverable,
        artifact,
        actions: [
          { kind: 'write_artifact', artifact },
          { kind: 'write_text_file', relativePath: `${artifact.type}.md`, content: toMarkdown(title, artifact.content) },
        ],
      };
    },
  };
}

const productBriefAdapter = makeAdapter('product-brief-adapter', 'product-brief', 'Product Brief', (task, analysis) => ({
  type: 'product-brief',
  title: 'Product Brief',
  content: {
    product_name: '人体智能体协作模式-多智能体架构系统',
    track: task.product_track,
    goal: task.goal,
    audience: ['product owner', 'delivery team', 'OpenClaw runtime/skill integrator'],
    selling_points: [
      'Seven-layer v6.0 architecture made visible in UI and API',
      'Four run modes: deep-think, reflex, dream, federation',
      'Auditable lifecycle, events, evidence, and verification',
      'Runnable bundle plus reusable skill-pack install/verify chain',
    ],
    deliverables: analysis.deliverables,
  },
}));

const skillBlueprintAdapter = makeAdapter('skill-blueprint-adapter', 'skill-blueprint', 'Skill Blueprint', (task, analysis) => ({
  type: 'skill-blueprint',
  title: 'Skill Blueprint',
  content: {
    sku: 'agentx-skill-pack',
    trigger_examples: ['闇€瑕佹妸鑳藉姏灏佽鎴?OpenClaw skill', '闇€瑕佸彲鍞崠鐨勪换鍔′氦浠樺寘'],
    input_schema: ['goal:string', 'context?:object', 'constraints?:string[]'],
    output_schema: ['task_id', 'status', 'artifacts', 'bundle', 'skill_pack'],
    packaging_outputs: [
      'skill-pack/README.md',
      'skill-pack/index.json',
      'skill-pack/manifest.json',
      'skill-pack/<generated>/SKILL.md',
      'skill-pack/<generated>/skill.json',
      'skill-pack/<generated>-<version>.skill',
    ],
    deliverables: analysis.deliverables,
    track: task.product_track,
  },
}));

const runtimePlaybookAdapter = makeAdapter('runtime-playbook-adapter', 'runtime-playbook', 'Runtime Playbook', (task) => ({
  type: 'runtime-playbook',
  title: 'Runtime Playbook',
  content: {
    goal: task.goal,
    operators: ['planner', 'executor', 'verifier', 'bundle exporter'],
    controls: ['approval', 'retry', 'run-subtasks', 'background consolidation'],
    runtime_mode: task.product_track,
  },
}));

const architectureAdapter = makeAdapter('architecture-adapter', 'architecture-outline', 'Architecture Outline', (task, analysis) => ({
  type: 'architecture-outline',
  title: 'Architecture Outline',
  content: {
    goal: task.goal,
    layers: ['L0-meta-core', 'L1-cognition-loop', 'L2-coordination-hub', 'L3-capability-services', 'L4-execution-layer', 'L5-evolution-layer', 'L6-federation-layer'],
    modes: ['deliberate', 'reflex', 'background', 'federated'],
    complexity: analysis.complexity,
    deliverables: analysis.deliverables,
  },
}));

const apiContractAdapter = makeAdapter('api-contract-adapter', 'api-contract', 'API Contract', (task) => ({
  type: 'api-contract',
  title: 'API Contract',
  content: {
    endpoints: [
      'GET /api/health',
      'GET /api/catalog',
      'GET /api/profiles/runtime',
      'GET /api/profiles/skill',
      'GET /api/tasks',
      'POST /api/tasks',
      'GET /api/tasks/:taskId',
      'GET /api/tasks/:taskId/events',
      'GET /api/tasks/:taskId/timeline',
      'GET /api/tasks/:taskId/graph',
      'GET /api/tasks/:taskId/queue',
      'GET /api/tasks/:taskId/files',
      'GET /api/tasks/:taskId/file?path=...',
      'GET /api/tasks/:taskId/package',
      'GET /api/tasks/:taskId/skill-pack',
      'GET /api/tasks/:taskId/skill-pack-readiness',
      'GET /api/tasks/:taskId/explorer',
      'GET /api/tasks/:taskId/observability',
      'GET /api/architecture',
      'GET /api/federation',
      'GET /api/tasks/:taskId/download-bundle',
      'GET /api/tasks/:taskId/download-bundle-zip',
      'GET /api/tasks/:taskId/download-skill-pack',
      'POST /api/tasks/:taskId/run-subtasks',
    ],
    note: `Generated for: ${task.goal}`,
  },
}));

const testStrategyAdapter = makeAdapter('test-strategy-adapter', 'test-strategy', 'Test Strategy', (task) => ({
  type: 'test-strategy',
  title: 'Test Strategy',
  content: {
    unit: ['task factory', 'state machine', 'agents', 'graph builder', 'adapter runtime'],
    integration: ['orchestrator lifecycle', 'approval flow', 'subtask execution', 'background consolidation', 'adapter runtime actions'],
    smoke: ['server boot', 'health check', 'catalog endpoint', 'task create endpoint', 'skill-pack export endpoint'],
    note: `Generated for: ${task.goal}`,
  },
}));

const implementationAdapter = makeAdapter('implementation-plan-adapter', 'implementation-plan', 'Implementation Plan', (task, analysis) => ({
  type: 'implementation-plan',
  title: 'Implementation Plan',
  content: {
    modules: analysis.deliverables,
    next_build_steps: ['define contracts', 'implement services', 'wire orchestrator', 'verify outputs', 'package bundle', 'export skill-pack'],
    note: `Generated for: ${task.goal}`,
  },
}));

const documentationAdapter = makeAdapter('documentation-adapter', 'documentation', 'Documentation Outline', (task, analysis) => ({
  type: 'documentation',
  title: 'Documentation Outline',
  content: {
    sections: ['overview', 'architecture', 'api', 'verification', 'operations', 'skill-packaging'],
    references: analysis.deliverables,
    note: `Generated for: ${task.goal}`,
  },
}));

const runtimeInspectAdapter = {
  name: 'safe-shell-inspect-adapter',
  canHandle() {
    return true;
  },
  run(task) {
    const artifact = {
      type: 'runtime-inspection',
      title: 'Runtime Inspection',
      content: {
        checks: ['node-version', 'npm-version'],
        track: task.product_track,
      },
    };

    return {
      adapter: 'safe-shell-inspect-adapter',
      deliverable: 'runtime-inspection',
      artifact,
      actions: [
        { kind: 'run_command', command: 'node', args: ['-v'] },
        { kind: 'run_command', command: 'npm', args: ['-v'] },
        { kind: 'write_artifact', artifact },
        { kind: 'write_text_file', relativePath: 'runtime-inspection.md', content: toMarkdown(artifact.title, artifact.content) },
      ],
    };
  },
};

const summaryAdapter = {
  name: 'summary-adapter',
  canHandle() {
    return true;
  },
  run(task, analysis) {
    const artifact = {
      type: 'task-summary',
      title: 'Task Summary',
      content: {
        goal: task.goal,
        product_track: task.product_track,
        complexity: analysis.complexity,
        keywords: analysis.keywords,
      },
    };

    return {
      adapter: 'summary-adapter',
      deliverable: 'task-summary',
      artifact,
      actions: [
        { kind: 'write_artifact', artifact },
        { kind: 'write_text_file', relativePath: 'task-summary.md', content: toMarkdown(artifact.title, artifact.content) },
      ],
    };
  },
};

const docBundleExportAdapter = {
  name: 'doc-bundle-export-adapter',
  canHandle() {
    return true;
  },
  run(task) {
    const artifact = {
      type: 'doc-bundle-export',
      title: 'Doc Bundle Export',
      content: {
        goal: task.goal,
        track: task.product_track,
        outputs: [
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
      },
    };

    return {
      adapter: 'doc-bundle-export-adapter',
      deliverable: 'doc-bundle-export',
      artifact,
      actions: [
        { kind: 'bundle_task_outputs' },
        { kind: 'write_artifact', artifact },
      ],
    };
  },
};

export class ToolRegistry {
  constructor() {
    this.adapters = [
      productBriefAdapter,
      skillBlueprintAdapter,
      runtimePlaybookAdapter,
      architectureAdapter,
      apiContractAdapter,
      testStrategyAdapter,
      implementationAdapter,
      documentationAdapter,
      runtimeInspectAdapter,
      summaryAdapter,
      docBundleExportAdapter,
    ];
  }

  select(task, analysis) {
    const picks = this.adapters.filter((adapter) => adapter.canHandle(task, analysis));
    return picks.length ? picks : [summaryAdapter, runtimeInspectAdapter, docBundleExportAdapter];
  }
}


