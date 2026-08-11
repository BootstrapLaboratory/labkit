import assert from "node:assert/strict";
import { act } from "react";
import { test } from "vitest";
import { createHarness } from "./harness.js";

test("P2: a completed preload renders without a duplicate loader call", async () => {
  const harness = await createHarness({ initialEntry: "/" });
  try {
    const preload = harness.preloadItem("P2");
    const request = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "P2",
    );
    await act(async () => {
      harness.network.resolve(request, "Completed preload");
    });
    await preload;

    await harness.navigate("/items/P2");
    await harness.waitForText("item", "Completed preload");
    assert.equal(
      harness.network.requests("LifecycleItemQuery", "P2").length,
      1,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count("reference-release"),
      0,
      harness.ledger.format(),
    );
  } finally {
    await harness.teardown();
  }
});
