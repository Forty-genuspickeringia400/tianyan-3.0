import { createEvent, createEvidence } from '../core/task-factory.js';
import { EVENT_TYPES } from '../domain/task.js';

export class VerifierAgent {
  name = 'verifier';

  async run(ctx) {
    const result = ctx.task_card.result || {};
    const evidenceCount = (ctx.task_card.evidence || []).length;
    const artifacts = result.output?.artifacts || [];
    const bundle = result.output?.bundle;
    const passed = Boolean(result.success) && evidenceCount >= 1 && artifacts.length >= 1 && Boolean(bundle?.zip);

    return {
      task_patch: {
        verification: {
          passed,
          evidence_count: evidenceCount,
          artifact_count: artifacts.length,
          bundle_ready: Boolean(bundle?.zip),
        },
      },
      evidence: [createEvidence('verification', { passed, evidenceCount, artifacts, bundle })],
      events: [createEvent(ctx.task_card.task_id, passed ? EVENT_TYPES.VERIFICATION_PASSED : EVENT_TYPES.VERIFICATION_FAILED, this.name, { passed, evidenceCount, artifactCount: artifacts.length, bundleReady: Boolean(bundle?.zip) })],
      next_action: passed ? 'respond' : 'retry or inspect result',
    };
  }
}
