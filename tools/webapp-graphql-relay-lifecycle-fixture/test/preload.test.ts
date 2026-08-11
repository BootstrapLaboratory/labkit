import assert from "node:assert/strict";
import { act } from "react";
import { test } from "vitest";
import { createHarness } from "./harness.js";

test("P1: a pending Relay preload is reused by navigation", async () => {
  const harness = await createHarness({ initialEntry: "/" });
  try {
    const preload = harness.preloadItem("P");
    const request = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "P",
    );
    await preload;
    const { finished: navigation } = await harness.beginNavigation("/items/P");
    await act(async () => {
      harness.network.resolve(request, "Preloaded P");
    });
    await navigation;
    await harness.waitForText("item", "Preloaded P");
    assert.equal(
      harness.network.requests("LifecycleItemQuery", "P").length,
      1,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count(
        "reference-create",
        (event) => event.details.itemId === "P",
      ),
      1,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count(
        "reference-release",
        (event) => event.details.itemId === "P",
      ),
      0,
      harness.ledger.format(),
    );
  } finally {
    await harness.teardown();
  }
  assert.equal(
    harness.ledger.count(
      "reference-release",
      (event) => event.details.itemId === "P",
    ),
    1,
    harness.ledger.format(),
  );
});
