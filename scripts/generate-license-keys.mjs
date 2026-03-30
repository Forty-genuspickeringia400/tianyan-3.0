import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const outDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), '.keys');

fs.mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicPem = publicKey.export({ format: 'pem', type: 'spki' });
const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' });

fs.writeFileSync(path.join(outDir, 'agentx-license-public.pem'), publicPem, 'utf8');
fs.writeFileSync(path.join(outDir, 'agentx-license-private.pem'), privatePem, 'utf8');

console.log(JSON.stringify({
  ok: true,
  outDir,
  publicKeyPath: path.join(outDir, 'agentx-license-public.pem'),
  privateKeyPath: path.join(outDir, 'agentx-license-private.pem'),
}, null, 2));
