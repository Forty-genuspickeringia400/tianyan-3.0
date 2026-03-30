import { config } from '../config.js';
import { buildManagedSkillLayout } from '../skills/install-layout.js';

function buildTaskBuildId(task) {
  return String(task?.task_id || 'build').slice(-6).toLowerCase();
}

export function buildArtifactVersion(task) {
  return `${config.projectVersion}-task.${buildTaskBuildId(task)}`;
}

export function buildSkillVersionMetadata(task, skillSlug) {
  const buildId = buildTaskBuildId(task);
  const artifactVersion = buildArtifactVersion(task);
  const layout = skillSlug ? buildManagedSkillLayout(skillSlug) : { relative_path: 'skills/<generated-skill>' };
  const targetDirectory = layout.relative_path;
  const archiveName = skillSlug ? `${skillSlug}-${artifactVersion}.skill` : `<generated-skill>-${artifactVersion}.skill`;

  return {
    release_version: config.projectVersion,
    build_id: buildId,
    artifact_version: artifactVersion,
    solution_package: {
      format: config.solutionPackageFormat,
      schema_version: config.solutionPackageSchemaVersion,
      version: artifactVersion,
    },
    skill_pack: {
      format: config.skillPackFormat,
      schema_version: config.skillPackSchemaVersion,
      generated_skill_format: config.generatedSkillFormat,
      generated_skill_schema_version: config.generatedSkillSchemaVersion,
      skill_id: skillSlug || null,
      skill_version: artifactVersion,
    },
    compatibility: {
      openclaw_loader: config.skillCompatibilityTarget,
      install_layout: targetDirectory,
      required_files: ['SKILL.md', 'skill.json', 'scripts/<skill>.js', 'references/package/index.json'],
      reload_required: true,
      package_entrypoints: ['README.md', 'index.json', 'bundle/manifest.json', 'skill-pack/installation.json'],
      managed_namespace: config.generatedSkillNamespace,
    },
    install_strategy: {
      mode: config.skillInstallStrategy,
      target_directory: targetDirectory,
      recommended_archive_name: archiveName,
      preferred_delivery: 'auto-install-managed-copy-with-verification',
      reload_after_install: true,
      collision_strategy: 'namespace-isolated-no-overwrite-of-unmanaged-skills',
      upgrade_strategy: 'backup-existing-managed-install-then-replace',
      install_metadata_file: '.agentx-install.json',
    },
    upgrade_path: {
      supported_from: `>=${config.projectVersion}`,
      install_target: targetDirectory,
      strategy: 'backup-replace-verify-reload',
      steps: [
        `1. Only install into ${targetDirectory}; never overwrite unmanaged skills outside the ${config.generatedSkillNamespace} namespace.`,
        `2. If ${targetDirectory} already exists and is managed by ${config.projectDisplayName}, back it up before replacement.`,
        `3. Replace ${targetDirectory} with version ${artifactVersion} (archive: ${archiveName}).`,
        '4. Run install verification and confirm SKILL.md, skill.json, scripts/<skill>.js, and references/package/index.json are present.',
        '5. Reload OpenClaw skills or restart the runtime that loads workspace skills.',
      ],
    },
  };
}
