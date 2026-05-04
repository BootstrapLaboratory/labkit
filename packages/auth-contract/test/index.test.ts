import assert from "node:assert/strict";
import test from "node:test";
import {
  extractBearerToken,
  extractGraphqlWsAuthorization,
  formatBearerToken,
  isAuthRequiredErrorCode,
} from "../src/index";

test("formatBearerToken creates an authorization header value", () => {
  assert.equal(formatBearerToken("access-token"), "Bearer access-token");
});

test("extractBearerToken reads bearer authorization headers", () => {
  assert.equal(extractBearerToken("Bearer access-token"), "access-token");
  assert.equal(
    extractBearerToken(["Bearer first-token", "Bearer second-token"]),
    "first-token",
  );
});

test("extractBearerToken ignores missing or non-bearer headers", () => {
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken(null), null);
  assert.equal(extractBearerToken("Basic access-token"), null);
  assert.equal(extractBearerToken("Bearer"), null);
});

test("extractGraphqlWsAuthorization reads common connection params", () => {
  assert.equal(
    extractGraphqlWsAuthorization({
      authorization: "Bearer access-token",
    }),
    "Bearer access-token",
  );
  assert.equal(
    extractGraphqlWsAuthorization({
      Authorization: "Bearer access-token",
    }),
    "Bearer access-token",
  );
});

test("extractGraphqlWsAuthorization supports accessToken connection params", () => {
  assert.equal(
    extractGraphqlWsAuthorization({
      accessToken: "access-token",
    }),
    "Bearer access-token",
  );
});

test("extractGraphqlWsAuthorization ignores missing or non-string params", () => {
  assert.equal(extractGraphqlWsAuthorization(undefined), undefined);
  assert.equal(
    extractGraphqlWsAuthorization({
      accessToken: 123,
      authorization: ["Bearer access-token"],
    }),
    undefined,
  );
});

test("isAuthRequiredErrorCode recognizes shared auth error codes", () => {
  assert.equal(isAuthRequiredErrorCode("AUTH_REQUIRED"), true);
  assert.equal(isAuthRequiredErrorCode("UNAUTHENTICATED"), true);
  assert.equal(isAuthRequiredErrorCode("FORBIDDEN"), false);
  assert.equal(isAuthRequiredErrorCode(null), false);
});
