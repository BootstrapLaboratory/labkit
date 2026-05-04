import assert from "node:assert/strict";
import test from "node:test";
import { createExternalStore } from "../src/index";

test("createExternalStore reads the initial snapshot", () => {
  const store = createExternalStore({ count: 1 });

  assert.deepEqual(store.getSnapshot(), { count: 1 });
});

test("createExternalStore emits after setting snapshots", () => {
  const store = createExternalStore(1);
  const snapshots: number[] = [];
  const unsubscribe = store.subscribe(() => {
    snapshots.push(store.getSnapshot());
  });

  store.setSnapshot(2);
  store.setSnapshot(3);
  unsubscribe();
  store.setSnapshot(4);

  assert.deepEqual(snapshots, [2, 3]);
  assert.equal(store.getSnapshot(), 4);
});

test("createExternalStore updates snapshots from the current value", () => {
  const store = createExternalStore({ count: 1 });
  let emitted = 0;

  store.subscribe(() => {
    emitted += 1;
  });

  store.updateSnapshot((current) => ({ count: current.count + 1 }));

  assert.deepEqual(store.getSnapshot(), { count: 2 });
  assert.equal(emitted, 1);
});

test("createExternalStore snapshots listeners before emitting", () => {
  const store = createExternalStore("initial");
  const calls: string[] = [];
  const unsubscribeSecond: { current?: () => void } = {};

  store.subscribe(() => {
    calls.push("first");
    unsubscribeSecond.current?.();
  });
  unsubscribeSecond.current = store.subscribe(() => {
    calls.push("second");
  });

  store.setSnapshot("next");
  store.setSnapshot("final");

  assert.deepEqual(calls, ["first", "second", "first"]);
});
