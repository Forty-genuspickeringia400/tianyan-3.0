import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { createServer } from '../src/http/create-server.js';
import { LicenseService } from '../src/security/license-service.js';

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableSort(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableSort(value));
}

function createRuntimeConfig(dir) {
  const licenseDir = path.join(dir, 'license');
  return {
    projectSlug: 'agentx-3.0',
    projectVersion: '0.1.0-test',
    authorization: {
      requireLicense: true,
      licenseDir,
      publicKeyPath: path.join(licenseDir, 'public.pem'),
      licensePath: path.join(licenseDir, 'license.json'),
      activationRecordPath: path.join(licenseDir, 'activation.json'),
      activationBackupDir: path.join(licenseDir, 'backups'),
      heartbeatStatePath: path.join(licenseDir, 'heartbeat.json'),
      heartbeatMode: 'local-stub',
      heartbeatIntervalMinutes: 30,
      revocationStatePath: path.join(licenseDir, 'revocation.json'),
      revocationMode: 'local-stub',
      fingerprintSalt: 'test-salt',
      defaultGracePeriodHours: 72,
    },
  };
}

function createSignedLicense(service, privateKey, overrides = {}) {
  const payload = {
    licenseId: 'lic-http-1',
    ownerName: 'friend-http',
    edition: 'friend-basic',
    allowedDevices: 1,
    deviceFingerprints: [service.getDeviceFingerprint()],
    issuedAt: '2026-03-16T12:00:00+08:00',
    expiresAt: '2099-04-15T23:59:59+08:00',
    gracePeriodHours: 72,
    capabilities: {
      basicWorkflows: true,
      remoteExec: false,
    },
    policyVersion: '1.0.0',
    ...overrides,
  };

  const signature = crypto.sign(null, Buffer.from(stableStringify(payload), 'utf8'), privateKey).toString('base64');
  return { ...payload, signature };
}

test('license HTTP endpoints expose fingerprint, activation, heartbeat, and revocation flow', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-license-http-'));
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const runtimeConfig = createRuntimeConfig(dir);
  fs.mkdirSync(runtimeConfig.authorization.licenseDir, { recursive: true });
  fs.writeFileSync(runtimeConfig.authorization.publicKeyPath, publicKey.export({ format: 'pem', type: 'spki' }), 'utf8');

  const licenseService = new LicenseService({ runtimeConfig });
  const server = createServer({ licenseService });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const fingerprint = await fetch(`${base}/api/license/fingerprint`).then((res) => res.json());
    assert.ok(fingerprint.fingerprint.fingerprint.startsWith('sha256:'));

    const license = createSignedLicense(licenseService, privateKey);
    const activated = await fetch(`${base}/api/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'http-test', license }),
    }).then((res) => res.json());

    assert.equal(activated.ok, true);
    assert.equal(activated.activation.source, 'http-test');
    assert.equal(activated.evaluation.valid, true);

    const heartbeat = await fetch(`${base}/api/license/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'http-test', metadata: { suite: 'license-http' } }),
    }).then((res) => res.json());

    assert.equal(heartbeat.heartbeat.source, 'http-test');
    assert.equal(heartbeat.heartbeat.metadata.suite, 'license-http');

    const revoked = await fetch(`${base}/api/license/revoke-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'http-test', revoked: true, reason: 'manual-revoke' }),
    }).then((res) => res.json());

    assert.equal(revoked.revocation.revoked, true);
    assert.equal(revoked.status.valid, false);
    assert.equal(revoked.status.reason, 'license-revoked');
  } finally {
    server.close();
    await once(server, 'close');
  }
});
