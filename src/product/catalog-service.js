import { config } from '../config.js';

export class ProductCatalogService {
  constructor({ architectureService }) {
    this.architectureService = architectureService;
  }

  getCatalog() {
    return {
      product_line: {
        slug: config.projectSlug,
        name: config.projectDisplayName,
        positioning: 'Runnable seven-layer human-agent collaboration runtime with visible modes, lifecycle, events, evidence, and reusable skill-pack delivery.',
        modes: this.architectureService.getModes(),
      },
      layers: this.architectureService.getLayers(),
      packages: [
        {
          id: 'runtime-studio',
          label: 'Runtime Studio',
          audience: 'operators / builders / researchers',
          includes: ['HTTP API', 'Web UI', 'Task lifecycle', 'Evidence', 'Events', 'Architecture visibility'],
        },
        {
          id: 'skill-pack',
          label: 'Skill Pack',
          audience: 'OpenClaw reusable capability delivery',
          includes: ['skill-pack export', '.skill archive', 'managed auto install', 'verify receipt'],
        },
      ],
      install_runtime: {
        auto_install_enabled: config.autoInstallSkillPacks,
        workspace_skills_dir: config.workspaceSkillsDir,
        managed_namespace: `${config.generatedSkillNamespace}--<skill-slug>`,
      },
    };
  }
}
