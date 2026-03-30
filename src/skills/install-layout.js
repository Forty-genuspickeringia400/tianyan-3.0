import { config } from '../config.js';

export function buildManagedSkillDirectoryName(skillSlug) {
  const safeSlug = String(skillSlug || 'unnamed-skill').trim() || 'unnamed-skill';
  return `${config.generatedSkillNamespace}--${safeSlug}`;
}

export function buildManagedSkillLayout(skillSlug) {
  const directoryName = buildManagedSkillDirectoryName(skillSlug);
  return {
    directory_name: directoryName,
    relative_path: `skills/${directoryName}`,
  };
}

export function buildManagedSkillPath(skillSlug) {
  const layout = buildManagedSkillLayout(skillSlug);
  return {
    ...layout,
    absolute_path: `${config.workspaceSkillsDir}/${layout.directory_name}`,
  };
}
