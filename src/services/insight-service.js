export class InsightService {
  summarize(task) {
    return {
      mode: task.mode,
      status: task.status,
      deliverables: task.analysis?.deliverables || [],
      verification: task.verification || null,
      summary: task.result?.summary || task.result?.user_response || null,
    };
  }
}
