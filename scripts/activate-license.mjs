import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';
import { LicenseService } from '../src/security/license-service.js';

const [licensePathArg] = process.argv.slice(2);
if (!licensePathArg) {
  console.error('Usage: node scripts/activate-license.mjs <signed-license.json>');
  process.exit(1);
}

const licensePath = path.resolve(licensePathArg);
if (!fs.existsSync(licensePath)) {
  console.error(`License file not found: ${licensePath}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
const service = new LicenseService({ runtimeConfig: config });
const result = service.activateLicense(payload, { source: 'local-cli' });
console.log(JSON.stringify({
  ok: result.ok,
  license_path: config.authorization.licensePath,
  activation: result.activation,
  status: service.getHomeReport(),
}, null, 2));
