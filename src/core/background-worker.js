export class BackgroundWorker {
  constructor({ evolutionService }) {
    this.evolutionService = evolutionService;
  }

  runConsolidation(triggerTask = null) {
    return this.evolutionService.runDreamCycle(triggerTask);
  }
}
