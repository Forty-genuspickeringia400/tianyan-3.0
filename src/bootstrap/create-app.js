import { metaCore } from '../meta/meta-core.js';
import { EventBus } from '../core/event-bus.js';
import { Orchestrator } from '../core/orchestrator.js';
import { BackgroundWorker } from '../core/background-worker.js';
import { SensorAgent } from '../agents/sensor.js';
import { InterpreterAgent } from '../agents/interpreter.js';
import { PlannerAgent } from '../agents/planner.js';
import { DeciderAgent } from '../agents/decider.js';
import { ResponderAgent } from '../agents/responder.js';
import { ReflectorAgent } from '../agents/reflector.js';
import { ReflexMatcherAgent } from '../agents/reflex-matcher.js';
import { VerifierAgent } from '../agents/verifier.js';
import { TaskStore } from '../stores/task-store.js';
import { EventStore } from '../stores/event-store.js';
import { MemoryStore } from '../stores/memory-store.js';
import { BackgroundRunStore } from '../stores/background-run-store.js';
import { EvolutionCapsuleStore } from '../stores/evolution-capsule-store.js';
import { EvolutionRecordStore } from '../stores/evolution-record-store.js';
import { MemoryService } from '../services/memory-service.js';
import { GuardrailService } from '../services/guardrail-service.js';
import { RouterService } from '../services/router-service.js';
import { ProcessorService } from '../services/processor-service.js';
import { ToolRegistry } from '../services/tool-registry.js';
import { WorkflowService } from '../services/workflow-service.js';
import { SchedulerService } from '../services/scheduler-service.js';
import { IOService } from '../services/io-service.js';
import { InsightService } from '../services/insight-service.js';
import { CleanerService } from '../services/cleaner-service.js';
import { DeployerService } from '../services/deployer-service.js';
import { AdapterRuntime } from '../runtime/adapter-runtime.js';
import { ExecutorService } from '../runtime/executor-service.js';
import { ProductCatalogService } from '../product/catalog-service.js';
import { PackageService } from '../product/package-service.js';
import { RuntimeProfileService } from '../runtime/runtime-profile-service.js';
import { SkillProfileService } from '../skills/skill-profile-service.js';
import { SkillInstallService } from '../skills/skill-install-service.js';
import { ArchitectureService } from '../architecture/architecture-service.js';
import { AgentRegistry } from '../federation/agent-registry.js';
import { DelegationManager } from '../federation/delegation-manager.js';
import { FederatedMemoryBoundary } from '../federation/federated-memory-boundary.js';
import { EvolutionService } from '../evolution/evolution-service.js';
import { DashboardService } from '../dashboard/dashboard-service.js';
import { SoulService } from '../soul/soul-service.js';
import { DefenseMatrixService } from '../defense/defense-matrix-service.js';
import { NetworkSecurityService } from '../security/network-security-service.js';
import { LicenseService } from '../security/license-service.js';
import { config } from '../config.js';

export function createApp() {
  const taskStore = new TaskStore();
  const eventStore = new EventStore();
  const memoryStore = new MemoryStore();
  const backgroundRunStore = new BackgroundRunStore();
  const capsuleStore = new EvolutionCapsuleStore();
  const recordStore = new EvolutionRecordStore();
  const eventBus = new EventBus(eventStore);
  const memoryService = new MemoryService(memoryStore);
  const skillInstallService = new SkillInstallService();
  const adapterRuntime = new AdapterRuntime({ skillInstallService });
  const agentRegistry = new AgentRegistry();
  const architectureService = new ArchitectureService({ metaCore, agentRegistry });
  const guardrailService = new GuardrailService(metaCore);
  const cleanerService = new CleanerService();
  const verifier = new VerifierAgent();
  const federatedMemoryBoundary = new FederatedMemoryBoundary();
  const evolutionService = new EvolutionService({
    taskStore,
    memoryService,
    backgroundRunStore,
    capsuleStore,
    recordStore,
    metaCore,
  });
  const soulService = new SoulService({ metaCore, memoryService, evolutionService });
  const networkSecurityService = new NetworkSecurityService({
    metaCore,
    runtimeConfig: config,
    guardrailService,
    federatedMemoryBoundary,
  });
  const licenseService = new LicenseService({ runtimeConfig: config });
  const defenseMatrixService = new DefenseMatrixService({
    metaCore,
    memoryService,
    eventStore,
    guardrailService,
    cleanerService,
    verifier,
    federatedMemoryBoundary,
    networkSecurityService,
  });
  const productCatalog = new ProductCatalogService({ architectureService });
  const packageService = new PackageService({ skillInstallService });
  const runtimeProfile = new RuntimeProfileService();
  const skillProfile = new SkillProfileService();
  const dashboardService = new DashboardService({
    architectureService,
    taskStore,
    eventStore,
    backgroundRunStore,
    agentRegistry,
    skillInstallService,
    metaCore,
    packageService,
    soulService,
    defenseMatrixService,
    networkSecurityService,
    evolutionService,
  });

  const app = {
    metaCore,
    taskStore,
    eventStore,
    memoryStore,
    backgroundRunStore,
    capsuleStore,
    recordStore,
    eventBus,
    adapterRuntime,
    productCatalog,
    packageService,
    runtimeProfile,
    skillProfile,
    skillInstallService,
    architectureService,
    dashboardService,
    soulService,
    defenseMatrixService,
    networkSecurityService,
    licenseService,
    agentRegistry,
    backgroundWorker: new BackgroundWorker({
      evolutionService,
    }),
    evolutionService,
    orchestrator: new Orchestrator({
      metaCore,
      taskStore,
      eventBus,
      memoryService,
      guardrailService,
      routerService: new RouterService(),
      workflowService: new WorkflowService(),
      schedulerService: new SchedulerService(),
      executorService: new ExecutorService(adapterRuntime),
      deployerService: new DeployerService(),
      processorService: new ProcessorService(),
      ioService: new IOService(),
      insightService: new InsightService(),
      cleanerService,
      toolRegistry: new ToolRegistry(),
      sensor: new SensorAgent(),
      interpreter: new InterpreterAgent(),
      planner: new PlannerAgent(),
      decider: new DeciderAgent(),
      responder: new ResponderAgent(),
      reflector: new ReflectorAgent(),
      verifier,
      reflexMatcher: new ReflexMatcherAgent(),
      architectureService,
      agentRegistry,
      delegationManager: new DelegationManager(),
      federatedMemoryBoundary,
      evolutionService,
    }),
  };

  return app;
}
