/**
 * Layout regression guard — asserts the navbar never clips, overlaps, or forces
 * horizontal scrolling at any common viewport width.
 *
 *   GP_E2E_EMAIL_A=... GP_E2E_PASSWORD=... node e2e/layout.mjs
 */
import { chromium } from "playwright";

const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) || "http://localhost:5173";
const EMAIL = process.env.GP_E2E_EMAIL_A;
const PASSWORD = process.env.GP_E2E_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("GP_E2E_EMAIL_A and GP_E2E_PASSWORD are required.");
  process.exit(2);
}

const WIDTHS = [320, 360, 375, 390, 414, 480, 640, 768, 834, 1024, 1280, 1440, 1920];

let pass = 0;
let fail = 0;

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(8000);

for (const width of WIDTHS) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);

  const r = await page.evaluate(() => {
    const header = document.querySelector("header");
    const doc = document.documentElement;

    // Interactive controls that extend past the viewport are unreachable on a phone.
    const clipped = [];
    for (const el of header?.querySelectorAll("a, button") || []) {
      const b = el.getBoundingClientRect();
      if (b.width === 0) continue;
      if (b.right > window.innerWidth + 1 || b.left < -1) {
        clipped.push(`${el.getAttribute("aria-label") || el.textContent.trim().slice(0, 14)}[${Math.round(b.left)}..${Math.round(b.right)}]`);
      }
    }

    // Overlap between the action controls on the same row.
    const items = Array.from(header?.querySelectorAll("a[aria-label], button[aria-label]") || []).map((el) => {
      const b = el.getBoundingClientRect();
      return { label: el.getAttribute("aria-label"), left: b.left, right: b.right, top: Math.round(b.top) };
    });
    const overlaps = [];
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        if (items[i].top === items[j].top && items[i].right > items[j].left + 0.5) {
          overlaps.push(`${items[i].label} ✕ ${items[j].label}`);
        }
      }
    }

    return {
      hScroll: doc.scrollWidth > window.innerWidth + 1,
      scrollW: doc.scrollWidth,
      clipped,
      overlaps,
      controls: items.length,
      labels: items.map((i) => i.label).join(","),
    };
  });

  const ok = !r.hScroll && r.clipped.length === 0 && r.overlaps.length === 0;
  if (ok) {
    pass += 1;
    console.log(`  PASS  w=${String(width).padEnd(5)} controls=${r.controls}`);
  } else {
    fail += 1;
    console.log(`  FAIL  w=${String(width).padEnd(5)} hScroll=${r.hScroll} (doc ${r.scrollW})`);
    if (r.overlaps.length) console.log(`          overlaps: ${r.overlaps.join(" | ")}`);
    if (r.clipped.length) console.log(`          clipped:  ${r.clipped.join(" | ")}`);
    console.log(`          controls: ${r.labels}`);
  }
}

// Popover behaviour: the profile menu must stay inside the viewport at the smallest width.
await page.setViewportSize({ width: 320, height: 640 });
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.click('button[aria-label="Account menu"]');
await page.waitForTimeout(600);

const menu = await page.evaluate(() => {
  const el = document.querySelector('[role="menu"]');
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, inView: b.left >= -1 && b.right <= window.innerWidth + 1 && b.top >= -1 && b.bottom <= window.innerHeight + 1 };
});
if (menu?.inView) {
  pass += 1;
  console.log(`  PASS  profile menu inside viewport at 320px (${Math.round(menu.left)}..${Math.round(menu.right)})`);
} else {
  fail += 1;
  console.log(`  FAIL  profile menu out of viewport: ${JSON.stringify(menu)}`);
}

await browser.close();

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
