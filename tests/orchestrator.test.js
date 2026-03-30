import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { createServer } from '../src/http/create-server.js';

function resetDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  for (const file of [
    'tasks.json',
    'events.json',
    'memory.json',
    'background-runs.json',
    'skill-installs.json',
    'evolution-capsules.json',
    'evolution-records.json',
  ]) {
    const full = path.join(config.dataDir, file);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }
  for (const dirName of ['generated', 'skill-installs']) {
    const full = path.join(config.dataDir, dirName);
    if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
  }
}

async function withServer(run) {
  const app = createApp();
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  try {
    await run({ app, port });
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('deliberate mode closes with bundle, install verification, and seven-layer observability', async () => {
  resetDataDir();
  const app = createApp();
  const task = await app.orchestrator.createAndRun(
    'Build a seven-layer human-agent runtime and output architecture, api, tests, docs, implementation, and installable skill package',
    { source: 'test', mode: 'deliberate', product_track: 'skill-pack' },
  );

  assert.equal(task.status, 'closed');
  assert.equal(task.mode, 'deliberate');
  assert.equal(task.result.success, true);
  assert.equal(task.verification.passed, true);
  assert.ok(task.result.output.bundle.zip);
  assert.equal(task.result.output.bundle.skill_pack.installation.verification.passed, true);
  assert.ok(task.insight);
  assert.ok(task.cleanup_report);

  const obs = app.architectureService.buildTaskObservability(task, {
    events: app.eventStore.list(task.task_id),
    allTasks: app.taskStore.list(),
  });
  assert.equal(obs.layers.length, 7);
  assert.equal(obs.mode.id, 'deliberate');
  assert.equal(obs.lifecycle.current, 'closed');
  assert.ok(obs.sensor);
  assert.ok(obs.workflow);
  assert.ok(obs.evidence_summary.total >= 1);
  assert.equal(obs.architecture_visibility.seven_layers_visible, true);

  const soul = app.soulService.getTaskReport(task, { allTasks: app.taskStore.list(), backgroundRuns: app.backgroundRunStore.list() });
  assert.equal(soul.awakening.subsystem.includes('L0.5'), true);
  assert.equal(soul.three_souls.length, 3);

  const defense = app.defenseMatrixService.getTaskReport(task, { allTasks: app.taskStore.list(), installRecords: app.skillInstallService.getRecords() });
  assert.equal(defense.matrix.length, 7);
  assert.ok(defense.matrix.some((item) => item.engineering_name === 'Verification Seal'));
  assert.equal(defense.summary.network_posture.includes('local-first'), true);

  const networkSecurity = app.networkSecurityService.getTaskReport(task, { allTasks: app.taskStore.list(), installRecords: app.skillInstallService.getRecords() });
  assert.equal(networkSecurity.configuration_layers.length, 5);
  assert.equal(networkSecurity.runtime_snapshot.bind_host, '127.0.0.1');

  const evolution = app.evolutionService.getTaskReport(task, {
    tasks: app.taskStore.list(),
    backgroundRuns: app.backgroundRunStore.list(),
    installRecords: app.skillInstallService.getRecords(),
  });
  assert.ok(evolution.task_capsules.length >= 1);
  assert.ok(['candidate', 'growth', 'mature', 'frozen', 'seed'].includes(evolution.stage.id));
});

test('high-risk task escalates before approval and closes after approval', async () => {
  resetDataDir();
  const app = createApp();
  const initial = await app.orchestrator.createAndRun('deploy this runtime to production', { source: 'test', product_track: 'runtime-studio' });
  assert.equal(initial.status, 'escalated');
  assert.match(initial.next_action, /Approval required|approve/i);

  const approved = await app.orchestrator.approve(initial.task_id);
  assert.equal(approved.status, 'closed');
  assert.equal(approved.context.approved, true);
});

test('background dream mode produces a richer dream cycle run', async () => {
  resetDataDir();
  const app = createApp();
  await app.orchestrator.createAndRun(
    'Build a seven-layer system with bundle and skill-pack support',
    { source: 'test', mode: 'deliberate', product_track: 'skill-pack' },
  );
  const task = await app.orchestrator.createAndRun(
    'Run background dream consolidation and learning for recent finished tasks',
    { source: 'test', mode: 'background', product_track: 'runtime-studio' },
  );

  assert.equal(task.status, 'closed');
  assert.equal(task.mode, 'background');
  assert.ok(task.result.output.dream_cycle);
  assert.equal(task.result.output.dream_cycle.type, 'dream-cycle');
  assert.ok(task.result.output.dream_cycle.learner.capsules.length >= 1);
  assert.ok(task.result.output.dream_cycle.optimizer.recommendations.length >= 1);
  assert.ok(task.result.output.dream_cycle.governance.generated_capsules.length >= 1);
  assert.ok(app.backgroundRunStore.list().some((run) => run.run_id === task.result.output.dream_cycle.run_id));
});

test('federated mode produces delegation plan, boundary, and aggregated output', async () => {
  resetDataDir();
  const app = createApp();
  const task = await app.orchestrator.createAndRun(
    'Use group collaboration to design architecture, api, tests, docs, and implementation for a multi-agent platform',
    { source: 'test', mode: 'federated', product_track: 'skill-pack' },
  );

  assert.equal(task.status, 'closed');
  assert.equal(task.mode, 'federated');
  assert.ok(task.delegation);
  assert.ok(task.federated_boundary);
  assert.ok(task.result.output.federation);
  assert.ok(task.delegation.assignments.length >= 1);
  assert.equal(task.delegation.federation_mode, 'local-runtime');
  assert.ok(task.federated_boundary.export_policy.allow_evidence_types.includes('analysis'));
});

test('dashboard, soul, defense, evolution, lifecycle, workbench, and skill-pack endpoints expose structured runtime data', async () => {
  resetDataDir();
  await withServer(async ({ port }) => {
    const base = `http://127.0.0.1:${port}`;

    const dashboard = await fetch(`${base}/api/dashboard`).then((res) => res.json());
    assert.equal(dashboard.dashboard.verdict.stage_label, '终极版封板候选');
    assert.equal(dashboard.dashboard.quality_gates.length >= 6, true);
    assert.ok(dashboard.dashboard.soul.awakening);
    assert.equal(dashboard.dashboard.defense.matrix.length, 7);
    assert.ok(dashboard.dashboard.self_evolution.latest_capsule);

    const architecture = await fetch(`${base}/api/architecture`).then((res) => res.json());
    assert.equal(architecture.layers.length, 7);
    assert.equal(architecture.modes.length, 4);
    assert.equal(architecture.runtime_layers.length, 7);
    assert.equal(architecture.network_security.configuration_layers.length, 5);

    const soul = await fetch(`${base}/api/soul`).then((res) => res.json());
    assert.equal(soul.soul.three_souls.length, 3);

    const defense = await fetch(`${base}/api/defense`).then((res) => res.json());
    assert.equal(defense.defense.matrix.length, 7);
    assert.equal(defense.defense.summary.network_posture.includes('local-first'), true);

    const networkSecurity = await fetch(`${base}/api/network-security`).then((res) => res.json());
    assert.equal(networkSecurity.network_security.configuration_layers.length, 5);
    assert.equal(networkSecurity.network_security.summary.bind_host, '127.0.0.1');

    const evolution = await fetch(`${base}/api/evolution`).then((res) => res.json());
    assert.ok(evolution.lineage.version_map.length >= 6);
    assert.ok(evolution.evolution_system.latest_capsule);

    const federation = await fetch(`${base}/api/federation`).then((res) => res.json());
    assert.ok(federation.agents.length >= 4);
    assert.equal(federation.summary.local_runtime, true);

    const created = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: 'Build a seven-layer runtime with docs, tests, api, implementation and installable skill pack',
        context: { source: 'http-test', mode: 'federated', product_track: 'skill-pack' },
      }),
    }).then((res) => res.json());

    const taskId = created.task.task_id;

    const observability = await fetch(`${base}/api/tasks/${taskId}/observability`).then((res) => res.json());
    assert.equal(observability.observability.layers.length, 7);
    assert.equal(observability.observability.mode.id, 'federated');
    assert.ok(observability.observability.delegation.assignments.length >= 1);
    assert.equal(observability.observability.architecture_visibility.lifecycle_visible, true);

    const lifecycle = await fetch(`${base}/api/tasks/${taskId}/lifecycle`).then((res) => res.json());
    assert.equal(lifecycle.lifecycle.timeline.task_id, taskId);
    assert.ok(lifecycle.lifecycle.phases.phases.length >= 4);

    const workbench = await fetch(`${base}/api/tasks/${taskId}/workbench`).then((res) => res.json());
    assert.equal(workbench.workbench.package.bundle_ready, true);
    assert.equal(workbench.workbench.skill_pack.installation.verification.passed, true);
    assert.ok(workbench.workbench.explorer.artifact_index.groups.length >= 1);
    assert.equal(workbench.workbench.soul.three_souls.length, 3);
    assert.equal(workbench.workbench.defense.matrix.length, 7);
    assert.equal(workbench.workbench.network_security.configuration_layers.length, 5);
    assert.ok(workbench.workbench.evolution_control.latest_capsule);

    const skillPack = await fetch(`${base}/api/tasks/${taskId}/skill-pack`).then((res) => res.json());
    assert.equal(skillPack.skill_pack.ready, true);

    const capsuleId = workbench.workbench.evolution_control.latest_capsule.capsule_id;
    const reviewed = await fetch(`${base}/api/evolution/capsules/${capsuleId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'review', reviewer: 'test-suite', reason: 'audit review' }),
    }).then((res) => res.json());
    assert.equal(reviewed.capsule.review_status, 'review-ready');

    const applied = await fetch(`${base}/api/evolution/capsules/${capsuleId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'apply', reviewer: 'test-suite', reason: 'approved low-risk apply', approved: true }),
    }).then((res) => res.json());
    assert.equal(applied.capsule.lifecycle_state, 'applied');

    const download = await fetch(`${base}/api/tasks/${taskId}/download-skill-pack`);
    assert.equal(download.status, 200);
    const archive = Buffer.from(await download.arrayBuffer());
    assert.equal(archive.subarray(0, 4).toString('binary'), 'PK\u0003\u0004');
  });
});
