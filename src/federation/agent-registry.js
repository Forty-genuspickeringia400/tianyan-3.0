export class AgentRegistry {
  constructor() {
    this.agents = [
      {
        agent_id: 'registry.planner',
        role: 'planner',
        label: 'Planner Node',
        supported_modes: ['deliberate', 'federated'],
        skills: ['planning', 'decomposition', 'task-cards'],
        capacity: 4,
        specialties: ['architecture-outline', 'implementation-plan', 'test-strategy'],
      },
      {
        agent_id: 'registry.builder',
        role: 'builder',
        label: 'Builder Node',
        supported_modes: ['deliberate', 'federated', 'background'],
        skills: ['execution', 'artifacts', 'bundles'],
        capacity: 6,
        specialties: ['runtime-playbook', 'documentation', 'skill-blueprint'],
      },
      {
        agent_id: 'registry.reviewer',
        role: 'reviewer',
        label: 'Reviewer Node',
        supported_modes: ['reflex', 'federated', 'background'],
        skills: ['verification', 'reflection', 'risk-check'],
        capacity: 3,
        specialties: ['test-strategy', 'api-contract', 'verification'],
      },
      {
        agent_id: 'registry.operator',
        role: 'operator',
        label: 'Operator Node',
        supported_modes: ['deliberate', 'federated', 'background'],
        skills: ['install', 'verify', 'handoff'],
        capacity: 2,
        specialties: ['skill-pack-install', 'deployment-summary', 'release-handoff'],
      },
    ];
  }

  list() {
    return this.agents.map((agent) => ({
      ...agent,
      status: 'online',
      locality: 'local-process',
      endpoint: `local://${agent.agent_id}`,
      queue_depth: 0,
    }));
  }
}
