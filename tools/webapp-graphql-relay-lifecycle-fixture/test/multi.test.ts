import assert from "node:assert/strict";
import { act } from "react";
import { describe, test } from "vitest";
import { expectConsoleOutput } from "./console-guard.js";
import { createHarness } from "./harness.js";

describe("M1/M2: two references render independently of completion order", () => {
  for (const order of ["primary-first", "secondary-first"] as const) {
    test(order, async () => {
      const harness = await createHarness({ initialEntry: "/pairs/P" });
      try {
        const primary = await harness.network.waitForRequest(
          "LifecyclePrimaryQuery",
          "P",
        );
        const secondary = await harness.network.waitForRequest(
          "LifecycleSecondaryQuery",
          "P",
        );
        const first = order === "primary-first" ? primary : secondary;
        const second = order === "primary-first" ? secondary : primary;
        await act(async () => {
          harness.network.resolve(first);
        });
        assert.equal(harness.ledger.count("reference-release"), 0);
        await act(async () => {
          harness.network.resolve(second);
        });
        await harness.waitForText("pair", "LifecyclePrimaryQuery:P");
        await harness.waitForText("pair", "LifecycleSecondaryQuery:P");
        assert.equal(harness.ledger.count("reference-create"), 2);
        assert.equal(harness.ledger.count("reference-release"), 0);
      } finally {
        await harness.teardown();
      }
    });
  }
});

test("M3: abandoning a partially completed pair releases both references", async () => {
  const harness = await createHarness({ initialEntry: "/pairs/M3" });
  try {
    const primary = await harness.network.waitForRequest(
      "LifecyclePrimaryQuery",
      "M3",
    );
    const secondary = await harness.network.waitForRequest(
      "LifecycleSecondaryQuery",
      "M3",
    );
    await act(async () => {
      harness.network.resolve(primary, "Primary complete");
    });
    await harness.navigate("/");
    await harness.waitForText("landing", "Landing");
    assert.equal(
      harness.ledger.count(
        "network-cancel",
        (event) => event.details.requestId === secondary.requestId,
      ),
      1,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count("reference-release"),
      2,
      harness.ledger.format(),
    );
  } finally {
    await harness.teardown();
  }
});

test("M4: partial query failure retries with two fresh references", async () => {
  const harness = await createHarness({ initialEntry: "/pairs/M4" });
  try {
    const firstPrimary = await harness.network.waitForRequest(
      "LifecyclePrimaryQuery",
      "M4",
    );
    const firstSecondary = await harness.network.waitForRequest(
      "LifecycleSecondaryQuery",
      "M4",
    );
    expectConsoleOutput(/console\.warn: Warning: Error in route match: .*M4/);
    await act(async () => {
      harness.network.resolve(firstPrimary, "First primary");
      harness.network.reject(firstSecondary, "Expected pair failure");
    });
    await harness.waitForText("route-error", "Expected pair failure");
    const retryButton = harness.container.querySelector(
      '[data-testid="retry"]',
    );
    assert.ok(retryButton instanceof HTMLElement);
    await act(async () => {
      retryButton.click();
    });

    const secondPrimary = await harness.network.waitForRequest(
      "LifecyclePrimaryQuery",
      "M4",
      1,
    );
    const secondSecondary = await harness.network.waitForRequest(
      "LifecycleSecondaryQuery",
      "M4",
      1,
    );
    await act(async () => {
      harness.network.resolve(secondSecondary, "Second secondary");
      harness.network.resolve(secondPrimary, "Second primary");
    });
    await harness.waitForText("pair", "Second primary");
    await harness.waitForText("pair", "Second secondary");
    assert.equal(
      harness.ledger.count("reference-create"),
      4,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count("reference-release"),
      2,
      harness.ledger.format(),
    );
  } finally {
    await harness.teardown();
  }
});

test("M5: partial construction failure releases the first reference", async () => {
  expectConsoleOutput(/console\.warn: Warning: Error in route match: .*M5/);
  const harness = await createHarness({
    initialEntry: "/pairs/M5",
    routerOptions: { failPairAfterPrimary: true },
  });
  try {
    const primary = await harness.network.waitForRequest(
      "LifecyclePrimaryQuery",
      "M5",
    );
    await harness.waitForText(
      "route-error",
      "Expected partial pair construction failure",
    );
    assert.equal(
      harness.ledger.count(
        "network-cancel",
        (event) => event.details.requestId === primary.requestId,
      ),
      1,
      harness.ledger.format(),
    );
    assert.equal(harness.ledger.count("reference-create"), 1);
    assert.equal(harness.ledger.count("reference-release"), 1);
    assert.equal(
      harness.network.requests("LifecycleSecondaryQuery", "M5").length,
      0,
    );
    assert.equal(harness.ledger.count("react-caught-error"), 1);
  } finally {
    await harness.teardown();
  }
});

test("T1: final teardown releases every route-owned reference", async () => {
  const harness = await createHarness({ initialEntry: "/pairs/T" });
  const primary = await harness.network.waitForRequest(
    "LifecyclePrimaryQuery",
    "T",
  );
  const secondary = await harness.network.waitForRequest(
    "LifecycleSecondaryQuery",
    "T",
  );
  await act(async () => {
    harness.network.resolve(primary);
    harness.network.resolve(secondary);
  });
  await harness.waitForText("pair", "LifecycleSecondaryQuery:T");
  await harness.teardown();
  assert.equal(harness.ledger.count("reference-create"), 2);
  assert.equal(
    harness.ledger.count("reference-release"),
    2,
    harness.ledger.format(),
  );
  assert.equal(harness.network.pendingCount(), 0, harness.ledger.format());
});
