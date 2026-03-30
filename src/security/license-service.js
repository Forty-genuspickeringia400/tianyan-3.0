import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSort(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableSort(value));
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function safeReadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureParentDir(filePath) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, value) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function listMacAddresses() {
  const interfaces = os.networkInterfaces();
  const macs = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || !entry.mac || entry.mac === '00:00:00:00:00:00') continue;
      macs.push(entry.mac.toLowerCase());
    }
  }

  return [...new Set(macs)].sort();
}

function buildDefaultCapabilities() {
  return {
    chat: true,
    basicWorkflows: true,
    skillInstall: true,
    taskControl: true,
    backgroundRun: true,
    evolutionAdmin: true,
    remoteExec: true,
    federation: true,
    selfUpdate: true,
    configAdmin: true,
    systemPromptView: true,
    skillExport: true,
    auditView: true,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function parseLicenseInput(input) {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('license-payload-required');
    return JSON.parse(trimmed);
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('license-payload-required');
  }

  return structuredClone(input);
}

const EDITION_DEFAULTS = {
  'friend-basic': {
    chat: true,
    basicWorkflows: true,
    skillInstall: false,
    taskControl: true,
    backgroundRun: false,
    evolutionAdmin: false,
    remoteExec: false,
    federation: false,
    selfUpdate: false,
    configAdmin: false,
    systemPromptView: false,
    skillExport: false,
    auditView: true,
  },
  'friend-pro': {
    chat: true,
    basicWorkflows: true,
    skillInstall: true,
    taskControl: true,
    backgroundRun: true,
    evolutionAdmin: false,
    remoteExec: false,
    federation: false,
    selfUpdate: false,
    configAdmin: false,
    systemPromptView: false,
    skillExport: false,
    auditView: true,
  },
  internal: buildDefaultCapabilities(),
};

export class LicenseService {
  constructor({ runtimeConfig }) {
    this.runtimeConfig = runtimeConfig;
    this.authorization = runtimeConfig.authorization;
    this.cachedStatus = null;
    this.cachedFingerprint = null;
    this.cachedRevocationState = null;
    this.cachedHeartbeatState = null;
  }

  clearCache() {
    this.cachedStatus = null;
    this.cachedRevocationState = null;
    this.cachedHeartbeatState = null;
  }

  getFingerprintFields() {
    const cpus = os.cpus() || [];
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: cpus[0]?.model || 'unknown',
      cpuCount: cpus.length,
      totalMemGb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      macs: listMacAddresses(),
      computerName: process.env.COMPUTERNAME || '',
      processorIdentifier: process.env.PROCESSOR_IDENTIFIER || '',
      systemDrive: process.env.SystemDrive || process.env.SYSTEMDRIVE || '',
      userDomain: process.env.USERDOMAIN || '',
    };
  }

  getDeviceFingerprint() {
    if (this.cachedFingerprint) return this.cachedFingerprint;
    const fields = this.getFingerprintFields();
    const payload = stableStringify(fields);
    const salt = this.authorization.fingerprintSalt || 'agentx-3.0-default-salt';
    const digest = sha256(`${salt}:${payload}`);
    this.cachedFingerprint = `sha256:${digest}`;
    return this.cachedFingerprint;
  }

  getFingerprintReport() {
    return {
      fingerprint: this.getDeviceFingerprint(),
      fields: this.getFingerprintFields(),
      generated_at: nowIso(),
      algorithm: 'sha256',
      license_path: this.authorization.licensePath,
      require_license: !!this.authorization.requireLicense,
      activation: {
        api_endpoint: '/api/license/activate',
        recommended_script: 'npm run license:fingerprint',
      },
    };
  }

  getEditionDefaults(edition = 'internal') {
    return { ...buildDefaultCapabilities(), ...(EDITION_DEFAULTS[edition] || {}) };
  }

  getInternalStatus() {
    return {
      mode: 'internal-bypass',
      enforced: false,
      valid: true,
      edition: 'internal',
      reason: 'License enforcement is disabled for the current runtime.',
      fingerprint: this.getDeviceFingerprint(),
      capabilities: this.getEditionDefaults('internal'),
      license: null,
      revocation: {
        mode: 'internal-bypass',
        revoked: false,
        reason: 'internal-bypass',
        checked_at: null,
        license_id: null,
        source: null,
      },
      checkedAt: nowIso(),
    };
  }

  getPublicKey() {
    const keyPath = this.authorization.publicKeyPath;
    if (!keyPath || !fs.existsSync(keyPath)) return null;
    return fs.readFileSync(keyPath, 'utf8');
  }

  loadLicense() {
    return safeReadJson(this.authorization.licensePath);
  }

  loadRevocationState() {
    return safeReadJson(this.authorization.revocationStatePath);
  }

  loadHeartbeatState() {
    return safeReadJson(this.authorization.heartbeatStatePath);
  }

  getRevocationState({ refresh = false } = {}) {
    if (!refresh && this.cachedRevocationState) return this.cachedRevocationState;

    const stored = this.loadRevocationState();
    this.cachedRevocationState = stored || {
      mode: this.authorization.revocationMode || 'local-stub',
      revoked: false,
      reason: 'not-checked',
      checked_at: null,
      license_id: null,
      source: null,
      policy_version: null,
      remote_status: null,
    };
    return this.cachedRevocationState;
  }

  getRevocationVerdict(license, { refresh = false } = {}) {
    const state = this.getRevocationState({ refresh });
    const licenseId = license?.licenseId || null;
    const applies = !state.license_id || !licenseId || state.license_id === licenseId;
    const revoked = !!state.revoked && applies;

    return {
      mode: state.mode || this.authorization.revocationMode || 'local-stub',
      revoked,
      applies,
      reason: revoked
        ? state.reason || 'license-revoked'
        : state.reason || (state.checked_at ? 'not-revoked' : 'not-checked'),
      checked_at: state.checked_at || null,
      license_id: state.license_id || null,
      source: state.source || null,
      policy_version: state.policy_version || null,
      remote_status: state.remote_status || null,
    };
  }

  buildSignedPayload(license) {
    const clone = structuredClone(license);
    delete clone.signature;
    return stableStringify(clone);
  }

  verifySignature(license) {
    if (!license?.signature) return { ok: false, reason: 'missing-signature' };
    const publicKey = this.getPublicKey();
    if (!publicKey) return { ok: false, reason: 'missing-public-key' };

    try {
      const payload = Buffer.from(this.buildSignedPayload(license), 'utf8');
      const signature = Buffer.from(license.signature, 'base64');
      const ok = crypto.verify(null, payload, publicKey, signature);
      return { ok, reason: ok ? 'verified' : 'invalid-signature' };
    } catch (error) {
      return { ok: false, reason: `verify-error:${error.message}` };
    }
  }

  resolveCapabilities(license) {
    return {
      ...this.getEditionDefaults(license?.edition || 'friend-basic'),
      ...(license?.capabilities || {}),
    };
  }

  evaluateLicense(license, { refreshRevocation = false } = {}) {
    const now = Date.now();
    const fingerprint = this.getDeviceFingerprint();
    const signature = this.verifySignature(license);
    const expiresAtMs = license?.expiresAt ? Date.parse(license.expiresAt) : NaN;
    const gracePeriodHours = Number(license?.gracePeriodHours ?? this.authorization.defaultGracePeriodHours);
    const graceExpiresAtMs = Number.isFinite(expiresAtMs)
      ? expiresAtMs + (gracePeriodHours * 60 * 60 * 1000)
      : NaN;
    const allowedFingerprints = Array.isArray(license?.deviceFingerprints) ? license.deviceFingerprints : [];
    const fingerprintMatched = !allowedFingerprints.length || allowedFingerprints.includes(fingerprint);
    const revocation = this.getRevocationVerdict(license, { refresh: refreshRevocation });

    if (!signature.ok) {
      return {
        mode: 'licensed',
        enforced: true,
        valid: false,
        reason: signature.reason,
        edition: license?.edition || 'unknown',
        fingerprint,
        fingerprintMatched,
        capabilities: this.resolveCapabilities(license),
        license,
        revocation,
        checkedAt: nowIso(),
      };
    }

    if (!fingerprintMatched) {
      return {
        mode: 'licensed',
        enforced: true,
        valid: false,
        reason: 'device-fingerprint-mismatch',
        edition: license?.edition || 'unknown',
        fingerprint,
        fingerprintMatched,
        capabilities: this.resolveCapabilities(license),
        license,
        revocation,
        checkedAt: nowIso(),
      };
    }

    if (revocation.revoked) {
      return {
        mode: 'licensed',
        enforced: true,
        valid: false,
        reason: 'license-revoked',
        edition: license?.edition || 'unknown',
        fingerprint,
        fingerprintMatched,
        capabilities: this.resolveCapabilities(license),
        license,
        revocation,
        checkedAt: nowIso(),
      };
    }

    if (Number.isFinite(expiresAtMs) && now > graceExpiresAtMs) {
      return {
        mode: 'licensed',
        enforced: true,
        valid: false,
        reason: 'license-expired',
        edition: license?.edition || 'unknown',
        fingerprint,
        fingerprintMatched,
        capabilities: this.resolveCapabilities(license),
        license,
        revocation,
        checkedAt: nowIso(),
      };
    }

    const inGrace = Number.isFinite(expiresAtMs) && now > expiresAtMs && now <= graceExpiresAtMs;

    return {
      mode: 'licensed',
      enforced: true,
      valid: true,
      inGrace,
      reason: inGrace ? 'license-grace-period' : 'license-active',
      edition: license?.edition || 'unknown',
      fingerprint,
      fingerprintMatched,
      capabilities: this.resolveCapabilities(license),
      license,
      revocation,
      checkedAt: nowIso(),
    };
  }

  getStatus({ refresh = false } = {}) {
    if (!refresh && this.cachedStatus) return this.cachedStatus;

    if (!this.authorization.requireLicense) {
      this.cachedStatus = this.getInternalStatus();
      return this.cachedStatus;
    }

    const license = this.loadLicense();
    if (!license) {
      this.cachedStatus = {
        mode: 'licensed',
        enforced: true,
        valid: false,
        reason: 'missing-license-file',
        edition: 'unknown',
        fingerprint: this.getDeviceFingerprint(),
        fingerprintMatched: false,
        capabilities: this.getEditionDefaults('friend-basic'),
        license: null,
        revocation: this.getRevocationVerdict(null, { refresh }),
        checkedAt: nowIso(),
      };
      return this.cachedStatus;
    }

    this.cachedStatus = this.evaluateLicense(license, { refreshRevocation: refresh });
    return this.cachedStatus;
  }

  backupCurrentLicense() {
    const currentPath = this.authorization.licensePath;
    if (!currentPath || !fs.existsSync(currentPath)) return null;

    const backupDir = this.authorization.activationBackupDir;
    ensureParentDir(path.join(backupDir, '.keep'));
    const stamp = nowIso().replaceAll(':', '-').replaceAll('.', '-');
    const backupPath = path.join(backupDir, `agentx-license-${stamp}.json`);
    fs.copyFileSync(currentPath, backupPath);
    return backupPath;
  }

  activateLicense(licenseInput, { source = 'local-import' } = {}) {
    const license = parseLicenseInput(licenseInput);
    const evaluation = this.evaluateLicense(license, { refreshRevocation: true });
    if (!evaluation.valid) {
      throw new Error(`license-activation-rejected:${evaluation.reason}`);
    }

    const backupPath = this.backupCurrentLicense();
    writeJson(this.authorization.licensePath, license);

    const activation = {
      mode: 'local-license-import',
      source,
      activated_at: nowIso(),
      license_id: license.licenseId || null,
      edition: license.edition || 'unknown',
      owner_name: license.ownerName || null,
      fingerprint: this.getDeviceFingerprint(),
      backup_path: backupPath,
      license_path: this.authorization.licensePath,
      runtime_enforcement_active: !!this.authorization.requireLicense,
      verification: {
        valid: evaluation.valid,
        reason: evaluation.reason,
        fingerprint_matched: !!evaluation.fingerprintMatched,
        revocation_checked_at: evaluation.revocation?.checked_at || null,
      },
    };

    writeJson(this.authorization.activationRecordPath, activation);
    this.clearCache();

    return {
      ok: true,
      activation,
      evaluation,
      status: this.getStatus({ refresh: true }),
    };
  }

  buildHeartbeatPayload(status = this.getStatus({ refresh: true })) {
    return {
      project: this.runtimeConfig.projectSlug,
      version: this.runtimeConfig.projectVersion,
      fingerprint: status.fingerprint,
      license_id: status.license?.licenseId || null,
      edition: status.edition,
      valid: status.valid,
      reason: status.reason,
      checked_at: status.checkedAt,
      capabilities: status.capabilities,
    };
  }

  getHeartbeatState({ refresh = false } = {}) {
    if (!refresh && this.cachedHeartbeatState) return this.cachedHeartbeatState;

    const stored = this.loadHeartbeatState();
    this.cachedHeartbeatState = stored || {
      mode: this.authorization.heartbeatMode || 'local-stub',
      checked_at: null,
      next_check_after: null,
      source: null,
      payload_preview: this.buildHeartbeatPayload(this.getStatus({ refresh: true })),
      remote: null,
      metadata: null,
    };
    return this.cachedHeartbeatState;
  }

  recordHeartbeat({ source = 'local-api', remote = null, metadata = null } = {}) {
    const status = this.getStatus({ refresh: true });
    const checkedAt = nowIso();
    const nextCheckAfter = new Date(Date.now() + (this.authorization.heartbeatIntervalMinutes * 60 * 1000)).toISOString();
    const heartbeat = {
      mode: this.authorization.heartbeatMode || 'local-stub',
      source,
      checked_at: checkedAt,
      next_check_after: nextCheckAfter,
      payload: this.buildHeartbeatPayload(status),
      remote,
      metadata,
    };

    writeJson(this.authorization.heartbeatStatePath, heartbeat);
    this.cachedHeartbeatState = heartbeat;
    return heartbeat;
  }

  checkRevocation({ source = 'local-api', update = null } = {}) {
    const status = this.getStatus({ refresh: true });
    const licenseId = update?.licenseId ?? update?.license_id ?? status.license?.licenseId ?? null;

    if (update && typeof update === 'object') {
      const nextState = {
        mode: update.mode || this.authorization.revocationMode || 'local-stub',
        source,
        revoked: !!update.revoked,
        reason: update.reason || (update.revoked ? 'license-revoked' : 'not-revoked'),
        checked_at: update.checkedAt || update.checked_at || nowIso(),
        license_id: licenseId,
        policy_version: update.policyVersion ?? update.policy_version ?? null,
        remote_status: update.remoteStatus ?? update.remote_status ?? null,
      };
      writeJson(this.authorization.revocationStatePath, nextState);
      this.cachedRevocationState = nextState;
    }

    this.cachedStatus = null;
    const refreshed = this.getStatus({ refresh: true });
    return {
      revocation: this.getRevocationVerdict(refreshed.license || status.license, { refresh: true }),
      status: refreshed,
    };
  }

  assertCapability(capability) {
    const status = this.getStatus();
    const allowed = !!status.capabilities?.[capability] && status.valid;
    return {
      allowed,
      status,
      capability,
      reason: allowed ? 'allowed' : `${status.reason}:${capability}`,
    };
  }

  getHomeReport() {
    const status = this.getStatus();
    const heartbeat = this.getHeartbeatState();
    return {
      mode: status.mode,
      enforced: status.enforced,
      valid: status.valid,
      in_grace: !!status.inGrace,
      edition: status.edition,
      reason: status.reason,
      fingerprint: status.fingerprint,
      fingerprint_matched: !!status.fingerprintMatched,
      license_id: status.license?.licenseId || null,
      expires_at: status.license?.expiresAt || null,
      allowed_devices: status.license?.allowedDevices ?? null,
      owner_name: status.license?.ownerName || null,
      capabilities: status.capabilities,
      checked_at: status.checkedAt,
      revocation: status.revocation,
      heartbeat: {
        checked_at: heartbeat.checked_at || null,
        next_check_after: heartbeat.next_check_after || null,
        source: heartbeat.source || null,
        mode: heartbeat.mode || this.authorization.heartbeatMode || 'local-stub',
      },
    };
  }
}
