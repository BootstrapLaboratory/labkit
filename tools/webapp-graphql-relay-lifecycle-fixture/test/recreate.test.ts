import assert from "node:assert/strict";
import { act } from "react";
import { test } from "vitest";
import { createHarness } from "./harness.js";

test("T2: recreating the runtime at one location does not reuse old identity", async () => {
  const first = await createHarness({ initialEntry: "/items/T2" });
  const firstRequest = await first.network.waitForRequest(
    "LifecycleItemQuery",
    "T2",
  );
  await act(async () => {
    first.network.resolve(firstRequest, "First runtime");
  });
  await first.waitForText("item", "First runtime");
  const firstEnvironment = first.environment;
  await first.teardown();
  assert.equal(first.ledger.count("reference-release"), 1);

  const second = await createHarness({ initialEntry: "/items/T2" });
  try {
    const secondRequest = await second.network.waitForRequest(
      "LifecycleItemQuery",
      "T2",
    );
    await act(async () => {
      second.network.resolve(secondRequest, "Second runtime");
    });
    await second.waitForText("item", "Second runtime");
    assert.notEqual(second.environment, firstEnvironment);
    assert.match(second.container.textContent ?? "", /Second runtime/);
    assert.doesNotMatch(second.container.textContent ?? "", /First runtime/);
  } finally {
    await second.teardown();
  }
});
