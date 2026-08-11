import { act, StrictMode, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { LifecycleLedger } from "../src/ledger.js";
import {
  ControlledRelayNetwork,
  createControlledRelayEnvironment,
} from "../src/network.js";
import {
  createLifecycleRouter,
  type LifecycleRouterOptions,
} from "../src/router-fixture.js";

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

export type LifecycleHarness = Awaited<ReturnType<typeof createHarness>>;

export async function createHarness(options: {
  initialEntry: string;
  routerOptions?: LifecycleRouterOptions;
  strictMode?: boolean;
}) {
  window.scrollTo = () => undefined;
  Object.defineProperty(globalThis, "scrollTo", {
    configurable: true,
    value: window.scrollTo,
    writable: true,
  });
  const container = document.createElement("div");
  container.id = "root";
  document.body.replaceChildren(container);
  const ledger = new LifecycleLedger();
  ledger.record("test-run-start", { runtimeId: "runtime-1" });
  const network = new ControlledRelayNetwork(ledger);
  const environment = createControlledRelayEnvironment(network);
  const history = createMemoryHistory({
    initialEntries: [options.initialEntry],
  });
  const router = createLifecycleRouter(
    history,
    { environment, ledger },
    options.routerOptions,
  );
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
  let tornDown = false;
  await router.load();
  const application = (
    <RelayEnvironmentProvider environment={environment}>
      <RouterProvider router={router} />
    </RelayEnvironmentProvider>
  );
  await act(async () => {
    root.render(
      options.strictMode ? <StrictMode>{application}</StrictMode> : application,
    );
  });

  const beginNavigation = async (to: string) => {
    let navigation: Promise<void>;
    ledger.record("navigation-start", { to });
    await act(async () => {
      navigation = router.navigate({ to });
    });
    const finished = navigation!.then(
      () => {
        ledger.record("navigation-complete", { to });
      },
      (error: unknown) => {
        ledger.record("navigation-error", {
          message: error instanceof Error ? error.message : String(error),
          to,
        });
        throw error;
      },
    );
    return { finished };
  };

  const navigate = async (to: string) => {
    const navigation = await beginNavigation(to);
    await navigation.finished;
  };

  const clearCache = () => {
    ledger.record("cache-clear");
    router.clearCache();
  };

  const historyBack = () => {
    ledger.record("history-back");
    history.back();
  };

  const historyForward = () => {
    ledger.record("history-forward");
    history.forward();
  };

  const invalidate = () => {
    ledger.record("route-invalidate", {
      to: router.state.location.pathname,
    });
    return router.invalidate({ forcePending: true, sync: true });
  };

  const preloadItem = (itemId: string) => {
    ledger.record("preload-start", { itemId });
    return router.preloadRoute({
      params: { itemId },
      to: "/items/$itemId",
    });
  };

  return {
    beginNavigation,
    clearCache,
    container,
    environment,
    history,
    historyBack,
    historyForward,
    invalidate,
    ledger,
    network,
    preloadItem,
    root,
    router,
    async flush() {
      await act(async () => {
        await Promise.resolve();
      });
    },
    async teardown() {
      if (tornDown) {
        return;
      }
      tornDown = true;
      if (router.state.location.pathname !== "/") {
        await navigate("/");
      }
      clearCache();
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
    async waitForText(testId: string, expected: string) {
      await waitForMutation(
        container,
        () => {
          const target = container.querySelector(`[data-testid="${testId}"]`);
          return target?.textContent?.includes(expected) === true;
        },
        ledger,
      );
    },
    navigate,
  };
}

async function waitForMutation(
  container: Element,
  predicate: () => boolean,
  ledger: LifecycleLedger,
): Promise<void> {
  if (predicate()) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(
        new Error(
          `DOM condition was not met. Current DOM: ${container.innerHTML}\n${ledger.format()}`,
        ),
      );
    }, 5_000);
    const observer = new MutationObserver(() => {
      if (!predicate()) {
        return;
      }
      clearTimeout(timeout);
      observer.disconnect();
      resolve();
    });
    observer.observe(container, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
}

export function renderWithOptionalStrictMode(
  root: Root,
  application: ReactElement,
  strictMode: boolean,
): void {
  root.render(
    strictMode ? <StrictMode>{application}</StrictMode> : application,
  );
}
