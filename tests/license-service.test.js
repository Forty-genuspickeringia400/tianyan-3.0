import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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
    licenseId: 'lic-test-1',
    ownerName: 'friend-a',
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

test('license service verifies signed friend license and capabilities', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-license-'));
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const runtimeConfig = createRuntimeConfig(dir);

  fs.mkdirSync(runtimeConfig.authorization.licenseDir, { recursive: true });
  fs.writeFileSync(runtimeConfig.authorization.publicKeyPath, publicKey.export({ format: 'pem', type: 'spki' }), 'utf8');

  const service = new LicenseService({ runtimeConfig });
  const license = createSignedLicense(service, privateKey);
  fs.writeFileSync(runtimeConfig.authorization.licensePath, JSON.stringify(license, null, 2), 'utf8');

  const status = service.getStatus({ refresh: true });
  assert.equal(status.valid, true);
  assert.equal(status.edition, 'friend-basic');
  assert.equal(status.capabilities.basicWorkflows, true);
  assert.equal(status.capabilities.remoteExec, false);
  assert.equal(status.revocation.revoked, false);
  assert.equal(service.assertCapability('basicWorkflows').allowed, true);
  assert.equal(service.assertCapability('remoteExec').allowed, false);
});

test('license activation imports a signed license and persists activation metadata', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-license-'));
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const runtimeConfig = createRuntimeConfig(dir);

  fs.mkdirSync(runtimeConfig.authorization.licenseDir, { recursive: true });
  fs.writeFileSync(runtimeConfig.authorization.publicKeyPath, publicKey.export({ format: 'pem', type: 'spki' }), 'utf8');

  const service = new LicenseService({ runtimeConfig });
  const license = createSignedLicense(service, privateKey, { licenseId: 'lic-import-1' });
  const result = service.activateLicense(license, { source: 'unit-test' });

  assert.equal(result.ok, true);
  assert.equal(result.evaluation.valid, true);
  assert.equal(result.status.valid, true);
  assert.equal(result.activation.license_id, 'lic-import-1');
  assert.equal(fs.existsSync(runtimeConfig.authorization.licensePath), true);
  assert.equal(fs.existsSync(runtimeConfig.authorization.activationRecordPath), true);

  const stored = JSON.parse(fs.readFileSync(runtimeConfig.authorization.licensePath, 'utf8'));
  const activation = JSON.parse(fs.readFileSync(runtimeConfig.authorization.activationRecordPath, 'utf8'));
  assert.equal(stored.licenseId, 'lic-import-1');
  assert.equal(activation.source, 'unit-test');
  assert.equal(activation.verification.valid, true);
});

test('heartbeat and revocation stubs create a locally auditable authorization trail', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentx-license-'));
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const runtimeConfig = createRuntimeConfig(dir);

  fs.mkdirSync(runtimeConfig.authorization.licenseDir, { recursive: true });
  fs.writeFileSync(runtimeConfig.authorization.publicKeyPath, publicKey.export({ format: 'pem', type: 'spki' }), 'utf8');

  const service = new LicenseService({ runtimeConfig });
  const license = createSignedLicense(service, privateKey, { licenseId: 'lic-revoke-1' });
  fs.writeFileSync(runtimeConfig.authorization.licensePath, JSON.stringify(license, null, 2), 'utf8');

  const heartbeat = service.recordHeartbeat({ source: 'unit-test', metadata: { scenario: 'heartbeat' } });
  assert.equal(fs.existsSync(runtimeConfig.authorization.heartbeatStatePath), true);
  assert.equal(heartbeat.payload.license_id, 'lic-revoke-1');
  assert.equal(heartbeat.metadata.scenario, 'heartbeat');

  const revoked = service.checkRevocation({
    source: 'unit-test',
    update: {
      revoked: true,
      reason: 'manual-revoke',
      licenseId: 'lic-revoke-1',
      remoteStatus: 'revoked-by-admin',
    },
  });

  assert.equal(fs.existsSync(runtimeConfig.authorization.revocationStatePath), true);
  assert.equal(revoked.revocation.revoked, true);
  assert.equal(revoked.status.valid, false);
  assert.equal(revoked.status.reason, 'license-revoked');
});

test('license service falls back to internal mode when enforcement disabled', () => {
  const service = new LicenseService({
    runtimeConfig: {
      projectSlug: 'agentx-3.0',
      projectVersion: '0.1.0-test',
      authorization: {
        requireLicense: false,
        licenseDir: '',
        publicKeyPath: '',
        licensePath: '',
        activationRecordPath: '',
        activationBackupDir: '',
        heartbeatStatePath: '',
        heartbeatMode: 'local-stub',
        heartbeatIntervalMinutes: 30,
        revocationStatePath: '',
        revocationMode: 'local-stub',
        fingerprintSalt: 'test-salt',
        defaultGracePeriodHours: 72,
      },
    },
  });

  const status = service.getStatus({ refresh: true });
  assert.equal(status.valid, true);
  assert.equal(status.edition, 'internal');
  assert.equal(service.assertCapability('remoteExec').allowed, true);
  assert.equal(service.getFingerprintReport().fingerprint.startsWith('sha256:'), true);
});
