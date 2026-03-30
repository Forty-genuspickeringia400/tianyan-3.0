import { config } from '../config.js';

export class SkillProfileService {
  getProfile() {
    return {
      mode: 'skill-pack',
      release_version: config.projectVersion,
      trigger_examples: [
        'Need a runnable task orchestration package with UI and API',
        'Need a reusable OpenClaw skill-pack with install and verify chain',
        'Need visible lifecycle, events, and evidence for delivery work',
      ],
      contract: {
        input_schema: {
          goal: 'string',
          context: 'object?',
          constraints: 'string[]?',
        },
        output_schema: {
          task_id: 'string',
          status: 'string',
          artifacts: 'string[]',
          bundle: '{ readme, index, manifest, bundle_markdown, zip, versioning }',
          skill_pack: '{ readme, index, manifest, directory, skill_md, skill_json, archive, helper_script, installation_report, readiness, installation, versioning }',
        },
        safe_actions: ['write_artifact', 'write_text_file', 'bundle_task_outputs', 'run_command(node/npm)'],
      },
      packaging: {
        sku: 'agentx-3-skill-pack',
        exportable: true,
        auto_install_enabled: config.autoInstallSkillPacks,
        workspace_skills_dir: config.workspaceSkillsDir,
        managed_namespace: `${config.generatedSkillNamespace}--<skill-slug>`,
        deliverables: ['bundle-export', 'installable-skill-pack', 'installation-receipt'],
        upgrade_strategy: 'backup -> replace existing managed install -> verify -> reload',
      },
    };
  }
}
