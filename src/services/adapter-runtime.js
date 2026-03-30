import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { buildArtifactVersion, buildSkillVersionMetadata } from '../product/version-metadata.js';

const execFileAsync = promisify(execFile);

function buildInvocation(command, args = []) {
  if (process.platform === 'win32' && command === 'npm') {
    return {
      file: 'cmd.exe',
      args: ['/d', '/s', '/c', `npm ${args.join(' ')}`.trim()],
    };
  }

  return {
    file: command,
    args,
  };
}

function resolveTaskDir(taskId) {
  return path.join(config.generatedDir, taskId);
}

async function listFilesRecursive(dir, baseDir = dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await listFilesRecursive(fullPath, baseDir));
      } else {
        files.push({
          fullPath,
          relativePath: path.relative(baseDir, fullPath).replaceAll('\\', '/'),
          name: entry.name,
        });
      }
    }

    return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  } catch {
    return [];
  }
}

let crcTable;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

function crc32(buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(dateInput = new Date()) {
  const date = new Date(dateInput);
  const safeYear = Math.max(1980, date.getFullYear() || 1980);
  const dosTime = ((date.getHours() & 0x1f) << 11)
    | ((date.getMinutes() & 0x3f) << 5)
    | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate = (((safeYear - 1980) & 0x7f) << 9)
    | (((date.getMonth() + 1) & 0x0f) << 5)
    | (date.getDate() & 0x1f);
  return { dosTime, dosDate };
}

function buildZipArchive(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(String(entry.name).replaceAll('\\', '/'));
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '');
    const { dosTime, dosDate } = toDosDateTime(entry.mtime);
    const checksum = crc32(dataBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, nameBuffer, dataBuffer);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectorySize, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

function inferFileType(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === '.md') return 'markdown';
  if (ext === '.json') return 'json';
  if (ext === '.txt') return 'text';
  if (ext === '.zip') return 'zip';
  if (ext === '.skill') return 'skill-archive';
  return ext ? ext.slice(1) : 'file';
}

function canPreviewFile(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  return ['.md', '.json', '.txt'].includes(ext);
}

function buildTaskFileUrls(taskId, relativePath) {
  const encodedPath = encodeURIComponent(relativePath);
  return {
    preview_url: canPreviewFile(relativePath)
      ? `/api/tasks/${taskId}/file?path=${encodedPath}`
      : null,
    download_url: `/api/tasks/${taskId}/download-file?path=${encodedPath}`,
  };
}

function safeSnippet(text, max = 160) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return 'structured delivery task';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function slugifySkillName(text, fallback = 'agentx-skill-pack') {
  const ascii = String(text || '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  const core = ascii || fallback;
  const shortened = core.split('-').filter(Boolean).slice(0, 8).join('-');
  return shortened || fallback;
}

function buildSkillPackIdentity(task) {
  const suffix = String(task.task_id || 'skill').slice(-6).toLowerCase();
  const skillSlug = slugifySkillName(task.goal, 'agentx-skill-pack');
  const artifactVersion = buildArtifactVersion(task);
  const archiveName = `${skillSlug}-${artifactVersion}.skill`;
  const description = `Generated by ${config.projectDisplayName} ${config.projectVersion} from task ${task.task_id}. Use when the user needs the packaged delivery flow for: ${safeSnippet(task.goal, 120)}`;

  return {
    skillSlug,
    artifactVersion,
    archiveName,
    displayName: `${config.projectDisplayName} Skill Pack · ${suffix}`,
    description,
    installReadme: 'skill-pack/README.md',
    skillPackIndex: 'skill-pack/index.json',
    skillPackManifest: 'skill-pack/manifest.json',
    archive: `skill-pack/${archiveName}`,
    directory: `skill-pack/${skillSlug}`,
    skillMd: `skill-pack/${skillSlug}/SKILL.md`,
    skillJson: `skill-pack/${skillSlug}/skill.json`,
    helperScript: `skill-pack/${skillSlug}/scripts/${skillSlug}.js`,
    referencesRoot: `skill-pack/${skillSlug}/references/package`,
  };
}

function buildBundleReadme(task, stats, skillPack) {
  const versioning = buildSkillVersionMetadata(task, skillPack?.skillSlug || null);
  const lines = [
    `# ${config.projectDisplayName} Solution Package`,
    '',
    '这是一份面向客户交付、团队接手、以及 OpenClaw skill/runtime 集成的 solution package。',
    '',
    '## Delivery Summary',
    '',
    `- task_id: ${task.task_id}`,
    `- goal: ${task.goal}`,
    `- product_track: ${task.product_track || 'runtime-studio'}`,
    `- generated_at: ${stats.generatedAt}`,
    `- source_file_count: ${stats.sourceFileCount}`,
    `- markdown_count: ${stats.markdownCount}`,
    `- release_version: ${versioning.release_version}`,
    `- artifact_version: ${versioning.artifact_version}`,
    `- package_schema_version: ${versioning.solution_package.schema_version}`,
    `- skill_pack_ready: ${skillPack ? 'yes' : 'no'}`,
    '',
    '## Versioning / Compatibility',
    '',
    `- release_version: ${versioning.release_version}`,
    `- artifact_version: ${versioning.artifact_version}`,
    `- solution_package: ${versioning.solution_package.format}@${versioning.solution_package.schema_version}`,
    `- generated_skill_pack: ${versioning.skill_pack.format}@${versioning.skill_pack.schema_version}`,
    `- install_strategy: ${versioning.install_strategy.mode}`,
    `- compatibility_target: ${versioning.compatibility.openclaw_loader}`,
    '',
    '## What Is Included',
    '',
    '- 产品简述、skill 蓝图、runtime playbook、架构、接口、测试与实施计划',
    '- 一份汇总后的 bundle markdown',
    '- 一份适合程序读取的索引文件与完整 manifest',
    '- 一份可直接下载转交的 zip package',
  ];

  if (skillPack) {
    lines.push('- 一份可安装的 OpenClaw skill 目录与 `.skill` 分发包');
  }

  lines.push(
    '',
    '## Quick Start',
    '',
    '1. 第一次接手：先读本文件。',
    '2. 想快速看完整交付：读 `bundle/bundle.md`。',
    '3. 想做集成：读 `index.json` 与 `bundle/manifest.json`。',
    skillPack
      ? `4. 想做 OpenClaw skill 安装：读 \`${skillPack.installReadme}\`，再下载 \`${skillPack.archive}\`.`
      : '4. 想做 OpenClaw skill 化：优先读 `skill-blueprint.md`。',
    '',
    '## Package Entry Files',
    '',
    '- `README.md`：人类优先入口，适合客户交付 / 团队交接',
    '- `index.json`：机器优先入口，适合自动化工具 / 程序读取',
    '- `bundle/bundle.md`：汇总版 markdown 交付物',
    '- `bundle/manifest.json`：完整文件索引、下载入口、元数据',
    '- `bundle/bundle.zip`：完整可下载打包文件',
  );

  if (skillPack) {
    lines.push(
      '- `skill-pack/README.md`：skill 安装说明',
      '- `skill-pack/index.json`：skill-pack 机器入口',
      '- `skill-pack/manifest.json`：skill-pack 完整索引',
      '- `skill-pack/installation.json`：自动安装与验收回执',
      `- \`${skillPack.skillMd}\`：最终 SKILL.md`,
      `- \`${skillPack.archive}\`：可分发的 .skill 文件`,
    );
  }

  lines.push(
    '',
    '## Recommended Reading Paths',
    '',
    '### 给客户 / 负责人',
    '- `product-brief.md`',
    '- `bundle/bundle.md`',
    '',
    '### 给产品 / 架构 / 研发接手人',
    '- `product-brief.md`',
    '- `skill-blueprint.md`',
    '- `runtime-playbook.md`',
    '- `architecture-outline.md`',
    '- `api-contract.md`',
    '- `test-strategy.md`',
    '- `implementation-plan.md`',
    '',
    '### 给自动化系统 / 二次处理脚本',
    '- `index.json`',
    '- `bundle/manifest.json`',
  );

  if (skillPack) {
    lines.push('', '### 给 OpenClaw skill 安装者', `- \`${skillPack.installReadme}\``, `- \`${skillPack.skillMd}\``);
  }

  lines.push(
    '',
    '## Upgrade Path',
    '',
    ...versioning.upgrade_path.steps.map((step) => `- ${step}`),
    '',
    '## Handoff Notes',
    '',
    '- `bundle/bundle.md` 适合一次性阅读和转发',
    '- `bundle/manifest.json` 适合精确定位单文件、下载入口和 zip 内路径',
    '- 这份 package 可同时作为 runtime 交付包与 skill 打样包',
  );

  return lines.join('\n');
}

function buildBundleIndex(task, stats, skillPack) {
  const versioning = buildSkillVersionMetadata(task, skillPack?.skillSlug || null);

  return {
    package_format: config.solutionPackageFormat,
    package_version: config.solutionPackageSchemaVersion,
    task_id: task.task_id,
    goal: task.goal,
    product_track: task.product_track || 'runtime-studio',
    generated_at: stats.generatedAt,
    project_slug: config.projectSlug,
    project_display_name: config.projectDisplayName,
    product_name: config.productName,
    zip_root: task.task_id,
    versioning,
    entrypoints: {
      readme: 'README.md',
      index: 'index.json',
      bundle_markdown: 'bundle/bundle.md',
      manifest: 'bundle/manifest.json',
      bundle_zip: 'bundle/bundle.zip',
      skill_pack: skillPack
        ? {
            readme: skillPack.installReadme,
            index: skillPack.skillPackIndex,
            manifest: skillPack.skillPackManifest,
            directory: skillPack.directory,
            skill_md: skillPack.skillMd,
            skill_json: skillPack.skillJson,
            archive: skillPack.archive,
            installation_report: 'skill-pack/installation.json',
          }
        : null,
    },
    profiles: {
      runtime: 'runtime-studio',
      skill: 'skill-pack',
    },
    stats: {
      source_file_count: stats.sourceFileCount,
      markdown_count: stats.markdownCount,
    },
  };
}

function buildSkillPackReadme(task, identity, referenceFiles = []) {
  const versioning = buildSkillVersionMetadata(task, identity.skillSlug);

  return [
    `# ${identity.displayName}`,
    '',
    `This is an installable OpenClaw skill-pack exported directly by ${config.projectDisplayName} from the current task.`,
    '',
    '## Source Task',
    '',
    `- task_id: ${task.task_id}`,
    `- goal: ${task.goal}`,
    `- product_track: ${task.product_track || 'runtime-studio'}`,
    '',
    '## Versioning / Compatibility',
    '',
    `- release_version: ${versioning.release_version}`,
    `- artifact_version: ${versioning.artifact_version}`,
    `- skill_version: ${versioning.skill_pack.skill_version}`,
    `- format: ${versioning.skill_pack.format}@${versioning.skill_pack.schema_version}`,
    `- generated_skill_format: ${versioning.skill_pack.generated_skill_format}@${versioning.skill_pack.generated_skill_schema_version}`,
    `- install_layout: ${versioning.compatibility.install_layout}`,
    `- install_strategy: ${versioning.install_strategy.mode}`,
    '',
    '## Install',
    '',
    `1. 下载 \`${identity.archive}\`，或直接复制 \`${identity.directory}\` 目录。`,
    `2. 放入 OpenClaw 工作区的 \`${versioning.install_strategy.target_directory}\`。`,
    `3. 最终路径应类似：\`<workspace>/${versioning.install_strategy.target_directory}/SKILL.md\`。`,
    '4. 检查 `skill-pack/installation.json` 或安装目录内的 `.agentx-install.json`，确认验收通过。',
    '5. 让 OpenClaw 重新加载技能后即可使用。',
    '',
    '## Upgrade Path',
    '',
    ...versioning.upgrade_path.steps.map((step) => `- ${step}`),
    '',
    '## Entrypoints',
    '',
    `- install readme: \`${identity.installReadme}\``,
    `- package index: \`${identity.skillPackIndex}\``,
    `- skill-pack manifest: \`${identity.skillPackManifest}\``,
    `- installable directory: \`${identity.directory}\``,
    `- final SKILL.md: \`${identity.skillMd}\``,
    `- skill.json: \`${identity.skillJson}\``,
    `- helper script: \`${identity.helperScript}\``,
    '- installation receipt: `skill-pack/installation.json`',
    `- distribution archive: \`${identity.archive}\``,
    '',
    '## Suggested Reading Order',
    '',
    `1. \`${identity.skillMd}\``,
    `2. \`${identity.referencesRoot}/README.md\``,
    `3. \`${identity.referencesRoot}/bundle/bundle.md\``,
    `4. \`${identity.referencesRoot}/skill-blueprint.md\``,
    '',
    '## Included References',
    '',
    ...referenceFiles.map((relativePath) => `- \`${relativePath}\``),
  ].join('\n');
}

function buildGeneratedSkillMarkdown(task, identity, referenceFiles = []) {
  const versioning = buildSkillVersionMetadata(task, identity.skillSlug);
  const referenceLines = referenceFiles.slice(0, 12).map((item) => `- \`${item}\``).join('\n');
  const installTarget = versioning.install_strategy.target_directory;

  return [
    '---',
    `name: ${JSON.stringify(identity.skillSlug)}`,
    `description: ${JSON.stringify(identity.description)}`,
    '---',
    '',
    `# ${identity.displayName}`,
    '',
    `This OpenClaw skill was exported by ${config.projectDisplayName} so the current solution package can be installed and reused as a capability bundle.`,
    '',
    '## Versioning / Compatibility',
    '',
    `- release_version: ${versioning.release_version}`,
    `- skill_version: ${versioning.skill_pack.skill_version}`,
    `- install_layout: ${versioning.compatibility.install_layout}`,
    `- install_strategy: ${versioning.install_strategy.mode}`,
    '',
    '## Use this skill when',
    '',
    `- 用户的目标与这次任务接近：${safeSnippet(task.goal, 120)}`,
    '- 需要直接复用当前任务已经生成的文档、交付物、接口说明和操作说明',
    '- 需要一个可安装的 skill 目录或 `.skill` 分发包，而不是只看 bundle',
    '',
    '## Working workflow',
    '',
    `1. 先读 \`references/package/README.md\` 了解整体交付入口。`,
    `2. 再读 \`references/package/bundle/bundle.md\` 快速掌握完整内容。`,
    `3. 若要执行精确引用，继续读 \`references/package/index.json\` 与相关 markdown/json。`,
    `4. 如需确定性查看目录与内容，运行 \`scripts/${identity.skillSlug}.js\`。`,
    '',
    '## Helper script',
    '',
    '```bash',
    `node ${installTarget}/scripts/${identity.skillSlug}.js summary`,
    `node ${installTarget}/scripts/${identity.skillSlug}.js files`,
    `node ${installTarget}/scripts/${identity.skillSlug}.js read product-brief.md`,
    `node ${installTarget}/scripts/${identity.skillSlug}.js manifest`,
    '```',
    '',
    '## Upgrade Path',
    '',
    ...versioning.upgrade_path.steps.map((step) => `- ${step}`),
    '',
    '## Guardrails',
    '',
    '- 这个 skill 以交付物复用为主，不应假装自己拥有超出包内资料的实时能力。',
    `- If package data is insufficient, point out the gap first and suggest regenerating from ${config.projectDisplayName} runtime.`,
    '- 除非用户明确要求，不要自行扩展到未包含的外部执行动作。',
    '',
    '## References',
    '',
    referenceLines || '- `references/package/README.md`',
  ].join('\n');
}

function buildGeneratedSkillScript(identity) {
  return [
    '#!/usr/bin/env node',
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    '',
    "const skillRoot = path.resolve(__dirname, '..');",
    "const refsRoot = path.join(skillRoot, 'references', 'package');",
    "const skillMetaPath = path.join(skillRoot, 'skill.json');",
    '',
    'function readJson(filePath) {',
    "  return JSON.parse(fs.readFileSync(filePath, 'utf8'));",
    '}',
    '',
    'function walk(dir, base = dir) {',
    '  if (!fs.existsSync(dir)) return [];',
    '  const entries = fs.readdirSync(dir, { withFileTypes: true });',
    '  const files = [];',
    '  for (const entry of entries) {',
    '    const fullPath = path.join(dir, entry.name);',
    '    if (entry.isDirectory()) {',
    '      files.push(...walk(fullPath, base));',
    '    } else {',
    "      files.push(path.relative(base, fullPath).replaceAll('\\\\', '/'));",
    '    }',
    '  }',
    '  return files.sort();',
    '}',
    '',
    'function printHelp() {',
    '  console.log(JSON.stringify({',
    `    skill: ${JSON.stringify(identity.skillSlug)},`,
    "    commands: ['summary', 'files', 'manifest', 'read <relativePath>'],",
    "    references_root: 'references/package'",
    '  }, null, 2));',
    '}',
    '',
    "const [command, ...args] = process.argv.slice(2);",
    'if (!command || ["help", "--help", "-h"].includes(command)) {',
    '  printHelp();',
    '  process.exit(0);',
    '}',
    '',
    'const skillMeta = readJson(skillMetaPath);',
    '',
    "if (command === 'summary') {",
    '  console.log(JSON.stringify(skillMeta, null, 2));',
    '  process.exit(0);',
    '}',
    '',
    "if (command === 'files') {",
    '  console.log(JSON.stringify({ files: walk(refsRoot) }, null, 2));',
    '  process.exit(0);',
    '}',
    '',
    "if (command === 'manifest') {",
    "  const manifestPath = path.join(refsRoot, 'index.json');",
    '  if (!fs.existsSync(manifestPath)) {',
    "    console.error(JSON.stringify({ ok: false, error: 'index.json not found in references/package' }, null, 2));",
    '    process.exit(1);',
    '  }',
    '  console.log(JSON.stringify(readJson(manifestPath), null, 2));',
    '  process.exit(0);',
    '}',
    '',
    "if (command === 'read') {",
    "  const relativePath = String(args[0] || '').trim();",
    '  if (!relativePath) {',
    "    console.error(JSON.stringify({ ok: false, error: 'Missing relative path' }, null, 2));",
    '    process.exit(1);',
    '  }',
    '  const filePath = path.resolve(refsRoot, relativePath);',
    '  if (!filePath.startsWith(refsRoot) || !fs.existsSync(filePath)) {',
    "    console.error(JSON.stringify({ ok: false, error: `Reference not found: ${relativePath}` }, null, 2));",
    '    process.exit(1);',
    '  }',
    "  console.log(fs.readFileSync(filePath, 'utf8'));",
    '  process.exit(0);',
    '}',
    '',
    "console.error(JSON.stringify({ ok: false, error: `Unknown command: ${command}` }, null, 2));",
    'process.exit(1);',
  ].join('\n');
}

async function createArchiveFromDirectory(sourceDir, archivePath, archiveRootName) {
  const files = await listFilesRecursive(sourceDir, sourceDir);
  const entries = [];

  for (const file of files) {
    const [data, stat] = await Promise.all([
      fs.readFile(file.fullPath),
      fs.stat(file.fullPath),
    ]);
    entries.push({
      name: `${archiveRootName}/${file.relativePath}`,
      data,
      mtime: stat.mtime,
    });
  }

  const zipBuffer = buildZipArchive(entries);
  await fs.mkdir(path.dirname(archivePath), { recursive: true });
  await fs.writeFile(archivePath, zipBuffer);
  return archivePath;
}

async function buildFileDescriptor(taskId, relativePath, fullPath) {
  const stat = await fs.stat(fullPath);
  return {
    relative_path: relativePath,
    zip_path: `${taskId}/${relativePath}`,
    size_bytes: stat.size,
    updated_at: stat.mtime.toISOString(),
    type: inferFileType(relativePath),
    ...buildTaskFileUrls(taskId, relativePath),
    included_in_bundle: true,
  };
}

async function createBundleZip(taskId) {
  const dir = resolveTaskDir(taskId);
  const files = (await listFilesRecursive(dir))
    .filter((file) => file.relativePath !== 'bundle/bundle.zip');

  const entries = [];
  for (const file of files) {
    const [data, stat] = await Promise.all([
      fs.readFile(file.fullPath),
      fs.stat(file.fullPath),
    ]);
    entries.push({
      name: `${taskId}/${file.relativePath}`,
      data,
      mtime: stat.mtime,
    });
  }

  const zipBuffer = buildZipArchive(entries);
  const bundleDir = path.join(dir, 'bundle');
  await fs.mkdir(bundleDir, { recursive: true });
  const zipPath = path.join(bundleDir, 'bundle.zip');
  await fs.writeFile(zipPath, zipBuffer);
  return zipPath;
}

function shouldExportSkillPack(task, analysis = {}, sourceFiles = []) {
  return task.product_track === 'skill-pack'
    || (analysis.deliverables || []).includes('skill-blueprint')
    || sourceFiles.some((file) => file.relativePath === 'skill-blueprint.md' || file.relativePath === 'skill-blueprint.json');
}

async function writeSelfSizedManifest(manifestPath, buildManifest) {
  const statTime = new Date().toISOString();
  let entry = {
    relative_path: path.relative(path.dirname(path.dirname(manifestPath)), manifestPath).replaceAll('\\', '/'),
    zip_path: '',
    size_bytes: 0,
    updated_at: statTime,
    type: 'json',
    preview_url: null,
    download_url: null,
    included_in_bundle: true,
  };
  let manifestText = '';

  for (let index = 0; index < 8; index += 1) {
    const manifest = buildManifest(entry);
    manifestText = JSON.stringify(manifest, null, 2);
    const nextSize = Buffer.byteLength(manifestText, 'utf8');
    if (entry.size_bytes === nextSize) break;
    entry = {
      ...entry,
      size_bytes: nextSize,
      updated_at: new Date().toISOString(),
    };
  }

  await fs.writeFile(manifestPath, manifestText, 'utf8');
  return entry;
}

function buildSkillPackInstallationPlaceholder(task, identity, versioning, installMode) {
  return {
    managed_by: config.projectSlug,
    install_mode: installMode,
    attempted: false,
    installed: false,
    verified: false,
    accepted: false,
    status: 'pending',
    reason: config.autoInstallSkillPacks
      ? 'Auto install will run after skill-pack export completes.'
      : 'Auto install is disabled; use the install API to install and verify manually.',
    task_id: task.task_id,
    skill_name: identity.skillSlug,
    skill_display_name: identity.displayName,
    skill_version: versioning.skill_pack.skill_version,
    artifact_version: versioning.artifact_version,
    managed_relative_path: versioning.install_strategy.target_directory,
    installed_path: path.join(config.workspaceSkillsDir, versioning.install_strategy.target_directory.replace(/^skills\//, '')).replaceAll('\\', '/'),
    installed_at: null,
    backup_path: null,
    verification: {
      passed: false,
      score: 0,
      missing: ['Installation not executed yet'],
      warnings: [],
      checklist: [],
      verified_at: null,
      summary: 'Installation has not been executed yet.',
    },
  };
}

async function writeTaskInstallationReceipt(taskId, installation) {
  const receiptPath = path.join(resolveTaskDir(taskId), 'skill-pack', 'installation.json');
  await fs.mkdir(path.dirname(receiptPath), { recursive: true });
  await fs.writeFile(receiptPath, JSON.stringify(installation, null, 2), 'utf8');
  return receiptPath;
}

async function writeSkillPackMetadata(task, dir, identity, generatedAt, copiedReferences, versioning, installSteps, installation) {
  const skillPackReadmePath = path.join(dir, identity.installReadme);
  const skillPackIndexPath = path.join(dir, identity.skillPackIndex);
  const skillPackManifestPath = path.join(dir, identity.skillPackManifest);
  await fs.mkdir(path.dirname(skillPackReadmePath), { recursive: true });
  await fs.writeFile(skillPackReadmePath, buildSkillPackReadme(task, identity, copiedReferences), 'utf8');
  await writeTaskInstallationReceipt(task.task_id, installation);

  const entrypoints = {
    readme: identity.installReadme,
    index: identity.skillPackIndex,
    manifest: identity.skillPackManifest,
    directory: identity.directory,
    skill_md: identity.skillMd,
    skill_json: identity.skillJson,
    archive: identity.archive,
    helper_script: identity.helperScript,
    installation_report: 'skill-pack/installation.json',
  };
  const downloads = {
    archive: `/api/tasks/${task.task_id}/download-skill-pack`,
    skill_md: `/api/tasks/${task.task_id}/download-file?path=${encodeURIComponent(identity.skillMd)}`,
    skill_json: `/api/tasks/${task.task_id}/download-file?path=${encodeURIComponent(identity.skillJson)}`,
    readme: `/api/tasks/${task.task_id}/download-file?path=${encodeURIComponent(identity.installReadme)}`,
    installation_report: `/api/tasks/${task.task_id}/download-file?path=${encodeURIComponent('skill-pack/installation.json')}`,
  };

  await fs.writeFile(skillPackIndexPath, JSON.stringify({
    format: config.skillPackFormat,
    version: config.skillPackSchemaVersion,
    generated_at: generatedAt,
    task_id: task.task_id,
    goal: task.goal,
    skill_name: identity.skillSlug,
    skill_version: versioning.skill_pack.skill_version,
    display_name: identity.displayName,
    description: identity.description,
    versioning,
    compatibility: versioning.compatibility,
    install_strategy: versioning.install_strategy,
    upgrade_path: versioning.upgrade_path,
    installation,
    entrypoints,
    install_steps: installSteps,
    downloads,
  }, null, 2), 'utf8');

  const skillFiles = (await listFilesRecursive(path.join(dir, 'skill-pack'), dir))
    .filter((file) => file.relativePath !== identity.skillPackManifest);
  const skillFileEntries = [];
  for (const file of skillFiles) {
    skillFileEntries.push(await buildFileDescriptor(task.task_id, file.relativePath, file.fullPath));
  }

  const manifestEntryBase = {
    relative_path: identity.skillPackManifest,
    zip_path: `${task.task_id}/${identity.skillPackManifest}`,
    type: 'json',
    ...buildTaskFileUrls(task.task_id, identity.skillPackManifest),
    included_in_bundle: true,
  };

  await writeSelfSizedManifest(skillPackManifestPath, (manifestEntry) => ({
    format: config.skillPackFormat,
    version: config.skillPackSchemaVersion,
    generated_at: generatedAt,
    task_id: task.task_id,
    goal: task.goal,
    product_track: task.product_track || 'runtime-studio',
    skill_name: identity.skillSlug,
    skill_version: versioning.skill_pack.skill_version,
    display_name: identity.displayName,
    description: identity.description,
    versioning,
    compatibility: versioning.compatibility,
    install_strategy: versioning.install_strategy,
    upgrade_path: versioning.upgrade_path,
    installation,
    install_steps: installSteps,
    entrypoints,
    downloads,
    stats: {
      file_count: skillFileEntries.length + 1,
      reference_count: copiedReferences.length,
    },
    files: [...skillFileEntries, { ...manifestEntryBase, ...manifestEntry }],
  }));

  return { entrypoints, downloads };
}

async function generateInstallableSkillPack(task, dir, identity, generatedAt) {
  const skillDir = path.join(dir, 'skill-pack', identity.skillSlug);
  const refsRoot = path.join(skillDir, 'references', 'package');
  const scriptsDir = path.join(skillDir, 'scripts');

  await fs.mkdir(refsRoot, { recursive: true });
  await fs.mkdir(scriptsDir, { recursive: true });

  const referenceCandidates = (await listFilesRecursive(dir))
    .filter((file) => /\.(md|json)$/i.test(file.relativePath))
    .filter((file) => !file.relativePath.startsWith('skill-pack/'))
    .filter((file) => file.relativePath !== 'bundle/manifest.json');

  const copiedReferences = [];
  for (const file of referenceCandidates) {
    const targetPath = path.join(refsRoot, file.relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(file.fullPath, targetPath);
    copiedReferences.push(`references/package/${file.relativePath}`);
  }

  const versioning = buildSkillVersionMetadata(task, identity.skillSlug);
  const skillJson = {
    format: config.generatedSkillFormat,
    version: config.generatedSkillSchemaVersion,
    generated_at: generatedAt,
    task_id: task.task_id,
    goal: task.goal,
    product_track: task.product_track || 'runtime-studio',
    skill_name: identity.skillSlug,
    skill_version: versioning.skill_pack.skill_version,
    display_name: identity.displayName,
    description: identity.description,
    helper_script: `scripts/${identity.skillSlug}.js`,
    references_root: 'references/package',
    references: copiedReferences,
    versioning,
    compatibility: versioning.compatibility,
    install_strategy: versioning.install_strategy,
    upgrade_path: versioning.upgrade_path,
  };

  await fs.writeFile(path.join(skillDir, 'skill.json'), JSON.stringify(skillJson, null, 2), 'utf8');
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), buildGeneratedSkillMarkdown(task, identity, copiedReferences), 'utf8');
  await fs.writeFile(path.join(scriptsDir, `${identity.skillSlug}.js`), buildGeneratedSkillScript(identity), 'utf8');

  const archivePath = path.join(dir, identity.archive);
  await createArchiveFromDirectory(skillDir, archivePath, identity.skillSlug);

  const installSteps = [
    `下载 \`${identity.archive}\`，或直接复制 \`${identity.directory}\`。`,
    `把导出的目录内容安装到 OpenClaw 工作区的 \`${versioning.install_strategy.target_directory}\`。`,
    `确认最终目录包含 \`${versioning.install_strategy.target_directory}/SKILL.md\`、\`${versioning.install_strategy.target_directory}/skill.json\`、\`${versioning.install_strategy.target_directory}/scripts/${identity.skillSlug}.js\` 和 \`${versioning.install_strategy.target_directory}/references/package/index.json\`。`,
    '查看 `skill-pack/installation.json` 中的安装记录与验收摘要。',
    '让 OpenClaw 重新加载技能后再触发它。',
  ];

  const installation = buildSkillPackInstallationPlaceholder(task, identity, versioning, config.autoInstallSkillPacks ? 'auto' : 'manual');
  const metadataFiles = await writeSkillPackMetadata(task, dir, identity, generatedAt, copiedReferences, versioning, installSteps, installation);

  return {
    ready: true,
    name: identity.skillSlug,
    display_name: identity.displayName,
    description: identity.description,
    versioning,
    compatibility: versioning.compatibility,
    install_strategy: versioning.install_strategy,
    upgrade_path: versioning.upgrade_path,
    install_steps: installSteps,
    entrypoints: metadataFiles.entrypoints,
    downloads: metadataFiles.downloads,
    installation,
    references: copiedReferences,
  };
}

export class AdapterRuntime {
  constructor({ skillInstallService } = {}) {
    this.allowedCommands = new Set(['node', 'npm']);
    this.skillInstallService = skillInstallService || null;
  }

  async execute(action, ctx) {
    if (action.kind === 'write_artifact') {
      const artifact = action.artifact;
      const dir = resolveTaskDir(ctx.task.task_id);
      await fs.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, `${artifact.type}.json`);
      await fs.writeFile(filePath, JSON.stringify(artifact, null, 2), 'utf8');
      return {
        kind: action.kind,
        success: true,
        risk: 'low',
        filePath,
        artifactType: artifact.type,
        stdout: '',
        stderr: '',
        exitCode: 0,
      };
    }

    if (action.kind === 'write_text_file') {
      const dir = resolveTaskDir(ctx.task.task_id);
      const relativePath = action.relativePath || 'output.txt';
      const filePath = path.join(dir, relativePath);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, action.content || '', 'utf8');
      return {
        kind: action.kind,
        success: true,
        risk: 'low',
        filePath,
        stdout: '',
        stderr: '',
        exitCode: 0,
      };
    }

    if (action.kind === 'bundle_task_outputs') {
      const dir = resolveTaskDir(ctx.task.task_id);
      await fs.mkdir(dir, { recursive: true });
      const sourceFiles = (await listFilesRecursive(dir))
        .filter((file) => ![
          'README.md',
          'index.json',
          'bundle/bundle.md',
          'bundle/manifest.json',
          'bundle/bundle.zip',
        ].includes(file.relativePath))
        .filter((file) => !file.relativePath.startsWith('skill-pack/'));
      const markdownFiles = sourceFiles.filter((file) => file.relativePath.endsWith('.md') && !file.relativePath.startsWith('bundle/'));
      const sections = [];

      for (const file of markdownFiles) {
        const content = await fs.readFile(file.fullPath, 'utf8');
        sections.push(`\n---\n\n## ${file.relativePath}\n\n${content}`);
      }

      const bundleDir = path.join(dir, 'bundle');
      await fs.mkdir(bundleDir, { recursive: true });
      const bundlePath = path.join(bundleDir, 'bundle.md');
      const manifestPath = path.join(bundleDir, 'manifest.json');
      const readmePath = path.join(dir, 'README.md');
      const indexPath = path.join(dir, 'index.json');
      const generatedAt = new Date().toISOString();
      const exportSkillPack = shouldExportSkillPack(ctx.task, ctx.analysis, sourceFiles);
      const skillIdentity = exportSkillPack ? buildSkillPackIdentity(ctx.task) : null;
      const versioning = buildSkillVersionMetadata(ctx.task, skillIdentity?.skillSlug || null);

      const bundleText = [
        `# ${config.projectDisplayName} Solution Bundle`,
        '',
        `- task_id: ${ctx.task.task_id}`,
        `- goal: ${ctx.task.goal}`,
        `- product_track: ${ctx.task.product_track || 'runtime-studio'}`,
        `- release_version: ${versioning.release_version}`,
        `- artifact_version: ${versioning.artifact_version}`,
        `- source_file_count: ${sourceFiles.length}`,
        `- markdown_count: ${markdownFiles.length}`,
        ...sections,
      ].join('\n');

      await fs.writeFile(bundlePath, bundleText, 'utf8');

      const bundleReadme = buildBundleReadme(ctx.task, {
        generatedAt,
        sourceFileCount: sourceFiles.length,
        markdownCount: markdownFiles.length,
      }, skillIdentity);
      await fs.writeFile(readmePath, bundleReadme, 'utf8');

      const bundleIndex = buildBundleIndex(ctx.task, {
        generatedAt,
        sourceFileCount: sourceFiles.length,
        markdownCount: markdownFiles.length,
      }, skillIdentity);
      await fs.writeFile(indexPath, JSON.stringify(bundleIndex, null, 2), 'utf8');

      let skillPack = skillIdentity
        ? await generateInstallableSkillPack(ctx.task, dir, skillIdentity, generatedAt)
        : null;

      if (skillPack && this.skillInstallService) {
        const shouldAutoInstall = config.autoInstallSkillPacks && !ctx.task.parent_task_id;
        const installation = shouldAutoInstall
          ? await this.skillInstallService.installGeneratedSkillPack({
              task: ctx.task,
              skillPack,
              installMode: 'auto',
            })
          : this.skillInstallService.buildSkippedInstallation(
              ctx.task,
              skillPack,
              config.autoInstallSkillPacks
                ? 'auto install only runs for top-level skill-pack tasks'
                : 'auto install disabled by config',
            );

        const metadataFiles = await writeSkillPackMetadata(
          ctx.task,
          dir,
          skillIdentity,
          generatedAt,
          skillPack.references || [],
          skillPack.versioning,
          skillPack.install_steps,
          installation,
        );

        skillPack = {
          ...skillPack,
          entrypoints: metadataFiles.entrypoints,
          downloads: metadataFiles.downloads,
          installation,
        };
      }

      const packagedFiles = (await listFilesRecursive(dir))
        .filter((file) => file.relativePath !== 'bundle/manifest.json')
        .filter((file) => file.relativePath !== 'bundle/bundle.zip');
      const fileEntries = [];
      for (const file of packagedFiles) {
        fileEntries.push(await buildFileDescriptor(ctx.task.task_id, file.relativePath, file.fullPath));
      }

      const manifestEntryBase = {
        relative_path: 'bundle/manifest.json',
        zip_path: `${ctx.task.task_id}/bundle/manifest.json`,
        type: 'json',
        ...buildTaskFileUrls(ctx.task.task_id, 'bundle/manifest.json'),
        included_in_bundle: true,
      };

      await writeSelfSizedManifest(manifestPath, (manifestEntry) => ({
        package_format: config.solutionPackageFormat,
        package_version: config.solutionPackageSchemaVersion,
        task_id: ctx.task.task_id,
        goal: ctx.task.goal,
        product_track: ctx.task.product_track || 'runtime-studio',
        generated_at: generatedAt,
        project_slug: config.projectSlug,
        project_display_name: config.projectDisplayName,
        product_name: config.productName,
        zip_root: ctx.task.task_id,
        versioning,
        stats: {
          source_file_count: sourceFiles.length,
          bundle_file_count: fileEntries.length + 1,
          markdown_count: markdownFiles.length + 2,
          total_bytes: [...fileEntries, { ...manifestEntryBase, ...manifestEntry }].reduce((sum, item) => sum + item.size_bytes, 0),
        },
        entrypoints: {
          readme: 'README.md',
          index: 'index.json',
          bundle_markdown: 'bundle/bundle.md',
          manifest: 'bundle/manifest.json',
          bundle_zip: 'bundle/bundle.zip',
          skill_pack: skillPack ? skillPack.entrypoints : null,
        },
        profiles: {
          runtime: 'runtime-studio',
          skill: 'skill-pack',
        },
        downloads: {
          readme: `/api/tasks/${ctx.task.task_id}/download-file?path=${encodeURIComponent('README.md')}`,
          index: `/api/tasks/${ctx.task.task_id}/download-file?path=${encodeURIComponent('index.json')}`,
          bundle_markdown: `/api/tasks/${ctx.task.task_id}/download-bundle`,
          bundle_zip: `/api/tasks/${ctx.task.task_id}/download-bundle-zip`,
          manifest: `/api/tasks/${ctx.task.task_id}/download-file?path=${encodeURIComponent('bundle/manifest.json')}`,
          skill_pack_archive: skillPack ? `/api/tasks/${ctx.task.task_id}/download-skill-pack` : null,
          skill_pack_installation_report: skillPack ? `/api/tasks/${ctx.task.task_id}/download-file?path=${encodeURIComponent('skill-pack/installation.json')}` : null,
        },
        skill_pack: skillPack,
        files: [...fileEntries, { ...manifestEntryBase, ...manifestEntry }],
      }));

      const bundleZipPath = await createBundleZip(ctx.task.task_id);

      return {
        kind: action.kind,
        success: true,
        risk: 'low',
        bundlePath,
        manifestPath,
        bundleZipPath,
        downloads: {
          readme: `/api/tasks/${ctx.task.task_id}/download-file?path=${encodeURIComponent('README.md')}`,
          index: `/api/tasks/${ctx.task.task_id}/download-file?path=${encodeURIComponent('index.json')}`,
          bundle_markdown: `/api/tasks/${ctx.task.task_id}/download-bundle`,
          bundle_zip: `/api/tasks/${ctx.task.task_id}/download-bundle-zip`,
          manifest: `/api/tasks/${ctx.task.task_id}/download-file?path=${encodeURIComponent('bundle/manifest.json')}`,
          skill_pack_archive: skillPack ? `/api/tasks/${ctx.task.task_id}/download-skill-pack` : null,
          skill_pack_installation_report: skillPack ? `/api/tasks/${ctx.task.task_id}/download-file?path=${encodeURIComponent('skill-pack/installation.json')}` : null,
        },
        skillPack,
        stdout: '',
        stderr: '',
        exitCode: 0,
      };
    }

    if (action.kind === 'run_command') {
      const command = action.command;
      if (!this.allowedCommands.has(command)) {
        return {
          kind: action.kind,
          success: false,
          risk: 'medium',
          command,
          args: action.args || [],
          stdout: '',
          stderr: `Command not allowed: ${command}`,
          exitCode: -1,
        };
      }

      try {
        const invocation = buildInvocation(command, action.args || []);
        const { stdout, stderr } = await execFileAsync(invocation.file, invocation.args, {
          cwd: ctx.cwd || config.projectRoot,
          windowsHide: true,
          timeout: action.timeoutMs || 10000,
        });
        return {
          kind: action.kind,
          success: true,
          risk: 'medium',
          command,
          args: action.args || [],
          stdout: String(stdout || '').trim(),
          stderr: String(stderr || '').trim(),
          exitCode: 0,
        };
      } catch (error) {
        return {
          kind: action.kind,
          success: false,
          risk: 'medium',
          command,
          args: action.args || [],
          stdout: String(error.stdout || '').trim(),
          stderr: String(error.stderr || error.message || '').trim(),
          exitCode: Number.isInteger(error.code) ? error.code : 1,
        };
      }
    }

    return {
      kind: action.kind,
      success: false,
      risk: 'low',
      stdout: '',
      stderr: `Unknown action kind: ${action.kind}`,
      exitCode: -1,
    };
  }
}
