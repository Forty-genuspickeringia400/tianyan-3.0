export class EventBus {
  constructor(eventStore) {
    this.eventStore = eventStore;
    this.listeners = new Set();
  }

  async publish(event) {
    await this.eventStore.append(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
