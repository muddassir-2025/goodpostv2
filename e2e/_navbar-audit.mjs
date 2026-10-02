import { chromium } from "playwright";

const BASE = process.argv.find((a) => a.startsWith("--base="))?.slice(7) || "https://goodpostv2.vercel.app";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', process.env.GP_E2E_EMAIL_A);
await page.fill('input[type="password"]', process.env.GP_E2E_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(8000);

for (const width of [320, 360, 390, 414, 480, 640, 768, 1024, 1280, 1440]) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const header = document.querySelector("header");
    const inner = header?.firstElementChild;
    const nav = header?.querySelector("nav, .flex.items-center.gap-2");
    const doc = document.documentElement;

    // Any element in the header that extends past the viewport.
    const clipped = [];
    for (const el of header?.querySelectorAll("*") || []) {
      const b = el.getBoundingClientRect();
      if (b.width === 0) continue;
      if (b.right > window.innerWidth + 1 || b.left < -1) {
        clipped.push(`${el.tagName}.${String(el.className).slice(0, 30)}[${Math.round(b.left)}..${Math.round(b.right)}]`);
      }
    }

    // Overlap between the action links.
    const links = Array.from(header?.querySelectorAll("a[aria-label]") || []).map((a) => {
      const b = a.getBoundingClientRect();
      return { label: a.getAttribute("aria-label"), left: b.left, right: b.right, top: b.top };
    });
    const overlaps = [];
    for (let i = 0; i < links.length; i += 1) {
      for (let j = i + 1; j < links.length; j += 1) {
        if (links[i].top === links[j].top && links[i].right > links[j].left + 0.5) {
          overlaps.push(`${links[i].label} ✕ ${links[j].label}`);
        }
      }
    }

    return {
      docScrollW: doc.scrollWidth,
      winW: window.innerWidth,
      hScroll: doc.scrollWidth > window.innerWidth,
      linkCount: links.length,
      labels: links.map((l) => l.label).join(","),
      clippedCount: clipped.length,
      clipped: clipped.slice(0, 4),
      overlaps,
      headerH: header?.getBoundingClientRect().height,
      innerW: inner?.getBoundingClientRect().width,
    };
  });

  console.log(
    `w=${String(width).padEnd(4)} hScroll=${r.hScroll ? "YES" : "no "} (doc ${r.docScrollW}) ` +
      `links=${r.linkCount} clipped=${r.clippedCount} overlaps=${r.overlaps.length} headerH=${Math.round(r.headerH || 0)}`,
  );
  if (r.overlaps.length) console.log(`        overlaps: ${r.overlaps.join(" | ")}`);
  if (r.clipped.length) console.log(`        clipped: ${r.clipped.join(" | ")}`);
  if (width === 360) console.log(`        labels: ${r.labels}`);
}

await browser.close();
