import assert from "node:assert/strict";
import { test } from "vitest";
import { createHarness } from "./harness.js";

test("P3: clearing an unused preload cancels and releases it", async () => {
  const harness = await createHarness({ initialEntry: "/" });
  try {
    const preload = harness.preloadItem("P3");
    const request = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "P3",
    );
    await preload;
    harness.clearCache();
    assert.equal(
      harness.ledger.count(
        "network-cancel",
        (event) => event.details.requestId === request.requestId,
      ),
      1,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count(
        "reference-release",
        (event) => event.details.itemId === "P3",
      ),
      1,
      harness.ledger.format(),
    );
    assert.doesNotMatch(harness.container.textContent ?? "", /P3/);
  } finally {
    await harness.teardown();
  }
});
