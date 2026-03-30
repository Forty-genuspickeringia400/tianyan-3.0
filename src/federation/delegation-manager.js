function matchAgent(deliverable, agents = []) {
  const value = String(deliverable || '').toLowerCase();
  const ordered = agents.slice();
  if (!ordered.length) return null;
  if (/(architecture|plan|test)/.test(value)) return ordered.find((agent) => agent.role === 'planner') || ordered[0];
  if (/(api|verify|review)/.test(value)) return ordered.find((agent) => agent.role === 'reviewer') || ordered[0];
  if (/(skill|runtime|document|brief|implement)/.test(value)) return ordered.find((agent) => agent.role === 'builder') || ordered[0];
  if (/(install|deploy|handoff)/.test(value)) return ordered.find((agent) => agent.role === 'operator') || ordered[0];
  return ordered[0];
}

export class DelegationManager {
  createPlan(task, analysis = {}, registryAgents = [], boundary = null) {
    const deliverables = analysis.deliverables?.length ? analysis.deliverables : ['task-summary'];
    const agents = registryAgents.length ? registryAgents : [];
    const assignments = deliverables.map((deliverable, index) => {
      const agent = matchAgent(deliverable, agents) || { agent_id: 'registry.builder', role: 'builder', label: 'Builder Node' };
      return {
        assignment_id: `${task.task_id}-asg-${index + 1}`,
        deliverable,
        agent_id: agent.agent_id,
        agent_role: agent.role,
        agent_label: agent.label,
        locality: agent.locality || 'local-process',
        status: 'planned',
        coordination_channel: `local-bus://${task.task_id}/${agent.agent_id}`,
      };
    });

    const waves = assignments.map((assignment, index) => ({
      wave: index + 1,
      assignments: [assignment.assignment_id],
      objective: assignment.deliverable,
    }));

    return {
      federation_mode: 'local-runtime',
      assignments,
      waves,
      boundary,
      coordination_protocol: 'local event bus + task-scoped memory boundary',
      aggregation_strategy: 'deliverable-first aggregation with task-level verification',
      created_at: new Date().toISOString(),
      readiness: {
        registry_agents: agents.length,
        planned_assignments: assignments.length,
        boundary_enforced: Boolean(boundary),
      },
    };
  }

  aggregate(task, subtaskResults = []) {
    const planned = task.delegation?.assignments || [];
    const completedDeliverables = subtaskResults.map((item) => item.deliverable).filter(Boolean);
    const completedSet = new Set(completedDeliverables);
    const coverage = planned.map((assignment) => ({
      deliverable: assignment.deliverable,
      agent_id: assignment.agent_id,
      completed: completedSet.has(assignment.deliverable),
    }));

    return {
      task_id: task.task_id,
      assignment_count: planned.length,
      completed_count: subtaskResults.length,
      completed_deliverables: completedDeliverables,
      uncovered_deliverables: coverage.filter((item) => !item.completed).map((item) => item.deliverable),
      coverage,
      summary: subtaskResults.length
        ? 'Delegated outputs were aggregated back into the main task with per-deliverable coverage.'
        : 'Delegation plan created; no delegated outputs completed yet.',
    };
  }
}
