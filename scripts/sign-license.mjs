import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

const [licensePathArg, privateKeyPathArg, outPathArg] = process.argv.slice(2);
if (!licensePathArg || !privateKeyPathArg) {
  console.error('Usage: node scripts/sign-license.mjs <license.json> <private-key.pem> [out.json]');
  process.exit(1);
}

const licensePath = path.resolve(licensePathArg);
const privateKeyPath = path.resolve(privateKeyPathArg);
const outPath = outPathArg ? path.resolve(outPathArg) : licensePath;

const license = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
delete license.signature;
const payload = Buffer.from(stableStringify(license), 'utf8');
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const signature = crypto.sign(null, payload, privateKey).toString('base64');
const signed = { ...license, signature };

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(signed, null, 2), 'utf8');

console.log(JSON.stringify({ ok: true, outPath }, null, 2));
