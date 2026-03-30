export class GuardrailService {
  constructor(metaCore) {
    this.metaCore = metaCore;
  }

  check(task) {
    const text = `${task.goal} ${JSON.stringify(task.input)}`.toLowerCase();
    const blockedWords = this.metaCore.policy.blockedWithoutApproval || [];
    const matched = blockedWords.filter((word) => text.includes(word));
    const approved = Boolean(task.context?.approved);

    if (task.risk_level === 'high' || matched.length > 0) {
      if (!approved) {
        return {
          allowed: false,
          requiresApproval: true,
          reason: `Approval required for risky action: ${matched.join(', ') || task.risk_level}`,
        };
      }
    }

    return { allowed: true, requiresApproval: false, reason: 'ok' };
  }
}
