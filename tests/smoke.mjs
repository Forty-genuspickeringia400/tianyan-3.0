import assert from 'node:assert/strict';
import { startServer } from '../src/server.js';

const { server, port } = await startServer({ port: 0 });
const base = `http://127.0.0.1:${port}`;

try {
  const health = await fetch(`${base}/api/health`).then((res) => res.json());
  assert.equal(health.ok, true);
  assert.equal(health.project, 'agentx-3.0');

  const dashboard = await fetch(`${base}/api/dashboard`).then((res) => res.json());
  assert.equal(dashboard.dashboard.verdict.stage_label, '终极版封板候选');
  assert.ok(dashboard.dashboard.soul.awakening);
  assert.equal(dashboard.dashboard.defense.matrix.length, 7);
  assert.ok(dashboard.dashboard.self_evolution.latest_capsule);

  const fingerprint = await fetch(`${base}/api/license/fingerprint`).then((res) => res.json());
  assert.ok(fingerprint.fingerprint.fingerprint.startsWith('sha256:'));

  const heartbeat = await fetch(`${base}/api/license/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'smoke-test', metadata: { suite: 'smoke' } }),
  }).then((res) => res.json());
  assert.equal(heartbeat.heartbeat.source, 'smoke-test');
  assert.equal(heartbeat.heartbeat.metadata.suite, 'smoke');

  const revocation = await fetch(`${base}/api/license/revoke-check`).then((res) => res.json());
  assert.equal(revocation.revocation.revoked, false);

  const architecture = await fetch(`${base}/api/architecture`).then((res) => res.json());
  assert.equal(architecture.layers.length, 7);
  assert.equal(architecture.modes.length, 4);

  const soul = await fetch(`${base}/api/soul`).then((res) => res.json());
  assert.equal(soul.soul.three_souls.length, 3);

  const defense = await fetch(`${base}/api/defense`).then((res) => res.json());
  assert.equal(defense.defense.matrix.length, 7);
  assert.equal(defense.defense.summary.network_posture.includes('local-first'), true);

  const networkSecurity = await fetch(`${base}/api/network-security`).then((res) => res.json());
  assert.equal(networkSecurity.network_security.configuration_layers.length, 5);

  const evolution = await fetch(`${base}/api/evolution`).then((res) => res.json());
  assert.ok(evolution.evolution_system.latest_capsule);

  const created = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: 'Build a seven-layer system with bundle and skill-pack support',
      context: { source: 'smoke', mode: 'deliberate', product_track: 'skill-pack' },
    }),
  }).then((res) => res.json());

  const workbench = await fetch(`${base}/api/tasks/${created.task.task_id}/workbench`).then((res) => res.json());
  assert.equal(workbench.workbench.observability.layers.length, 7);
  assert.equal(workbench.workbench.package.bundle_ready, true);
  assert.equal(workbench.workbench.skill_pack.installation.verification.passed, true);
  assert.equal(workbench.workbench.soul.three_souls.length, 3);
  assert.equal(workbench.workbench.defense.matrix.length, 7);
  assert.equal(workbench.workbench.network_security.configuration_layers.length, 5);
  assert.ok(workbench.workbench.evolution_control.latest_capsule);

  console.log(JSON.stringify({
    ok: true,
    port,
    task_id: created.task.task_id,
    stage: dashboard.dashboard.verdict.stage_label,
    awakening: dashboard.dashboard.soul.awakening.growth_stage.label,
    defense_matrix: dashboard.dashboard.defense.matrix.length,
    network_layers: dashboard.dashboard.network_security.configuration_layers.length,
    evolution_stage: dashboard.dashboard.self_evolution.stage.label,
    bundle_ready: workbench.workbench.package.bundle_ready,
  }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
}
