import { config } from '../src/config.js';
import { LicenseService } from '../src/security/license-service.js';

const service = new LicenseService({ runtimeConfig: config });
const report = service.getFingerprintReport();
const valueOnly = process.argv.includes('--value') || process.argv.includes('--fingerprint-only');

if (valueOnly) {
  console.log(report.fingerprint);
} else {
  console.log(JSON.stringify(report, null, 2));
}
