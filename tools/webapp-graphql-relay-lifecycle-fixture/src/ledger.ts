export type LifecycleEventDetails = Record<
  string,
  boolean | number | string | undefined
>;

export type LifecycleEvent = {
  details: LifecycleEventDetails;
  kind: string;
  sequence: number;
};

export class LifecycleLedger {
  readonly #events: LifecycleEvent[] = [];

  public record(kind: string, details: LifecycleEventDetails = {}): void {
    this.#events.push({
      details,
      kind,
      sequence: this.#events.length + 1,
    });
  }

  public count(
    kind: string,
    predicate: (event: LifecycleEvent) => boolean = () => true,
  ): number {
    return this.#events.filter(
      (event) => event.kind === kind && predicate(event),
    ).length;
  }

  public events(kind?: string): readonly LifecycleEvent[] {
    return kind
      ? this.#events.filter((event) => event.kind === kind)
      : [...this.#events];
  }

  public first(
    kind: string,
    predicate: (event: LifecycleEvent) => boolean = () => true,
  ): LifecycleEvent | undefined {
    return this.#events.find(
      (event) => event.kind === kind && predicate(event),
    );
  }

  public format(): string {
    return this.#events
      .map(
        (event) =>
          `${event.sequence}. ${event.kind} ${JSON.stringify(event.details)}`,
      )
      .join("\n");
  }
}
