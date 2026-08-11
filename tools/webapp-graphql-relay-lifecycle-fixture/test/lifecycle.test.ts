import assert from "node:assert/strict";
import { act } from "react";
import { test } from "vitest";
import { assertSingleRelayRuntime } from "../src/runtime-contract.js";
import { expectConsoleOutput } from "./console-guard.js";
import { createHarness } from "./harness.js";

test("one supported Relay runtime is shared by the fixture, Labkit, and React Relay", () => {
  const evidence = assertSingleRelayRuntime();
  assert.equal(evidence.reactRelayVersion, "20.1.1");
  assert.equal(evidence.relayRuntimeVersion, "20.1.1");
});

test("B1: direct initial entry suspends and renders the resolved query", async () => {
  const harness = await createHarness({ initialEntry: "/items/A" });
  try {
    const request = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A",
    );
    await act(async () => {
      harness.network.resolve(request, "Item A");
    });
    await harness.waitForText("item", "Item A");
    assert.equal(harness.ledger.count("reference-create"), 1);
    assert.equal(harness.ledger.count("reference-release"), 0);
  } finally {
    await harness.teardown();
  }
});

test("N1: rendered A remains visible until pending B can commit", async () => {
  const harness = await createHarness({ initialEntry: "/items/A" });
  try {
    const requestA = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A",
    );
    await act(async () => {
      harness.network.resolve(requestA, "Item A");
    });
    await harness.waitForText("item", "Item A");

    const { finished: navigationB } = await harness.beginNavigation("/items/B");
    const requestB = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "B",
    );
    assert.match(harness.container.textContent ?? "", /Item A/);
    assert.equal(
      harness.ledger.count(
        "reference-release",
        (event) => event.details.itemId === "A",
      ),
      0,
      harness.ledger.format(),
    );

    await act(async () => {
      harness.network.resolve(requestB, "Item B");
    });
    await navigationB;
    await harness.waitForText("item", "Item B");
    assert.equal(
      harness.ledger.count(
        "reference-release",
        (event) => event.details.itemId === "A",
      ),
      1,
      harness.ledger.format(),
    );
  } finally {
    await harness.teardown();
  }
});

test("N2: superseded pending work is canceled and cannot commit late", async () => {
  const harness = await createHarness({ initialEntry: "/items/A" });
  try {
    const requestA = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A",
    );
    const { finished: navigationB } = await harness.beginNavigation("/items/B");
    const requestB = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "B",
    );
    await act(async () => {
      harness.network.resolve(requestB, "Item B");
    });
    await navigationB;
    await harness.flush();
    await harness.waitForText("item", "Item B");
    assert.equal(
      harness.ledger.count(
        "network-cancel",
        (event) => event.details.requestId === requestA.requestId,
      ),
      1,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count(
        "reference-release",
        (event) => event.details.itemId === "A",
      ),
      1,
      harness.ledger.format(),
    );
    assert.throws(() => harness.network.resolve(requestA, "Late A"));
    assert.match(harness.container.textContent ?? "", /Item B/);
  } finally {
    await harness.teardown();
  }
});

test("N3: rapid replacements commit only the final route", async () => {
  const harness = await createHarness({ initialEntry: "/items/A1" });
  try {
    const requestA1 = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A1",
    );
    const { finished: navigationA2 } =
      await harness.beginNavigation("/items/A2");
    const requestA2 = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A2",
    );
    const { finished: navigationB } = await harness.beginNavigation("/items/B");
    const requestB = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "B",
    );

    await act(async () => {
      harness.network.resolve(requestB, "Final B");
    });
    await Promise.all([navigationA2, navigationB]);
    await harness.waitForText("item", "Final B");
    assert.throws(() => harness.network.resolve(requestA1, "Late A1"));
    assert.throws(() => harness.network.resolve(requestA2, "Late A2"));
    assert.equal(
      harness.ledger.count("network-cancel"),
      2,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count("reference-release"),
      2,
      harness.ledger.format(),
    );
    assert.match(harness.container.textContent ?? "", /Final B/);
  } finally {
    await harness.teardown();
  }
});

test("N4: route parameter replacement keeps identities distinct", async () => {
  const harness = await createHarness({ initialEntry: "/items/one" });
  try {
    const first = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "one",
    );
    await act(async () => {
      harness.network.resolve(first, "Identity one");
    });
    await harness.waitForText("item", "Identity one");

    const { finished: navigation } =
      await harness.beginNavigation("/items/two");
    const second = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "two",
    );
    assert.match(harness.container.textContent ?? "", /Identity one/);
    await act(async () => {
      harness.network.resolve(second, "Identity two");
    });
    await navigation;
    await harness.waitForText("item", "Identity two");
    assert.equal(
      harness.ledger.count(
        "reference-release",
        (event) => event.details.itemId === "one",
      ),
      1,
      harness.ledger.format(),
    );
    assert.match(harness.container.textContent ?? "", /Identity two/);
    assert.doesNotMatch(harness.container.textContent ?? "", /Identity one/);
  } finally {
    await harness.teardown();
  }
});

test("H1: back reloads before render instead of reusing a released reference", async () => {
  const harness = await createHarness({ initialEntry: "/items/A" });
  try {
    const firstA = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A",
    );
    await act(async () => {
      harness.network.resolve(firstA, "Item A first");
    });
    await harness.waitForText("item", "Item A first");

    await harness.navigate("/");
    await harness.waitForText("landing", "Landing");
    assert.equal(
      harness.ledger.count(
        "reference-release",
        (event) => event.details.itemId === "A",
      ),
      1,
      harness.ledger.format(),
    );

    await act(async () => {
      harness.historyBack();
    });
    const secondA = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A",
      1,
    );
    assert.notEqual(secondA.requestId, firstA.requestId);
    await act(async () => {
      harness.network.resolve(secondA, "Item A reloaded");
    });
    await harness.waitForText("item", "Item A reloaded");
    assert.equal(
      harness.ledger.count(
        "reference-create",
        (event) => event.details.itemId === "A",
      ),
      2,
      harness.ledger.format(),
    );
  } finally {
    await harness.teardown();
  }
});

test("R1: a failed query is released and retry creates usable new work", async () => {
  const harness = await createHarness({ initialEntry: "/items/R" });
  try {
    const failed = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "R",
    );
    expectConsoleOutput(/console\.warn: Warning: Error in route match: .*R/);
    await act(async () => {
      harness.network.reject(failed, "Expected route failure");
    });
    await harness.waitForText("route-error", "Expected route failure");
    const retryButton = harness.container.querySelector(
      '[data-testid="retry"]',
    );
    assert.ok(retryButton instanceof HTMLElement);
    await act(async () => {
      retryButton.click();
    });
    const retried = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "R",
      1,
    );
    await act(async () => {
      harness.network.resolve(retried, "Retry R");
    });
    await harness.waitForText("item", "Retry R");
    assert.equal(
      harness.ledger.count(
        "reference-release",
        (event) => event.details.itemId === "R",
      ),
      1,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count(
        "reference-create",
        (event) => event.details.itemId === "R",
      ),
      2,
      harness.ledger.format(),
    );
  } finally {
    await harness.teardown();
  }
});
