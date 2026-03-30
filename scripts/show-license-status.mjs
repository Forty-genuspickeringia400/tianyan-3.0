import { config } from '../src/config.js';
import { LicenseService } from '../src/security/license-service.js';

const service = new LicenseService({ runtimeConfig: config });
console.log(JSON.stringify({ license: service.getHomeReport() }, null, 2));
