/**
 * Chat message action menu must never be clipped by the scroll container and must stay
 * fully inside the viewport, including for the first and last messages.
 *
 *   GP_E2E_EMAIL_A=... GP_E2E_PASSWORD=... node e2e/chat-menu.mjs
 */
import { chromium } from "playwright";

const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) || "http://localhost:5173";
const EMAIL = process.env.GP_E2E_EMAIL_A;
const PASSWORD = process.env.GP_E2E_PASSWORD;

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? `  <- ${detail}` : ""}`);
  }
};

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});

for (const width of [360, 768, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: 720 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(7000);

  // Seed a conversation with several own messages so the menu can be tested against
  // messages sitting at both the top and bottom of the scroll container.
  await page.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  let convLink = page.locator('a[href^="/messages/"]').first();
  if ((await convLink.count()) === 0) {
    console.log(`  SKIP  w=${width} — no conversation available for this account`);
    await ctx.close();
    continue;
  }
  await convLink.click();
  await page.waitForTimeout(4000);

  // Post a few messages so there is a top and a bottom to test against.
  const composer = page.locator('input[placeholder*="essage"], textarea[placeholder*="essage"]').first();
  if (await composer.count()) {
    for (let i = 0; i < 4; i += 1) {
      await composer.fill(`layout probe ${i}`);
      await composer.press("Enter");
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(2500);
  }

  const triggers = page.locator('button[aria-label="Message options"]');
  const count = await triggers.count();
  if (!count) {
    console.log(`  SKIP  w=${width} — no own messages in this conversation`);
    await ctx.close();
    continue;
  }

  // Test the first and last messages: those sit closest to the container edges.
  for (const [label, index] of [["first", 0], ["last", count - 1]]) {
    const trigger = triggers.nth(index);
    await trigger.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await trigger.click();
    await page.waitForTimeout(700);

    const r = await page.evaluate(() => {
      const menu = document.querySelector('[role="menu"]');
      if (!menu) return { found: false };
      const b = menu.getBoundingClientRect();
      // Walk ancestors: any overflow-clipping container between menu and body is a bug.
      let clipped = false;
      let node = menu.parentElement;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (["hidden", "auto", "scroll"].includes(style.overflowY) || style.overflow === "hidden") {
          const nb = node.getBoundingClientRect();
          if (b.top < nb.top - 1 || b.bottom > nb.bottom + 1) clipped = true;
        }
        node = node.parentElement;
      }
      return {
        found: true,
        inViewport: b.left >= -1 && b.right <= window.innerWidth + 1 && b.top >= -1 && b.bottom <= window.innerHeight + 1,
        clippedByAncestor: clipped,
        rect: `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`,
        parent: menu.parentElement?.tagName,
      };
    });

    check(
      `w=${width} ${label} message menu visible`,
      r.found && r.inViewport && !r.clippedByAncestor,
      JSON.stringify(r),
    );
    check(`w=${width} ${label} menu portalled to body`, r.parent === "BODY", `parent=${r.parent}`);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  await ctx.close();
}

await browser.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
