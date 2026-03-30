import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = fs.existsSync(packageJsonPath)
  ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  : {};
const workspaceRoot = process.env.OPENCLAW_WORKSPACE_ROOT
  ? path.resolve(process.env.OPENCLAW_WORKSPACE_ROOT)
  : path.resolve(projectRoot, '..');

const bindHost = process.env.HOST || '127.0.0.1';
const allowLanBinding = process.env.ALLOW_LAN_BINDING === 'true';
const licenseDir = process.env.AGENTX_LICENSE_DIR || path.join(projectRoot, '.data', 'license');

export const config = {
  projectRoot,
  workspaceRoot,
  workspaceSkillsDir: path.join(workspaceRoot, 'skills'),
  dataDir: path.join(projectRoot, '.data'),
  publicDir: path.join(projectRoot, 'public'),
  generatedDir: path.join(projectRoot, '.data', 'generated'),
  projectSlug: 'agentx-3.0',
  projectDisplayName: '人体智能体协作模式-多智能体架构系统',
  productName: '人体智能体协作模式-多智能体架构系统',
  projectVersion: packageJson.version || '0.0.0',
  solutionPackageFormat: 'agentx-solution-package',
  solutionPackageSchemaVersion: 5,
  skillPackFormat: 'openclaw-skill-pack',
  skillPackSchemaVersion: 3,
  generatedSkillFormat: 'agentx-generated-skill',
  generatedSkillSchemaVersion: 3,
  skillCompatibilityTarget: 'openclaw-workspace-skill-loader-v1',
  skillInstallStrategy: 'managed-auto-install-with-verification',
  generatedSkillNamespace: process.env.GENERATED_SKILL_NAMESPACE || 'agentx-3-generated',
  autoInstallSkillPacks: process.env.AUTO_INSTALL_SKILL_PACKS !== 'false',
  host: bindHost,
  port: Number(process.env.PORT || 4330),
  maxSubtaskDepth: Number(process.env.MAX_SUBTASK_DEPTH || 1),
  autoRunSubtasks: process.env.AUTO_RUN_SUBTASKS !== 'false',
  networkSecurity: {
    allowLanBinding,
    federationPlane: process.env.FEDERATION_PLANE || 'local-runtime',
    outboundMode: process.env.OUTBOUND_MODE || 'tool-mediated-and-approval-gated',
    secretsMode: process.env.SECRETS_MODE || 'env-and-runtime-only',
    riskyNetworkKeywords: [
      'deploy', 'publish', 'send', 'webhook', '鍏綉', 'public', 'remote', 'ssh', 'http', 'https', 'api', 'internet', 'tunnel', 'socket', 'expose', 'bind', 'port',
    ],
  },
  authorization: {
    requireLicense: process.env.AGENTX_REQUIRE_LICENSE === 'true',
    licenseDir,
    licensePath: process.env.AGENTX_LICENSE_PATH || path.join(licenseDir, 'agentx-license.json'),
    publicKeyPath: process.env.AGENTX_LICENSE_PUBLIC_KEY || path.join(licenseDir, 'agentx-license-public.pem'),
    activationRecordPath: process.env.AGENTX_LICENSE_ACTIVATION_RECORD || path.join(licenseDir, 'activation.json'),
    activationBackupDir: process.env.AGENTX_LICENSE_BACKUP_DIR || path.join(licenseDir, 'backups'),
    heartbeatStatePath: process.env.AGENTX_LICENSE_HEARTBEAT_STATE || path.join(licenseDir, 'heartbeat.json'),
    heartbeatMode: process.env.AGENTX_LICENSE_HEARTBEAT_MODE || 'local-stub',
    heartbeatIntervalMinutes: Number(process.env.AGENTX_LICENSE_HEARTBEAT_MINUTES || 30),
    revocationStatePath: process.env.AGENTX_LICENSE_REVOCATION_STATE || path.join(licenseDir, 'revocation.json'),
    revocationMode: process.env.AGENTX_LICENSE_REVOCATION_MODE || 'local-stub',
    fingerprintSalt: process.env.AGENTX_FINGERPRINT_SALT || 'agentx-3.0-fingerprint-salt',
    defaultGracePeriodHours: Number(process.env.AGENTX_LICENSE_GRACE_HOURS || 72),
  },
};

