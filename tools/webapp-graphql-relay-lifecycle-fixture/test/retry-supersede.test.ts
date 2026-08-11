import assert from "node:assert/strict";
import { act } from "react";
import { test } from "vitest";
import { createHarness } from "./harness.js";

test("R3: navigation supersedes retry work without a late commit", async () => {
  const harness = await createHarness({ initialEntry: "/items/A" });
  try {
    const original = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A",
    );
    await act(async () => {
      harness.network.resolve(original, "Original A");
    });
    await harness.waitForText("item", "Original A");

    let invalidation: Promise<void>;
    await act(async () => {
      invalidation = harness.invalidate();
    });
    const retry = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A",
      1,
    );
    const { finished: navigation } = await harness.beginNavigation("/items/B");
    const requestB = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "B",
    );
    await act(async () => {
      harness.network.resolve(requestB, "Final B");
    });
    await Promise.all([invalidation!, navigation]);
    await harness.waitForText("item", "Final B");

    assert.equal(
      harness.ledger.count(
        "network-cancel",
        (event) => event.details.requestId === retry.requestId,
      ),
      1,
      harness.ledger.format(),
    );
    assert.throws(() => harness.network.resolve(retry, "Late retry"));
    assert.match(harness.container.textContent ?? "", /Final B/);
  } finally {
    await harness.teardown();
  }
});
