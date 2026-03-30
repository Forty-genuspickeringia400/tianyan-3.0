#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const skillRoot = path.resolve(__dirname, '..');
const refsRoot = path.join(skillRoot, 'references', 'package');
const skillMetaPath = path.join(skillRoot, 'skill.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath, base));
    } else {
      files.push(path.relative(base, fullPath).replaceAll('\\', '/'));
    }
  }
  return files.sort();
}

function printHelp() {
  console.log(JSON.stringify({
    skill: "produce-a-test-strategy-for-build-a-seven",
    commands: ['summary', 'files', 'manifest', 'read <relativePath>'],
    references_root: 'references/package'
  }, null, 2));
}

const [command, ...args] = process.argv.slice(2);
if (!command || ["help", "--help", "-h"].includes(command)) {
  printHelp();
  process.exit(0);
}

const skillMeta = readJson(skillMetaPath);

if (command === 'summary') {
  console.log(JSON.stringify(skillMeta, null, 2));
  process.exit(0);
}

if (command === 'files') {
  console.log(JSON.stringify({ files: walk(refsRoot) }, null, 2));
  process.exit(0);
}

if (command === 'manifest') {
  const manifestPath = path.join(refsRoot, 'index.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(JSON.stringify({ ok: false, error: 'index.json not found in references/package' }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(readJson(manifestPath), null, 2));
  process.exit(0);
}

if (command === 'read') {
  const relativePath = String(args[0] || '').trim();
  if (!relativePath) {
    console.error(JSON.stringify({ ok: false, error: 'Missing relative path' }, null, 2));
    process.exit(1);
  }
  const filePath = path.resolve(refsRoot, relativePath);
  if (!filePath.startsWith(refsRoot) || !fs.existsSync(filePath)) {
    console.error(JSON.stringify({ ok: false, error: `Reference not found: ${relativePath}` }, null, 2));
    process.exit(1);
  }
  console.log(fs.readFileSync(filePath, 'utf8'));
  process.exit(0);
}

console.error(JSON.stringify({ ok: false, error: `Unknown command: ${command}` }, null, 2));
process.exit(1);