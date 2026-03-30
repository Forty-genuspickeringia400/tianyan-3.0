import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { buildSkillVersionMetadata } from './version-metadata.js';
import { evaluateSkillPackReadiness } from './skill-pack-readiness.js';

function buildFileDownload(taskId, relativePath) {
  return `/api/tasks/${taskId}/download-file?path=${encodeURIComponent(relativePath)}`;
}

function buildFilePreview(taskId, relativePath) {
  return `/api/tasks/${taskId}/file?path=${encodeURIComponent(relativePath)}`;
}

function inferArtifactGroup(relativePath) {
  if (relativePath.startsWith('skill-pack/')) return 'skill-pack';
  if (relativePath.startsWith('bundle/')) return 'bundle';
  if (relativePath === 'README.md' || relativePath === 'index.json') return 'package';
  return 'artifacts';
}

function inferArtifactType(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === '.md') return 'markdown';
  if (ext === '.json') return 'json';
  if (ext === '.zip') return 'zip';
  if (ext === '.skill') return 'skill-archive';
  return ext ? ext.slice(1) : 'file';
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function pickFirst(...values) {
  return values.find(Boolean) || null;
}

export class PackageService {
  constructor({ skillInstallService } = {}) {
    this.skillInstallService = skillInstallService || null;
  }

  resolveTaskPath(taskId, relativePath) {
    return path.join(config.generatedDir, taskId, relativePath);
  }

  readTaskJson(taskId, relativePath) {
    try {
      const fullPath = this.resolveTaskPath(taskId, relativePath);
      if (!fs.existsSync(fullPath)) return null;
      return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch {
      return null;
    }
  }

  buildFileRecord(task, fileMap, relativePath, role = null) {
    if (!relativePath) return null;
    const file = fileMap.get(relativePath);
    return {
      role,
      relative_path: relativePath,
      exists: Boolean(file),
      group: inferArtifactGroup(relativePath),
      type: inferArtifactType(relativePath),
      size_bytes: file?.size ?? null,
      updated_at: file?.updated_at ?? null,
      preview_url: file && /\.(md|json|txt)$/i.test(relativePath)
        ? buildFilePreview(task.task_id, relativePath)
        : null,
      download_url: file ? buildFileDownload(task.task_id, relativePath) : null,
    };
  }

  buildArtifactIndex(task, files, pkg, skillPack) {
    const fileMap = new Map(files.map((item) => [item.relative_path, item]));
    const entrypointPaths = unique([
      pkg.entrypoints.readme,
      pkg.entrypoints.index,
      pkg.entrypoints.bundle_markdown,
      pkg.entrypoints.manifest,
      pkg.entrypoints.bundle_zip,
      skillPack.entrypoints?.readme,
      skillPack.entrypoints?.index,
      skillPack.entrypoints?.manifest,
      skillPack.entrypoints?.skill_md,
      skillPack.entrypoints?.skill_json,
      skillPack.entrypoints?.archive,
      skillPack.entrypoints?.helper_script,
      skillPack.entrypoints?.installation_report,
    ]);

    const entrypoints = entrypointPaths.map((relativePath) => this.buildFileRecord(task, fileMap, relativePath, 'entrypoint'));
    const downloads = unique([
      pkg.downloads.readme,
      pkg.downloads.bundle_markdown,
      pkg.downloads.bundle_zip,
      skillPack.downloads?.archive,
      skillPack.downloads?.skill_md,
      skillPack.downloads?.skill_json,
      skillPack.downloads?.installation_report,
    ]);

    const groups = ['package', 'bundle', 'skill-pack', 'artifacts']
      .map((group) => ({
        id: group,
        title: group === 'skill-pack'
          ? 'Skill Pack'
          : group === 'package'
            ? 'Package Entrypoints'
            : group === 'bundle'
              ? 'Bundle Files'
              : 'Generated Artifacts',
        items: files
          .filter((file) => inferArtifactGroup(file.relative_path) === group)
          .map((file) => this.buildFileRecord(task, fileMap, file.relative_path, entrypointPaths.includes(file.relative_path) ? 'entrypoint' : null)),
      }))
      .filter((group) => group.items.length > 0);

    return {
      total_files: files.length,
      entrypoints,
      highlighted_downloads: downloads,
      groups,
    };
  }

  summarizeSkillPack(task, files = []) {
    const fileMap = new Map(files.map((item) => [item.relative_path, item]));
    const fileSet = new Set(fileMap.keys());
    const skillMd = files.find((item) => /^skill-pack\/[^/]+\/SKILL\.md$/.test(item.relative_path))?.relative_path || null;
    const directory = skillMd ? skillMd.replace(/\/SKILL\.md$/, '') : null;
    const fallbackName = directory ? directory.split('/').pop() : null;
    const skillJsonPath = directory ? `${directory}/skill.json` : null;
    const helperScript = fallbackName ? `${directory}/scripts/${fallbackName}.js` : null;
    const installationReportPath = 'skill-pack/installation.json';
    const indexData = this.readTaskJson(task.task_id, 'skill-pack/index.json') || {};
    const manifestData = this.readTaskJson(task.task_id, 'skill-pack/manifest.json') || {};
    const installationData = this.readTaskJson(task.task_id, installationReportPath) || this.skillInstallService?.getLatestInstallForTask?.(task.task_id) || null;
    const skillData = skillJsonPath ? (this.readTaskJson(task.task_id, skillJsonPath) || {}) : {};
    const name = pickFirst(manifestData.skill_name, indexData.skill_name, skillData.skill_name, fallbackName);
    const versioning = pickFirst(
      manifestData.versioning,
      indexData.versioning,
      skillData.versioning,
      buildSkillVersionMetadata(task, name),
    );
    const entrypoints = {
      readme: 'skill-pack/README.md',
      index: 'skill-pack/index.json',
      manifest: 'skill-pack/manifest.json',
      directory,
      skill_md: skillMd,
      skill_json: skillJsonPath,
      archive: pickFirst(manifestData.entrypoints?.archive, indexData.entrypoints?.archive, name ? `skill-pack/${name}-${versioning.artifact_version}.skill` : null),
      helper_script: pickFirst(manifestData.entrypoints?.helper_script, indexData.entrypoints?.helper_script, helperScript),
      installation_report: pickFirst(manifestData.entrypoints?.installation_report, indexData.entrypoints?.installation_report, installationReportPath),
    };
    const references = directory
      ? files.filter((item) => item.relative_path.startsWith(`${directory}/references/`)).map((item) => item.relative_path)
      : [];
    const compatibility = pickFirst(manifestData.compatibility, indexData.compatibility, skillData.compatibility, versioning.compatibility);
    const installStrategy = pickFirst(manifestData.install_strategy, indexData.install_strategy, skillData.install_strategy, versioning.install_strategy);
    const upgradePath = pickFirst(manifestData.upgrade_path, indexData.upgrade_path, skillData.upgrade_path, versioning.upgrade_path);
    const installSteps = unique([
      ...(manifestData.install_steps || []),
      ...(indexData.install_steps || []),
    ]);
    const fallbackInstallSteps = [
      `下载 ${entrypoints.archive || 'skill-pack archive'}，或直接复制 ${entrypoints.directory || 'skill-pack/<generated>'}。`,
      `把导出的目录内容安装到 ${installStrategy?.target_directory || `skills/${name || '<generated-skill>'}`}。`,
      '确认目录里包含 SKILL.md、skill.json、scripts/<skill>.js、references/package/index.json，再重新加载技能。',
    ];
    const readiness = evaluateSkillPackReadiness({
      task,
      fileSet,
      entrypoints,
      metadata: {
        skill_name: name,
        display_name: pickFirst(manifestData.display_name, indexData.display_name, skillData.display_name),
        versioning,
        compatibility,
        install_strategy: installStrategy,
        install_steps: installSteps.length ? installSteps : fallbackInstallSteps,
      },
      references,
    });

    return {
      ready: readiness.ready,
      installable: readiness.installable,
      usable: readiness.usable,
      installed: Boolean(installationData?.installed),
      verified: Boolean(installationData?.verification?.passed),
      name,
      display_name: pickFirst(manifestData.display_name, indexData.display_name, skillData.display_name, name),
      description: pickFirst(manifestData.description, indexData.description, skillData.description),
      versioning,
      compatibility,
      install_strategy: installStrategy,
      upgrade_path: upgradePath,
      entrypoints,
      downloads: {
        archive: fileSet.has(entrypoints.archive) ? `/api/tasks/${task.task_id}/download-skill-pack` : null,
        skill_md: fileSet.has(entrypoints.skill_md) ? buildFileDownload(task.task_id, entrypoints.skill_md) : null,
        skill_json: fileSet.has(entrypoints.skill_json) ? buildFileDownload(task.task_id, entrypoints.skill_json) : null,
        readme: fileSet.has(entrypoints.readme) ? buildFileDownload(task.task_id, entrypoints.readme) : null,
        installation_report: fileSet.has(entrypoints.installation_report) ? buildFileDownload(task.task_id, entrypoints.installation_report) : null,
      },
      previews: {
        readme: fileSet.has(entrypoints.readme) ? buildFilePreview(task.task_id, entrypoints.readme) : null,
        skill_md: fileSet.has(entrypoints.skill_md) ? buildFilePreview(task.task_id, entrypoints.skill_md) : null,
        skill_json: fileSet.has(entrypoints.skill_json) ? buildFilePreview(task.task_id, entrypoints.skill_json) : null,
        manifest: fileSet.has(entrypoints.manifest) ? buildFilePreview(task.task_id, entrypoints.manifest) : null,
        installation_report: fileSet.has(entrypoints.installation_report) ? buildFilePreview(task.task_id, entrypoints.installation_report) : null,
      },
      install_steps: installSteps.length ? installSteps : fallbackInstallSteps,
      installation: installationData,
      references,
      readiness,
    };
  }

  summarizeTaskPackage(task, files = []) {
    const fileMap = new Map(files.map((item) => [item.relative_path, item]));
    const fileSet = new Set(fileMap.keys());
    const entrypoints = {
      readme: 'README.md',
      index: 'index.json',
      bundle_markdown: 'bundle/bundle.md',
      manifest: 'bundle/manifest.json',
      bundle_zip: 'bundle/bundle.zip',
    };
    const skillPack = this.summarizeSkillPack(task, files);
    const indexData = this.readTaskJson(task.task_id, 'index.json') || {};
    const manifestData = this.readTaskJson(task.task_id, 'bundle/manifest.json') || {};
    const versioning = pickFirst(manifestData.versioning, indexData.versioning, buildSkillVersionMetadata(task, skillPack.name || null));
    const bundleReady = Boolean(
      fileSet.has(entrypoints.readme)
      && fileSet.has(entrypoints.index)
      && fileSet.has(entrypoints.bundle_markdown)
      && fileSet.has(entrypoints.manifest)
      && fileSet.has(entrypoints.bundle_zip)
    );

    let recommendedNextStep = {
      id: 'review-package',
      title: '先从 README 开始',
      path: 'README.md',
      reason: 'README 是完整交付与后续安装/升级说明的统一入口。',
    };

    if (skillPack.installation?.verification?.passed) {
      recommendedNextStep = {
        id: 'use-installed-skill',
        title: 'Skill 已安装并验收通过',
        path: skillPack.installation.managed_relative_path,
        reason: '可以直接在当前 OpenClaw workspace 中使用这份已安装技能。',
      };
    } else if (skillPack.readiness?.ready) {
      recommendedNextStep = {
        ...skillPack.readiness.recommended_next_step,
        path: skillPack.entrypoints.readme,
      };
    } else if (!bundleReady) {
      recommendedNextStep = {
        id: 'check-artifacts',
        title: '先检查 artifacts 是否生成完整',
        path: 'bundle/manifest.json',
        reason: '当前 package 还不完整，应先看 manifest 与缺失文件。',
      };
    }

    const summary = {
      task_id: task.task_id,
      goal: task.goal,
      status: task.status,
      product_track: task.product_track || 'runtime-studio',
      bundle_ready: bundleReady,
      versioning,
      entrypoints,
      downloads: {
        readme: fileSet.has(entrypoints.readme) ? buildFileDownload(task.task_id, entrypoints.readme) : null,
        index: fileSet.has(entrypoints.index) ? buildFileDownload(task.task_id, entrypoints.index) : null,
        bundle_markdown: fileSet.has(entrypoints.bundle_markdown) ? `/api/tasks/${task.task_id}/download-bundle` : null,
        manifest: fileSet.has(entrypoints.manifest) ? buildFileDownload(task.task_id, entrypoints.manifest) : null,
        bundle_zip: fileSet.has(entrypoints.bundle_zip) ? `/api/tasks/${task.task_id}/download-bundle-zip` : null,
      },
      previews: {
        readme: fileSet.has(entrypoints.readme) ? buildFilePreview(task.task_id, entrypoints.readme) : null,
        index: fileSet.has(entrypoints.index) ? buildFilePreview(task.task_id, entrypoints.index) : null,
        bundle_markdown: fileSet.has(entrypoints.bundle_markdown) ? buildFilePreview(task.task_id, entrypoints.bundle_markdown) : null,
        manifest: fileSet.has(entrypoints.manifest) ? buildFilePreview(task.task_id, entrypoints.manifest) : null,
      },
      stats: {
        file_count: files.length,
        markdown_count: files.filter((item) => item.relative_path.endsWith('.md')).length,
        json_count: files.filter((item) => item.relative_path.endsWith('.json')).length,
      },
      artifacts: task.result?.output?.artifacts || [],
      deliverables: task.analysis?.deliverables || [],
      skill_pack: skillPack,
      recommended_next_step: recommendedNextStep,
      recommendations: [
        {
          id: 'handoff',
          title: '先从 README 开始',
          path: 'README.md',
          reason: '这是给客户 / 接手团队的人类优先入口。',
        },
        {
          id: 'bundle',
          title: '再看完整 bundle',
          path: 'bundle/bundle.md',
          reason: '适合一次性快速浏览所有核心输出。',
        },
        {
          id: 'machine',
          title: '集成时看 index + manifest',
          path: 'index.json',
          reason: '机器可读入口和完整文件索引都在这里。',
        },
        skillPack.ready ? {
          id: 'skill-pack',
          title: '需要安装到 OpenClaw 时直接走 skill-pack',
          path: skillPack.entrypoints.readme,
          reason: '这里有安装步骤、版本信息、readiness 检查、安装回执和 .skill 下载入口。',
        } : null,
        skillPack.installation?.installed ? {
          id: 'installed-skill',
          title: '当前 workspace 已完成安装',
          path: skillPack.installation.managed_relative_path,
          reason: skillPack.installation.verification?.passed
            ? '安装与验收均已通过，可以直接使用。'
            : '已安装但验收未完全通过，先看 installation report。',
        } : null,
      ].filter(Boolean),
    };

    summary.artifact_index = this.buildArtifactIndex(task, files, summary, skillPack);
    return summary;
  }

  summarizeExplorer(task, files = []) {
    const pkg = this.summarizeTaskPackage(task, files);
    return {
      task: {
        task_id: task.task_id,
        goal: task.goal,
        status: task.status,
        mode: task.mode,
        product_track: task.product_track || 'runtime-studio',
      },
      versioning: pkg.versioning,
      package: {
        bundle_ready: pkg.bundle_ready,
        entrypoints: pkg.entrypoints,
        downloads: pkg.downloads,
      },
      skill_pack: {
        ready: pkg.skill_pack.ready,
        installable: pkg.skill_pack.installable,
        usable: pkg.skill_pack.usable,
        installed: pkg.skill_pack.installed,
        verified: pkg.skill_pack.verified,
        name: pkg.skill_pack.name,
        display_name: pkg.skill_pack.display_name,
        entrypoints: pkg.skill_pack.entrypoints,
        downloads: pkg.skill_pack.downloads,
        versioning: pkg.skill_pack.versioning,
        compatibility: pkg.skill_pack.compatibility,
        install_strategy: pkg.skill_pack.install_strategy,
        upgrade_path: pkg.skill_pack.upgrade_path,
        installation: pkg.skill_pack.installation,
      },
      artifact_index: pkg.artifact_index,
      recommended_next_step: pkg.recommended_next_step,
      recommendations: pkg.recommendations,
      skill_readiness: pkg.skill_pack.readiness,
      skill_installation: pkg.skill_pack.installation,
      deliverables: pkg.deliverables,
      artifacts: pkg.artifacts,
    };
  }
}
