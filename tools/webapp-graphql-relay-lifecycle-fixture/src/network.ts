import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
  type FetchFunction,
  type GraphQLResponse,
  type RequestParameters,
  type Variables,
} from "relay-runtime";
import { LifecycleLedger } from "./ledger.js";

type NetworkSink = Parameters<Parameters<typeof Observable.create>[0]>[0];

export type ControlledRequest = {
  itemId: string;
  operationName: string;
  requestId: string;
};

type PendingRequest = ControlledRequest & {
  settled: boolean;
  sink: NetworkSink;
};

type RequestWaiter = {
  itemId: string;
  operationName: string;
  resolve(request: ControlledRequest): void;
};

export class ControlledRelayNetwork {
  readonly #ledger: LifecycleLedger;
  readonly #pending = new Map<string, PendingRequest>();
  readonly #requests: ControlledRequest[] = [];
  readonly #waiters: RequestWaiter[] = [];
  #nextRequest = 1;

  public constructor(ledger: LifecycleLedger) {
    this.#ledger = ledger;
  }

  public readonly fetch: FetchFunction = (
    request: RequestParameters,
    variables: Variables,
  ) =>
    Observable.create((sink) => {
      const operationName = request.name;
      const itemId = String(variables.id);
      const requestId = `request-${this.#nextRequest}`;
      this.#nextRequest += 1;
      const controlledRequest = { itemId, operationName, requestId };
      const pendingRequest: PendingRequest = {
        ...controlledRequest,
        settled: false,
        sink,
      };
      this.#pending.set(requestId, pendingRequest);
      this.#requests.push(controlledRequest);
      this.#ledger.record("network-subscribe", controlledRequest);
      this.#resolveWaiters(controlledRequest);

      return () => {
        if (!pendingRequest.settled) {
          this.#ledger.record("network-cancel", controlledRequest);
        }
        this.#ledger.record("network-unsubscribe", controlledRequest);
        this.#pending.delete(requestId);
      };
    });

  public requests(
    operationName?: string,
    itemId?: string,
  ): readonly ControlledRequest[] {
    return this.#requests.filter(
      (request) =>
        (!operationName || request.operationName === operationName) &&
        (!itemId || request.itemId === itemId),
    );
  }

  public waitForRequest(
    operationName: string,
    itemId: string,
    occurrence = 0,
  ): Promise<ControlledRequest> {
    const existing = this.requests(operationName, itemId)[occurrence];
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve) => {
      this.#waiters.push({ itemId, operationName, resolve });
    });
  }

  public resolve(request: ControlledRequest, label?: string): void {
    const pending = this.#getPending(request);
    pending.settled = true;
    const field =
      request.operationName === "LifecycleSecondaryQuery"
        ? "secondaryItem"
        : "item";
    const recordId =
      request.operationName === "LifecycleSecondaryQuery"
        ? `${request.itemId}-secondary`
        : request.itemId;
    const response = {
      data: {
        [field]: {
          id: recordId,
          label: label ?? `${request.operationName}:${request.itemId}`,
        },
      },
    } as GraphQLResponse;
    this.#ledger.record("network-next", request);
    pending.sink.next(response);
    this.#ledger.record("network-complete", request);
    pending.sink.complete();
  }

  public reject(request: ControlledRequest, message: string): void {
    const pending = this.#getPending(request);
    pending.settled = true;
    this.#ledger.record("network-error", {
      ...request,
      message,
    });
    pending.sink.error(new Error(message));
  }

  public pendingCount(): number {
    return [...this.#pending.values()].filter((request) => !request.settled)
      .length;
  }

  public pendingRequest(
    operationName: string,
    itemId: string,
  ): ControlledRequest | undefined {
    return [...this.#pending.values()].find(
      (request) =>
        !request.settled &&
        request.operationName === operationName &&
        request.itemId === itemId,
    );
  }

  #getPending(request: ControlledRequest): PendingRequest {
    const pending = this.#pending.get(request.requestId);
    if (!pending || pending.settled) {
      throw new Error(`Request ${request.requestId} is not pending.`);
    }
    return pending;
  }

  #resolveWaiters(request: ControlledRequest): void {
    const matchingIndex = this.#waiters.findIndex(
      (waiter) =>
        waiter.operationName === request.operationName &&
        waiter.itemId === request.itemId,
    );
    if (matchingIndex < 0) {
      return;
    }
    const [waiter] = this.#waiters.splice(matchingIndex, 1);
    waiter.resolve(request);
  }
}

export function createControlledRelayEnvironment(
  network: ControlledRelayNetwork,
): Environment {
  return new Environment({
    network: Network.create(network.fetch),
    store: new Store(new RecordSource()),
  });
}
