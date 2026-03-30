import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { readJson, writeJson } from '../utils/json-file.js';
import { buildManagedSkillLayout } from './install-layout.js';

const installRecordsPath = path.join(config.dataDir, 'skill-installs.json');
const installMetadataFileName = '.agentx-install.json';

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/');
}

function makeInstallId(taskId) {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `install_${String(taskId || 'task').replace(/[^a-z0-9_-]/gi, '').toLowerCase()}_${suffix}`;
}

function copyCheck(id, title, passed, detail, extra = {}) {
  return {
    id,
    title,
    passed,
    status: passed ? 'ready' : extra.blocking === false ? 'warning' : 'missing',
    blocking: extra.blocking !== false,
    detail,
    expected: extra.expected ?? null,
    actual: extra.actual ?? null,
  };
}

export class SkillInstallService {
  constructor() {
    this.installMetadataFileName = installMetadataFileName;
  }

  getRecords() {
    const data = readJson(installRecordsPath, { installs: [] });
    return Array.isArray(data.installs) ? data.installs : [];
  }

  saveRecords(installs) {
    writeJson(installRecordsPath, { installs });
  }

  getLatestInstallForTask(taskId) {
    return this.getRecords().find((item) => item.task_id === taskId) || null;
  }

  getInstallMetadataPath(installPath) {
    return path.join(installPath, this.installMetadataFileName);
  }

  buildSkippedInstallation(task, skillPack, reason = 'auto install disabled') {
    const layout = buildManagedSkillLayout(skillPack?.name || 'generated-skill');
    return {
      managed_by: config.projectSlug,
      install_mode: 'skipped',
      attempted: false,
      installed: false,
      verified: false,
      accepted: false,
      status: 'skipped',
      task_id: task.task_id,
      skill_name: skillPack?.name || null,
      skill_version: skillPack?.versioning?.skill_pack?.skill_version || null,
      installed_directory_name: layout.directory_name,
      managed_relative_path: layout.relative_path,
      installed_path: path.join(config.workspaceSkillsDir, layout.directory_name),
      installed_at: null,
      reason,
      verification: {
        passed: false,
        score: 0,
        missing: ['Auto installation was skipped'],
        warnings: [],
        checklist: [],
        verified_at: null,
        summary: reason,
      },
    };
  }

  verifyInstalledSkill({ installRecord, skillPack, sourceSkillJson = null }) {
    const installPath = installRecord.installed_path;
    const skillJsonPath = path.join(installPath, 'skill.json');
    const helperScript = path.join(installPath, 'scripts', `${skillPack.name}.js`);
    const referenceIndex = path.join(installPath, 'references', 'package', 'index.json');
    const referenceReadme = path.join(installPath, 'references', 'package', 'README.md');
    const skillMdPath = path.join(installPath, 'SKILL.md');
    const installMetadataPath = this.getInstallMetadataPath(installPath);

    const hasDir = fs.existsSync(installPath);
    const hasSkillMd = fs.existsSync(skillMdPath);
    const hasSkillJson = fs.existsSync(skillJsonPath);
    const hasHelperScript = fs.existsSync(helperScript);
    const hasReferenceIndex = fs.existsSync(referenceIndex);
    const hasReferenceReadme = fs.existsSync(referenceReadme);
    const hasInstallMetadata = fs.existsSync(installMetadataPath);

    const installedSkillJson = hasSkillJson ? readJson(skillJsonPath, {}) : {};
    const expectedVersion = skillPack?.versioning?.skill_pack?.skill_version || sourceSkillJson?.skill_version || null;
    const actualVersion = installedSkillJson?.skill_version || installedSkillJson?.versioning?.skill_pack?.skill_version || null;
    const expectedTarget = skillPack?.install_strategy?.target_directory || sourceSkillJson?.install_strategy?.target_directory || installRecord.managed_relative_path;
    const actualTarget = installedSkillJson?.install_strategy?.target_directory || installedSkillJson?.versioning?.install_strategy?.target_directory || null;
    const actualInstallLayout = installedSkillJson?.compatibility?.install_layout || installedSkillJson?.versioning?.compatibility?.install_layout || null;
    const actualTaskId = installedSkillJson?.task_id || null;
    const expectedTaskId = installRecord.task_id;

    const checklist = [
      copyCheck('install-dir', '安装目录存在', hasDir, 'Workspace skills 目录中必须有已安装 skill 目录。', {
        expected: installRecord.installed_path,
        actual: hasDir ? installRecord.installed_path : null,
      }),
      copyCheck('skill-md', 'SKILL.md 存在', hasSkillMd, '安装后的 skill 必须包含 SKILL.md。', {
        expected: normalizePath(path.join(installRecord.installed_path, 'SKILL.md')),
        actual: hasSkillMd ? normalizePath(skillMdPath) : null,
      }),
      copyCheck('skill-json', 'skill.json 存在', hasSkillJson, '安装后的 skill 必须包含 skill.json。', {
        expected: normalizePath(path.join(installRecord.installed_path, 'skill.json')),
        actual: hasSkillJson ? normalizePath(skillJsonPath) : null,
      }),
      copyCheck('helper-script', 'scripts helper 存在', hasHelperScript, '安装后的 skill 应包含 helper script。', {
        expected: normalizePath(path.join(installRecord.installed_path, 'scripts', `${skillPack.name}.js`)),
        actual: hasHelperScript ? normalizePath(helperScript) : null,
      }),
      copyCheck('reference-index', 'references/package/index.json 存在', hasReferenceIndex, '安装后的 skill 应携带 source package index。', {
        expected: normalizePath(path.join(installRecord.installed_path, 'references', 'package', 'index.json')),
        actual: hasReferenceIndex ? normalizePath(referenceIndex) : null,
      }),
      copyCheck('reference-readme', 'references/package/README.md 存在', hasReferenceReadme, '安装后的 skill 应携带 source package README。', {
        expected: normalizePath(path.join(installRecord.installed_path, 'references', 'package', 'README.md')),
        actual: hasReferenceReadme ? normalizePath(referenceReadme) : null,
        blocking: false,
      }),
      copyCheck('install-metadata', '安装元数据存在', hasInstallMetadata, '必须写入安装元数据，确保可追踪、可验收、可重复。', {
        expected: normalizePath(installMetadataPath),
        actual: hasInstallMetadata ? normalizePath(installMetadataPath) : null,
      }),
      copyCheck('version-match', 'skill_version 与导出包一致', Boolean(expectedVersion && actualVersion && expectedVersion === actualVersion), '安装后的 skill_version 必须与导出 skill-pack 一致。', {
        expected: expectedVersion,
        actual: actualVersion,
      }),
      copyCheck('task-match', 'source task id 一致', Boolean(expectedTaskId && actualTaskId && expectedTaskId === actualTaskId), '安装后的 skill.json 应保留来源 task_id。', {
        expected: expectedTaskId,
        actual: actualTaskId,
      }),
      copyCheck('target-directory-match', 'install_strategy.target_directory 一致', Boolean(expectedTarget && actualTarget && expectedTarget === actualTarget), 'skill.json 内的 target_directory 必须与受控安装路径一致。', {
        expected: expectedTarget,
        actual: actualTarget,
      }),
      copyCheck('install-layout-match', 'compatibility.install_layout 一致', Boolean(expectedTarget && actualInstallLayout && expectedTarget === actualInstallLayout), 'compatibility.install_layout 必须与实际安装布局一致。', {
        expected: expectedTarget,
        actual: actualInstallLayout,
      }),
      copyCheck('managed-namespace', '受控命名空间生效', installRecord.installed_directory_name?.startsWith(`${config.generatedSkillNamespace}--`), '自动安装必须落在受控前缀下，避免覆盖人工技能。', {
        expected: `${config.generatedSkillNamespace}--<skill-slug>`,
        actual: installRecord.installed_directory_name,
      }),
      copyCheck('readiness-aligned', '导出包 readiness 允许安装', Boolean(skillPack?.readiness?.installable), '只有 installable 的 skill-pack 才应进入自动安装验收。', {
        expected: true,
        actual: skillPack?.readiness?.installable ?? false,
        blocking: false,
      }),
    ];

    const missing = checklist.filter((item) => !item.passed && item.blocking).map((item) => item.title);
    const warnings = checklist.filter((item) => !item.passed && !item.blocking).map((item) => item.title);
    const passedCount = checklist.filter((item) => item.passed).length;
    const score = Math.round((passedCount / checklist.length) * 100);
    const passed = missing.length === 0;

    return {
      passed,
      score,
      missing,
      warnings,
      checklist,
      verified_at: nowIso(),
      summary: passed
        ? 'Skill 已安装到 workspace skills，并通过结构与元数据验收。'
        : 'Skill 已写入安装目录，但仍有阻塞项未通过验收。',
      expected_target_directory: expectedTarget,
      actual_target_directory: actualTarget,
      actual_install_layout: actualInstallLayout,
    };
  }

  async installGeneratedSkillPack({ task, skillPack, installMode = 'auto' }) {
    if (!skillPack?.entrypoints?.directory || !skillPack?.name) {
      return this.buildSkippedInstallation(task, skillPack, 'skill-pack entrypoints missing, unable to install');
    }

    const sourceDir = path.join(config.generatedDir, task.task_id, skillPack.entrypoints.directory);
    if (!fs.existsSync(sourceDir)) {
      return this.buildSkippedInstallation(task, skillPack, `exported skill directory not found: ${sourceDir}`);
    }

    const layout = buildManagedSkillLayout(skillPack.name);
    const installPath = path.join(config.workspaceSkillsDir, layout.directory_name);
    const sourceSkillJsonPath = path.join(sourceDir, 'skill.json');
    const sourceSkillJson = fs.existsSync(sourceSkillJsonPath) ? readJson(sourceSkillJsonPath, {}) : {};
    const installedAt = nowIso();
    const backupBaseDir = path.join(config.dataDir, 'skill-installs', 'backups', layout.directory_name);
    const backupDir = path.join(backupBaseDir, `${(skillPack.versioning?.skill_pack?.skill_version || 'unknown').replace(/[^a-z0-9._-]/gi, '_')}--${installedAt.replace(/[:.]/g, '-')}`);
    const stagingPath = path.join(config.workspaceSkillsDir, `.${layout.directory_name}.staging-${Date.now()}`);

    await fsp.mkdir(config.workspaceSkillsDir, { recursive: true });
    await fsp.rm(stagingPath, { recursive: true, force: true });

    let existingInstallManaged = false;
    let existingMetadata = null;
    if (fs.existsSync(installPath)) {
      const existingMetadataPath = this.getInstallMetadataPath(installPath);
      existingMetadata = fs.existsSync(existingMetadataPath) ? readJson(existingMetadataPath, null) : null;
      existingInstallManaged = Boolean(existingMetadata?.managed_by === config.projectSlug);
      if (!existingInstallManaged) {
        throw new Error(`Refusing to overwrite unmanaged skill install at ${installPath}`);
      }
      await fsp.mkdir(path.dirname(backupDir), { recursive: true });
      await fsp.cp(installPath, backupDir, { recursive: true, force: true });
    }

    await fsp.cp(sourceDir, stagingPath, { recursive: true, force: true });

    const installRecord = {
      record_id: makeInstallId(task.task_id),
      managed_by: config.projectSlug,
      install_mode: installMode,
      attempted: true,
      installed: true,
      verified: false,
      accepted: false,
      status: 'installed',
      task_id: task.task_id,
      task_goal: task.goal,
      product_track: task.product_track || 'runtime-studio',
      skill_name: skillPack.name,
      skill_display_name: skillPack.display_name || skillPack.name,
      skill_version: skillPack.versioning?.skill_pack?.skill_version || null,
      artifact_version: skillPack.versioning?.artifact_version || null,
      source_directory: normalizePath(sourceDir),
      source_archive: skillPack.entrypoints?.archive || null,
      installed_directory_name: layout.directory_name,
      managed_relative_path: layout.relative_path,
      installed_path: normalizePath(installPath),
      workspace_skills_dir: normalizePath(config.workspaceSkillsDir),
      installed_at: installedAt,
      backup_path: existingInstallManaged ? normalizePath(backupDir) : null,
      previous_install_record_id: existingMetadata?.record_id || null,
      install_metadata_file: normalizePath(path.join(installPath, this.installMetadataFileName)),
      acceptance_summary: null,
      verification: null,
    };

    await fsp.writeFile(this.getInstallMetadataPath(stagingPath), JSON.stringify(installRecord, null, 2), 'utf8');

    await fsp.rm(installPath, { recursive: true, force: true });
    await fsp.rename(stagingPath, installPath);

    const verification = this.verifyInstalledSkill({
      installRecord,
      skillPack,
      sourceSkillJson,
    });

    installRecord.verification = verification;
    installRecord.verified = verification.passed;
    installRecord.accepted = verification.passed;
    installRecord.status = verification.passed ? 'accepted' : 'verification-failed';
    installRecord.acceptance_summary = verification.summary;

    await fsp.writeFile(this.getInstallMetadataPath(installPath), JSON.stringify(installRecord, null, 2), 'utf8');

    const installs = this.getRecords().filter((item) => item.record_id !== installRecord.record_id);
    installs.unshift(installRecord);
    this.saveRecords(installs);

    return installRecord;
  }
}
