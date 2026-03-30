export class CleanerService {
  compact(task) {
    return {
      evidence_count: (task.evidence || []).length,
      artifact_count: task.result?.output?.artifacts?.length || 0,
      compacted_at: new Date().toISOString(),
    };
  }
}
