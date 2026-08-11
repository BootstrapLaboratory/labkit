import { expect, test, type Page } from "@playwright/test";
import type { LifecycleEvent } from "../src/ledger.js";

async function resolveRequest(
  page: Page,
  itemId: string,
  label: string,
): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        ({ nextItemId, nextLabel }) =>
          window.lifecycleFixture.resolve(
            "LifecycleItemQuery",
            nextItemId,
            nextLabel,
          ),
        { nextItemId: itemId, nextLabel: label },
      ),
    )
    .toBe(true);
}

async function lifecycleEvents(page: Page): Promise<readonly LifecycleEvent[]> {
  return page.evaluate(() => window.lifecycleFixture.events());
}

test("direct entry, pending replacement, reload, history, and teardown", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      browserErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(`pageerror: ${error.message}`);
  });

  await page.goto("/items/browser-a");
  const firstRuntimeId = await page.evaluate(
    () => window.lifecycleFixture.runtimeId,
  );
  await resolveRequest(page, "browser-a", "Browser A");
  await expect(page.getByTestId("item")).toHaveText("Browser A");

  await page.evaluate(() => {
    window.lifecycleFixture.beginNavigation("/items/browser-b");
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.lifecycleFixture
            .events()
            .filter(
              (event) =>
                event.kind === "reference-create" &&
                event.details.itemId === "browser-b",
            ).length,
      ),
    )
    .toBe(1);
  await expect(page.getByTestId("item")).toHaveText("Browser A");
  expect(
    (await lifecycleEvents(page)).filter(
      (event) =>
        event.kind === "reference-release" &&
        event.details.itemId === "browser-a",
    ),
  ).toHaveLength(0);

  await resolveRequest(page, "browser-b", "Browser B");
  await page.evaluate(() => window.lifecycleFixture.finishNavigation());
  await expect(page.getByTestId("item")).toHaveText("Browser B");
  expect(
    (await lifecycleEvents(page)).filter(
      (event) =>
        event.kind === "reference-release" &&
        event.details.itemId === "browser-a",
    ),
  ).toHaveLength(1);

  await page.reload();
  const secondRuntimeId = await page.evaluate(
    () => window.lifecycleFixture.runtimeId,
  );
  expect(secondRuntimeId).not.toBe(firstRuntimeId);
  await resolveRequest(page, "browser-b", "Reloaded B");
  await expect(page.getByTestId("item")).toHaveText("Reloaded B");

  await page.evaluate(() => {
    window.lifecycleFixture.beginNavigation("/items/browser-c");
  });
  await resolveRequest(page, "browser-c", "Browser C");
  await page.evaluate(() => window.lifecycleFixture.finishNavigation());
  await expect(page.getByTestId("item")).toHaveText("Browser C");

  await page.evaluate(() => window.lifecycleFixture.historyBack());
  await resolveRequest(page, "browser-b", "History B");
  await expect(page.getByTestId("item")).toHaveText("History B");

  await page.evaluate(() => window.lifecycleFixture.historyForward());
  await resolveRequest(page, "browser-c", "History C");
  await expect(page.getByTestId("item")).toHaveText("History C");

  const finalEvents = await page.evaluate(() =>
    window.lifecycleFixture.teardown(),
  );
  expect(
    finalEvents.filter((event) => event.kind === "reference-release"),
  ).toHaveLength(
    finalEvents.filter((event) => event.kind === "reference-create").length,
  );
  expect(browserErrors).toEqual([]);
});
