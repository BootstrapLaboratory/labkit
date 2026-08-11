import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createFixtureTree, EXPECTED_VIEWER_NAME } from "./app";

const READY_TIMEOUT_MS = 5_000;
const fixture = createFixtureTree();

try {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const readinessTimeout = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(
        new Error(
          `Relay fixture data was not ready within ${READY_TIMEOUT_MS}ms.`,
        ),
      );
    }, READY_TIMEOUT_MS);
  });
  try {
    await Promise.race([fixture.ready, readinessTimeout]);
  } finally {
    clearTimeout(timeout);
  }

  const html = renderToString(fixture.tree);
  assert.match(html, new RegExp(EXPECTED_VIEWER_NAME));
  process.stdout.write(`Rendered fixture payload: ${EXPECTED_VIEWER_NAME}\n`);
} finally {
  fixture.dispose();
}

// Relay schedules internal retention/GC timers. The fixture has disposed every
// public handle it owns, so do not let those implementation timers hold CI open.
process.exit(0);
