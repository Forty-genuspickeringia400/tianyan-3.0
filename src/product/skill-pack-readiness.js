function toChecklistItem(id, title, passed, detail, blocking = passed ? false : true) {
  return {
    id,
    title,
    status: passed ? 'ready' : blocking ? 'missing' : 'warning',
    passed,
    blocking,
    detail,
  };
}

export function evaluateSkillPackReadiness({ task, fileSet, entrypoints, metadata = {}, references = [] }) {
  const skillName = metadata.skill_name || metadata.display_name || entrypoints?.directory?.split('/')?.pop() || null;
  const versioning = metadata.versioning || null;
  const compatibility = metadata.compatibility || versioning?.compatibility || null;
  const installStrategy = metadata.install_strategy || versioning?.install_strategy || null;
  const installSteps = metadata.install_steps || [];

  const checks = [
    {
      id: 'skill-pack-readme',
      title: 'Skill-pack README present',
      path: entrypoints?.readme,
      detail: 'skill-pack/README.md should explain install, version, and upgrade handling.',
      blocking: true,
    },
    {
      id: 'skill-pack-index',
      title: 'Skill-pack index present',
      path: entrypoints?.index,
      detail: 'skill-pack/index.json should expose the machine-readable entrypoint.',
      blocking: true,
    },
    {
      id: 'skill-pack-manifest',
      title: 'Skill-pack manifest present',
      path: entrypoints?.manifest,
      detail: 'skill-pack/manifest.json should expose the full artifact index.',
      blocking: true,
    },
    {
      id: 'skill-markdown',
      title: 'Installable SKILL.md present',
      path: entrypoints?.skill_md,
      detail: 'The exported skill directory must contain SKILL.md.',
      blocking: true,
    },
    {
      id: 'skill-json',
      title: 'skill.json present',
      path: entrypoints?.skill_json,
      detail: 'The exported skill directory must include version and compatibility metadata.',
      blocking: true,
    },
    {
      id: 'helper-script',
      title: 'Helper script present',
      path: entrypoints?.helper_script,
      detail: 'The helper script should allow operators to inspect the packaged references.',
      blocking: false,
    },
    {
      id: 'skill-archive',
      title: '.skill archive present',
      path: entrypoints?.archive,
      detail: 'The distribution archive is needed for portable installation and upgrade delivery.',
      blocking: true,
    },
    {
      id: 'package-reference-readme',
      title: 'Referenced package README present',
      path: references.find((item) => /references\/package\/README\.md$/i.test(item)) || 'references/package/README.md',
      detail: 'The packaged skill should carry the source package README for handoff context.',
      blocking: false,
    },
    {
      id: 'package-reference-index',
      title: 'Referenced package index present',
      path: references.find((item) => /references\/package\/index\.json$/i.test(item)) || 'references/package/index.json',
      detail: 'The packaged skill should carry the source package index for deterministic lookup.',
      blocking: true,
    },
  ];

  const checklist = checks.map((check) => {
    const passed = Boolean(check.path && fileSet.has(check.path));
    return toChecklistItem(check.id, check.title, passed, check.detail, check.blocking);
  });

  const metadataChecks = [
    toChecklistItem(
      'versioning',
      'Versioning metadata present',
      Boolean(versioning?.artifact_version && versioning?.skill_pack?.skill_version),
      'skill-pack index / manifest / skill.json should agree on release_version, artifact_version, and skill_version.',
      true,
    ),
    toChecklistItem(
      'compatibility',
      'Compatibility contract present',
      Boolean(compatibility?.openclaw_loader && compatibility?.install_layout),
      'Compatibility should say which OpenClaw loader/layout this skill-pack targets.',
      false,
    ),
    toChecklistItem(
      'install-strategy',
      'Install / upgrade strategy present',
      Boolean(installStrategy?.mode && installStrategy?.target_directory && installSteps.length),
      'Install strategy should say whether to copy the directory or apply the .skill archive and where it should live.',
      false,
    ),
  ];

  const combinedChecklist = [...checklist, ...metadataChecks];
  const missing = combinedChecklist.filter((item) => !item.passed && item.blocking).map((item) => item.title);
  const warnings = combinedChecklist.filter((item) => !item.passed && !item.blocking).map((item) => item.title);
  const passedCount = combinedChecklist.filter((item) => item.passed).length;
  const score = Math.round((passedCount / combinedChecklist.length) * 100);
  const installable = missing.length === 0;
  const usable = installable && warnings.length === 0;
  const ready = installable && Boolean(versioning?.artifact_version) && Boolean(entrypoints?.skill_md) && fileSet.has(entrypoints.skill_md);

  let recommendedNextStep = {
    id: 'regenerate',
    title: '补齐缺口后再安装',
    reason: '当前 skill-pack 仍缺少阻塞项，先补齐再进入 OpenClaw 工作区。',
  };

  if (usable) {
    recommendedNextStep = {
      id: 'install',
      title: '现在可以安装到 OpenClaw',
      reason: 'Skill-pack 已具备目录、归档、版本和兼容性元数据。',
    };
  } else if (installable) {
    recommendedNextStep = {
      id: 'review',
      title: '先看兼容性 / 版本提示再安装',
      reason: '阻塞项已清空，但仍建议先确认兼容性和升级说明。',
    };
  }

  return {
    task_id: task.task_id,
    skill_name: skillName,
    score,
    ready,
    installable,
    usable,
    missing,
    warnings,
    checklist: combinedChecklist,
    compatibility,
    install_strategy: installStrategy,
    recommended_next_step: recommendedNextStep,
  };
}
