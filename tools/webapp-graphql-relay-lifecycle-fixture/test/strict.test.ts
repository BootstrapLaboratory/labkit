import assert from "node:assert/strict";
import { act } from "react";
import { test } from "vitest";
import { createHarness } from "./harness.js";

test("S1: Strict Mode does not duplicate initial loader ownership", async () => {
  const harness = await createHarness({
    initialEntry: "/items/S1",
    strictMode: true,
  });
  try {
    const request = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "S1",
    );
    await act(async () => {
      harness.network.resolve(request, "Strict single");
    });
    await harness.waitForText("item", "Strict single");
    assert.equal(
      harness.network.requests("LifecycleItemQuery", "S1").length,
      1,
      harness.ledger.format(),
    );
    assert.equal(harness.ledger.count("reference-create"), 1);
    assert.equal(harness.ledger.count("reference-release"), 0);
  } finally {
    await harness.teardown();
  }
});

test("S2: Strict Mode cannot release a pair before replacement commits", async () => {
  const harness = await createHarness({
    initialEntry: "/pairs/S2",
    strictMode: true,
  });
  try {
    const primary = await harness.network.waitForRequest(
      "LifecyclePrimaryQuery",
      "S2",
    );
    const secondary = await harness.network.waitForRequest(
      "LifecycleSecondaryQuery",
      "S2",
    );
    await act(async () => {
      harness.network.resolve(secondary, "Strict secondary");
      harness.network.resolve(primary, "Strict primary");
    });
    await harness.waitForText("pair", "Strict primary");

    const { finished: navigation } =
      await harness.beginNavigation("/items/final");
    const finalRequest = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "final",
    );
    assert.match(harness.container.textContent ?? "", /Strict primary/);
    assert.equal(
      harness.ledger.count("reference-release"),
      0,
      harness.ledger.format(),
    );
    await act(async () => {
      harness.network.resolve(finalRequest, "Strict final");
    });
    await navigation;
    await harness.waitForText("item", "Strict final");
    assert.equal(
      harness.ledger.count("reference-create"),
      3,
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
