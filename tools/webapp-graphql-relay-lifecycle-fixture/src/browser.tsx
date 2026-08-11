import { RouterProvider, createBrowserHistory } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { LifecycleLedger, type LifecycleEvent } from "./ledger.js";
import {
  ControlledRelayNetwork,
  createControlledRelayEnvironment,
} from "./network.js";
import { createLifecycleRouter } from "./router-fixture.js";

export type BrowserLifecycleFixture = {
  beginNavigation(to: string): void;
  events(): readonly LifecycleEvent[];
  finishNavigation(): Promise<void>;
  historyBack(): void;
  historyForward(): void;
  readonly runtimeId: string;
  resolve(operationName: string, itemId: string, label: string): boolean;
  teardown(): Promise<readonly LifecycleEvent[]>;
};

declare global {
  interface Window {
    lifecycleFixture: BrowserLifecycleFixture;
  }
}

const container = document.querySelector("#root");
if (!(container instanceof HTMLElement)) {
  throw new Error("Lifecycle fixture root is missing.");
}

const ledger = new LifecycleLedger();
const runtimeId = crypto.randomUUID();
ledger.record("test-run-start", { runtimeId });
const network = new ControlledRelayNetwork(ledger);
const environment = createControlledRelayEnvironment(network);
const history = createBrowserHistory();
const router = createLifecycleRouter(history, { environment, ledger });
const root = createRoot(container, {
  onCaughtError: (error) => {
    ledger.record("react-caught-error", {
      message: error instanceof Error ? error.message : String(error),
    });
  },
  onRecoverableError: (error) => {
    ledger.record("react-recoverable-error", {
      message: error instanceof Error ? error.message : String(error),
    });
  },
  onUncaughtError: (error) => {
    throw error;
  },
});
let pendingNavigation: Promise<void> | undefined;
let tornDown = false;

await router.load();
root.render(
  <RelayEnvironmentProvider environment={environment}>
    <RouterProvider router={router} />
  </RelayEnvironmentProvider>,
);

window.lifecycleFixture = {
  beginNavigation(to) {
    if (pendingNavigation) {
      throw new Error("A browser fixture navigation is already pending.");
    }
    ledger.record("navigation-start", { to });
    pendingNavigation = router.navigate({ to });
  },
  events: () => ledger.events(),
  async finishNavigation() {
    const navigation = pendingNavigation;
    if (!navigation) {
      throw new Error("No browser fixture navigation is pending.");
    }
    try {
      await navigation;
      ledger.record("navigation-complete", {
        to: router.state.location.pathname,
      });
    } finally {
      pendingNavigation = undefined;
    }
  },
  historyBack() {
    ledger.record("history-back");
    history.back();
  },
  historyForward() {
    ledger.record("history-forward");
    history.forward();
  },
  resolve(operationName, itemId, label) {
    const request = network.pendingRequest(operationName, itemId);
    if (!request) {
      return false;
    }
    network.resolve(request, label);
    return true;
  },
  runtimeId,
  async teardown() {
    if (tornDown) {
      return ledger.events();
    }
    tornDown = true;
    if (router.state.location.pathname !== "/") {
      await router.navigate({ to: "/" });
    }
    router.clearCache();
    root.unmount();
    return ledger.events();
  },
};
