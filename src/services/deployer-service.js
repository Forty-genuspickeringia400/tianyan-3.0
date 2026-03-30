export class DeployerService {
  summarize(task) {
    const bundle = task.result?.output?.bundle || null;
    const skillPack = bundle?.skill_pack || null;
    return {
      bundle_ready: Boolean(bundle?.zip),
      skill_pack_ready: Boolean(skillPack?.ready),
      install_verified: Boolean(skillPack?.installation?.verification?.passed),
      install_path: skillPack?.installation?.installed_path || null,
      target_track: task.product_track || 'runtime-studio',
    };
  }
}
