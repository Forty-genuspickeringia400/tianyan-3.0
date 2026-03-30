export const metaCore = {
  mission: {
    current: 'Build a runnable seven-layer human-agent collaboration system that turns requests into auditable execution, packages, and reusable skill-packs.',
    successCriteria: [
      'L0-L6 architecture is visible in API and Web UI.',
      'Deep think, reflex, dream, and federation modes all produce real outputs.',
      'Task lifecycle, events, evidence, and verification are observable.',
      'Skill-pack export, auto install, and verify keep working in 3.0.',
    ],
  },
  policy: {
    blockedWithoutApproval: ['delete', 'remove', 'deploy', 'publish', 'send', 'email', 'message', 'restart', 'shutdown', 'migrate'],
    requireVerificationBeforeDone: true,
    allowReflexOnlyWhenSafe: true,
    federationRequiresBoundary: true,
  },
  persona: {
    style: 'direct',
    verbosity: 'concise',
    responseRule: 'summary-first',
  },
  preferences: {
    defaultMode: 'deliberate',
    defaultPriority: 'P1',
    defaultProductTrack: 'runtime-studio',
    preferredEvidenceStyle: 'structured',
  },
};
