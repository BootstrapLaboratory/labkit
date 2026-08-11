import assert from "node:assert/strict";
import { act } from "react";
import { test } from "vitest";
import { createHarness } from "./harness.js";

async function resolveItem(
  harness: Awaited<ReturnType<typeof createHarness>>,
  itemId: string,
  occurrence: number,
  label: string,
): Promise<void> {
  const request = await harness.network.waitForRequest(
    "LifecycleItemQuery",
    itemId,
    occurrence,
  );
  await act(async () => {
    harness.network.resolve(request, label);
  });
  await harness.waitForText("item", label);
}

test("H2: browser forward follows the same reload-before-render policy", async () => {
  const harness = await createHarness({ initialEntry: "/items/A" });
  try {
    await resolveItem(harness, "A", 0, "A first");
    const { finished: navigationB } = await harness.beginNavigation("/items/B");
    await resolveItem(harness, "B", 0, "B first");
    await navigationB;

    await act(async () => {
      harness.historyBack();
    });
    await resolveItem(harness, "A", 1, "A back");

    await act(async () => {
      harness.historyForward();
    });
    await resolveItem(harness, "B", 1, "B forward");

    assert.equal(
      harness.network.requests("LifecycleItemQuery", "A").length,
      2,
      harness.ledger.format(),
    );
    assert.equal(
      harness.network.requests("LifecycleItemQuery", "B").length,
      2,
      harness.ledger.format(),
    );
    assert.match(harness.container.textContent ?? "", /B forward/);
  } finally {
    await harness.teardown();
  }
});

test("H3: explicit cache clearing cannot revive a released reference", async () => {
  const harness = await createHarness({ initialEntry: "/items/A" });
  try {
    await resolveItem(harness, "A", 0, "A before clear");
    await harness.navigate("/");
    await harness.waitForText("landing", "Landing");
    harness.clearCache();

    const { finished: navigation } = await harness.beginNavigation("/items/A");
    await resolveItem(harness, "A", 1, "A after clear");
    await navigation;
    assert.equal(
      harness.ledger.count(
        "reference-create",
        (event) => event.details.itemId === "A",
      ),
      2,
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
  } finally {
    await harness.teardown();
  }
});

test("H4/R2: blocking invalidation keeps active data until replacement commits", async () => {
  const harness = await createHarness({ initialEntry: "/items/A" });
  try {
    await resolveItem(harness, "A", 0, "A original");
    let invalidation: Promise<void>;
    await act(async () => {
      invalidation = harness.invalidate();
    });
    const replacement = await harness.network.waitForRequest(
      "LifecycleItemQuery",
      "A",
      1,
    );
    assert.match(harness.container.textContent ?? "", /A original/);
    assert.equal(
      harness.ledger.count("reference-release"),
      1,
      harness.ledger.format(),
    );
    assert.equal(
      harness.ledger.count(
        "render",
        (event) => event.details.referenceId === "reference-2",
      ),
      1,
      harness.ledger.format(),
    );

    await act(async () => {
      harness.network.resolve(replacement, "A refreshed");
    });
    await invalidation!;
    await harness.waitForText("item", "A refreshed");
    assert.equal(
      harness.ledger.count("reference-release"),
      1,
      harness.ledger.format(),
    );
  } finally {
    await harness.teardown();
  }
});
