import assert from "node:assert/strict";
import test from "node:test";
import {
  parseBoolean,
  parseFiniteNumber,
  parseList,
  parseNumber,
} from "../src/index";

test("parseBoolean handles known true and false strings", () => {
  assert.equal(parseBoolean("true", false), true);
  assert.equal(parseBoolean("YES", false), true);
  assert.equal(parseBoolean("0", true), false);
  assert.equal(parseBoolean("off", true), false);
});

test("parseBoolean returns fallback for missing or unknown values", () => {
  assert.equal(parseBoolean(undefined, true), true);
  assert.equal(parseBoolean(null, false), false);
  assert.equal(parseBoolean("sometimes", true), true);
});

test("parseNumber preserves existing integer parsing behavior", () => {
  assert.equal(parseNumber("3000", 80), 3000);
  assert.equal(parseNumber("42px", 0), 42);
  assert.equal(parseNumber("nope", 7), 7);
});

test("parseFiniteNumber parses browser-style numeric configuration safely", () => {
  assert.equal(parseFiniteNumber("15000", 30000, { min: 0 }), 15000);
  assert.equal(parseFiniteNumber("100.5", 30000, { min: 0 }), 100.5);
  assert.equal(parseFiniteNumber("-1", 30000, { min: 0 }), 30000);
  assert.equal(parseFiniteNumber("NaN", 30000, { min: 0 }), 30000);
});

test("parseList trims comma-separated values and drops blanks", () => {
  assert.deepEqual(parseList("http://a.test, , http://b.test "), [
    "http://a.test",
    "http://b.test",
  ]);
  assert.deepEqual(parseList(undefined), []);
});
