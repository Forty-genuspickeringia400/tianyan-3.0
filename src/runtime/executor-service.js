import { createEvidence } from '../core/task-factory.js';

export class ExecutorService {
  constructor(adapterRuntime) {
    this.adapterRuntime = adapterRuntime;
  }

  async execute(task, runtime = {}) {
    const adapters = runtime.tools || [];
    const analysis = runtime.analysis || {};
    const steps = (task.plan?.steps || []).map((step) => ({ ...step, status: 'done' }));

    const adapterOutputs = [];
    for (const adapter of adapters) {
      const prepared = adapter.run(task, analysis);
      const actionResults = [];
      for (const action of prepared.actions || []) {
        const result = await this.adapterRuntime.execute(action, {
          task,
          analysis,
          cwd: runtime.cwd,
        });
        actionResults.push(result);
      }
      adapterOutputs.push({
        ...prepared,
        action_results: actionResults,
      });
    }

    const artifacts = adapterOutputs.map((item) => item.artifact).filter(Boolean);
    const actionResults = adapterOutputs.flatMap((item) => item.action_results || []);
    const bundle = actionResults.find((item) => item.kind === 'bundle_task_outputs' && item.success) || null;

    const output = {
      completed_steps: steps.length,
      artifacts: artifacts.map((artifact) => artifact.type),
      artifact_details: artifacts,
      execution_mode: task.mode,
      product_track: task.product_track || 'runtime-studio',
      note: task.context?.approved
        ? 'Executed with approval where required.'
        : 'Executed under current safety policy.',
      keywords: analysis.keywords || [],
      adapter_outputs: adapterOutputs,
      action_results: actionResults,
      subtasks_created: Array.isArray(task.subtasks) ? task.subtasks.length : 0,
      runtime_summary: {
        total_actions: actionResults.length,
        successful_actions: actionResults.filter((item) => item.success).length,
        failed_actions: actionResults.filter((item) => !item.success).length,
      },
      bundle: bundle
        ? {
            readme: 'README.md',
            index: 'index.json',
            manifest: 'bundle/manifest.json',
            bundle_markdown: 'bundle/bundle.md',
            zip: 'bundle/bundle.zip',
            downloads: bundle.downloads || null,
            skill_pack: bundle.skillPack || null,
          }
        : null,
    };

    return {
      success: actionResults.every((item) => item.success),
      output,
      evidence: [
        createEvidence('tool_output', output),
        createEvidence('execution-adapters', adapterOutputs),
        createEvidence('adapter-runtime', output.runtime_summary),
      ],
      plan: task.plan ? { ...task.plan, steps } : null,
    };
  }
}
