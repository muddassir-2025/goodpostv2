/**
 * Full browser E2E for GoodPost — drives the real SPA in Chrome.
 *
 *   GP_E2E_EMAIL_A=you@example.com GP_E2E_PASSWORD=... npm run e2e
 *   npm run e2e -- --base=https://goodpostv2.vercel.app --headed
 *
 * Defaults to the local dev server (which talks to the deployed API) so fixes can be
 * verified before deploying. Pass --base=<url> to point at a deployment.
 *
 * Credentials come from the environment — this repo is public, so never hardcode them.
 * GP_E2E_EMAIL_A is the primary account; GP_E2E_EMAIL_B is optional and is created on
 * first run. Two accounts are needed for the realtime notification checks.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT = resolve(HERE, "out");
mkdirSync(OUT, { recursive: true });

const BASE = (process.argv.find((a) => a.startsWith("--base="))?.slice(7) || "http://localhost:5173").replace(/\/+$/, "");
const HEADED = process.argv.includes("--headed");
const AUTH = "https://ep-divine-term-b5s7sd84.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth";
// Override to point direct API calls at a local backend (e.g. GP_E2E_API=http://localhost:8080).
const API = process.env.GP_E2E_API || "https://goodpost-api.onrender.com";

const PASSWORD = process.env.GP_E2E_PASSWORD || "";
const USER_A = { email: process.env.GP_E2E_EMAIL_A || "", password: PASSWORD, name: "Smoke Test" };
// Emails are not secret; only the password comes from the environment.
const USER_B = {
  email: process.env.GP_E2E_EMAIL_B || "gp-e2e-realtime@example.com",
  password: PASSWORD,
  name: "Realtime Bot",
};

if (!USER_A.email || !PASSWORD) {
  console.error("GP_E2E_EMAIL_A and GP_E2E_PASSWORD are required (see the header of this file).");
  process.exit(2);
}

const stamp = Date.now();
let pass = 0;
let fail = 0;
const failures = [];

const check = (name, ok, detail = "") => {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  <- ${detail}` : ""}`);
  }
};
const section = (t) => console.log(`\n-- ${t} --`);

function watch(page, bag) {
  page.on("pageerror", (e) => bag.pageErrors.push(String(e?.message || e)));
  page.on("response", (r) => {
    const u = r.url();
    if (r.status() >= 400) {
      bag.notFound.push(`${r.status()} ${u.replace(API, "")}`);
      if (u.includes("onrender.com")) bag.bad.push(`${r.status()} ${r.request().method()} ${u.replace(API, "")}`);
    }
  });
  page.on("websocket", (ws) => {
    if (!ws.url().includes("/ws")) return;
    bag.ws.push(ws.url());
    // Record realtime event types the server pushes to this page. Asserting on the raw
    // frame is robust: the notifications list is capped at 15 rows, so a new event can
    // prune an old one and leave any DOM count or text unchanged.
    ws.on("framereceived", (frame) => {
      try {
        const data = JSON.parse(String(frame.payload));
        if (data?.type) bag.frames.push(data.type);
      } catch {
        // ignore malformed frames
      }
    });
  });
  // Capture a real bearer token so tests can call the API directly and prove the server
  // enforces authorization rather than relying on the UI to hide things.
  page.on("request", (r) => {
    const auth = r.headers()["authorization"];
    if (auth && !bag.token) bag.token = auth.replace(/^Bearer\s+/i, "");
  });
}
const bag = () => ({ pageErrors: [], bad: [], notFound: [], ws: [], frames: [], token: null });
const countFrames = (bag, type) => bag.frames.filter((t) => t === type).length;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Wait (Node-side) for the page's realtime socket to open before triggering a live event. */
async function waitForSocket(bag, ms = 15000) {
  const deadline = Date.now() + ms;
  while (!bag.ws.length && Date.now() < deadline) await sleep(400);
}

// The in-browser NSFW check runs TF.js in a worker and needs WebGL. Headless Chrome has
// no GPU, so enable SwiftShader software rendering or the check never resolves.
const browser = await chromium.launch({
  headless: !HEADED,
  channel: "chrome",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
  ],
});
const newCtx = () => browser.newContext({ viewport: { width: 1280, height: 900 } });

async function login(page, { email, password }) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for the SPA to leave /login instead of a fixed delay, which was sometimes too
  // short and reported a false "login failed" while the session was still settling.
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return !page.url().includes("/login");
}

/** Create the account once; later runs fall back to logging in. */
async function ensureAccount(page, user) {
  await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="text"]', user.name);
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(7000);

  if (await page.getByText(/enter your code/i).isVisible().catch(() => false)) return "verify";
  if (!page.url().includes("/signup")) return "created";
  return (await login(page, user)) ? "logged-in" : "failed";
}

/** Read the signed-in user's id straight from the API using the context's auth cookie. */
async function userIdOf(ctx) {
  const tok = await ctx.request.get(`${AUTH}/token`, { headers: { Origin: BASE } });
  const token = (await tok.json())?.token;
  if (!token) return null;
  const me = await ctx.request.get(`${API}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
  return (await me.json())?.["$id"] || null;
}

const clickIn = (page, css) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.click();
    return true;
  }, css);

const textIn = (page, css) =>
  page.evaluate((sel) => document.querySelector(sel)?.textContent?.trim() || null, css);

try {
  console.log(`\n=== GoodPost browser E2E ===\nbase: ${BASE}\n`);

  /* ------------------------------------------------------------------ signup */
  section("signup (fresh account)");
  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    const b = bag();
    watch(page, b);
    const email = `gp-e2e-signup-${stamp}@example.com`;

    await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });
    check("signup form renders", true);

    await page.fill('input[type="text"]', `Signup ${stamp}`);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(8000);

    const verify = await page.getByText(/enter your code/i).isVisible().catch(() => false);
    const err = await page.locator(".text-rose-200").first().textContent().catch(() => null);

    if (verify) {
      check("verification enforced -> code step shown", true);
      check("resend button present", await page.getByRole("button", { name: /resend code/i }).isVisible());
      console.log("  info: email verification is ENABLED in the Neon Console");
    } else {
      check("signup completes and signs the user in", !page.url().includes("/signup"), `url=${page.url()} err=${err}`);
      check("no page errors during signup", b.pageErrors.length === 0, b.pageErrors.slice(0, 2).join(" | "));
    }
    await ctx.close();
  }

  /* ------------------------------------------------------------------- login */
  section("login + session");
  const ctxA = await newCtx();
  const A = await ctxA.newPage();
  const bagA = bag();
  watch(A, bagA);

  check("user A logs in", await login(A, USER_A), A.url());
  const aId = await userIdOf(ctxA);
  await A.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await A.waitForTimeout(4000);
  check("session persists across navigation", !A.url().includes("/login"), A.url());
  check("authenticated API calls carry a token", bagA.bad.length === 0, bagA.bad.slice(0, 3).join(" | "));

  /* ------------------------------------------------------------ create post */
  section("create post with image upload + tag");
  await A.goto(`${BASE}/create`, { waitUntil: "domcontentloaded" });
  await A.waitForTimeout(2500);

  await A.setInputFiles('input[accept="image/*"]', resolve(ROOT, "public/GoodPost.jpeg"));
  await A.waitForTimeout(2000);
  check("image preview appears", await A.locator("#post-preview-img").isVisible().catch(() => false));

  const postTitle = `Browser E2E ${stamp}`;
  await A.fill('input[type="text"] >> nth=0', postTitle);
  await A.fill("textarea", `browser e2e caption ${stamp}`);
  await A.getByRole("button", { name: "Travel", exact: true }).click();

  // The in-browser NSFW check downloads MobileNetV2 and runs inference in a worker.
  // Under SwiftShader that first call is slow and occasionally needs a second attempt.
  await A.click('button[type="submit"]');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await A.waitForURL((u) => !u.pathname.includes("/create"), { timeout: 60000 }).catch(() => {});
    if (!A.url().includes("/create")) break;
    const state = await A.evaluate(() => ({
      button: document.querySelector('button[type="submit"]')?.textContent,
      error: document.body.innerText.match(/(Content Policy|inappropriate|Image check failed|Select at least|Please add|creation failed|Cannot)[^\n]*/)?.[0] || null,
    }));
    console.log(`  info: still on /create (attempt ${attempt + 1}) button="${state.button}" err=${state.error}`);
    if (state.button && /Publish post/i.test(state.button)) {
      await A.click('button[type="submit"]');
    } else {
      await A.waitForTimeout(20000);
    }
  }
  await A.waitForTimeout(4000);
  await A.screenshot({ path: resolve(OUT, "01-after-publish.png") });

  check("publish navigates back to the feed", !A.url().includes("/create"), A.url());
  check("image upload succeeded (moderation + storage)", bagA.bad.filter((x) => x.includes("/uploads/")).length === 0);

  /* ------------------------------------------------------- image renders */
  section("uploaded image renders in the feed");
  await A.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  // Wait for the feed itself, not just any storage image: the story bar loads images from
  // storage too, so waiting on an image alone could resolve before a single post card
  // rendered. Require both an <article> and a loaded storage image.
  await A.waitForFunction(
    () =>
      document.querySelectorAll("article").length > 0 &&
      Array.from(document.images).some((i) => i.complete && i.currentSrc.includes("storage")),
    { timeout: 20000 },
  ).catch(() => {});

  // Only assert on images that finished loading (complete) so lazy/offscreen images
  // are not misreported as broken.
  const imgs = await A.evaluate(() => {
    const loaded = Array.from(document.images).filter((i) => i.complete && i.currentSrc);
    return {
      storage: loaded.filter((i) => i.currentSrc.includes("storage")).map((i) => i.currentSrc),
      broken: loaded.filter((i) => i.naturalWidth === 0).map((i) => i.currentSrc),
      pending: Array.from(document.images).filter((i) => !i.complete).length,
    };
  });
  check("feed shows the uploaded image from Neon storage", imgs.storage.length > 0, `storage imgs=${imgs.storage.length}`);
  check("no broken images", imgs.broken.length === 0, imgs.broken.slice(0, 2).join(" | "));
  check("feed renders post cards", (await A.locator("article").count()) > 0);

  /* ------------------------------------------------ like / favorite / comment */
  section("like / favorite / comment");
  const likeBefore = await textIn(A, "article:first-of-type div.mt-4 button:first-child span");
  await clickIn(A, "article:first-of-type div.mt-4 button:first-child");
  await A.waitForTimeout(3500);
  const likeAfter = await textIn(A, "article:first-of-type div.mt-4 button:first-child span");
  check("like toggles the count", likeBefore !== likeAfter, `${likeBefore} -> ${likeAfter}`);

  await clickIn(A, 'article:first-of-type button[aria-label="Save post"]');
  await A.waitForTimeout(3000);
  check("favorite toggles", (await A.locator('article:first-of-type button[aria-label="Remove from favorites"]').count()) > 0);

  await clickIn(A, "article:first-of-type div.mt-4 button:nth-child(2)");
  await A.waitForTimeout(6000);
  const onPost = /\/post\//.test(A.url());
  check("comment button opens the post", onPost, A.url());

  if (onPost) {
    await A.fill('input[placeholder="Add a comment..."]', `e2e comment ${stamp}`);
    await A.getByRole("button", { name: "Comment", exact: true }).click();
    await A.waitForTimeout(5000);
    check("comment is posted and listed", (await A.getByText(`e2e comment ${stamp}`).count()) > 0);
  }

  /* --------------------------------------------------------- user B + realtime */
  section("realtime: like + follow across two users");
  const ctxB = await newCtx();
  const B = await ctxB.newPage();
  const bagB = bag();
  watch(B, bagB);

  const bState = await ensureAccount(B, USER_B);
  check(`user B ready (${bState})`, bState === "created" || bState === "logged-in", bState);

  const bId = bState === "created" || bState === "logged-in" ? await userIdOf(ctxB) : null;
  check("user B id resolved", !!bId, String(bId));

  if (bId) {
    // --- A follows B; B must see it live. ---
    await B.goto(`${BASE}/notifications`, { waitUntil: "domcontentloaded" });
    await B.waitForTimeout(5000);
    await waitForSocket(bagB);

    await A.goto(`${BASE}/profile/${bId}`, { waitUntil: "domcontentloaded" });
    await A.waitForTimeout(6000);

    // Make the run repeatable: unfollow first so the follow below is always a fresh event.
    const label0 = await textIn(A, "main button, div button");
    if ((await A.getByRole("button", { name: /^following$/i }).count()) > 0) {
      await A.getByRole("button", { name: /^following$/i }).first().click();
      await A.waitForTimeout(4000);
    }
    const followBtn = A.getByRole("button", { name: /^follow$/i }).first();
    const canFollow = await followBtn.isVisible().catch(() => false);
    check("follow control available on a profile", canFollow, `initial label=${label0}`);

    const bFramesBefore = countFrames(bagB, "notification:create");
    if (canFollow) {
      await followBtn.click();
      await A.waitForTimeout(4000);
      check("follow API succeeded", bagA.bad.filter((x) => x.includes("/follows")).length === 0);
      check(
        "follow button flips to Following",
        (await A.getByRole("button", { name: /^following$/i }).count()) > 0,
      );
    }

    await B.waitForTimeout(8000);
    const bFramesAfter = countFrames(bagB, "notification:create");
    check(
      "B receives the follow notification without reloading",
      bFramesAfter > bFramesBefore,
      `notification:create frames ${bFramesBefore} -> ${bFramesAfter}`,
    );

    // --- B likes A's post; A must see it live. ---
    await A.goto(`${BASE}/notifications`, { waitUntil: "domcontentloaded" });
    await A.waitForTimeout(5000);
    await waitForSocket(bagA);
    const aFramesBefore = countFrames(bagA, "notification:create");

    // Like one of A's own posts (not "whatever is first in B's feed") so A is
    // guaranteed to receive the notification regardless of feed ranking.
    const bTok = (await (await ctxB.request.get(`${AUTH}/token`, { headers: { Origin: BASE } })).json())?.token;
    const feed = await (
      await ctxB.request.get(`${API}/api/posts`, { headers: { Authorization: `Bearer ${bTok}` } })
    ).json();
    const aPost = (feed.documents || []).find((p) => p.authorID === aId);
    const likeRes = aPost
      ? await ctxB.request.post(`${API}/api/likes`, {
          headers: { Authorization: `Bearer ${bTok}`, "Content-Type": "application/json" },
          data: { postId: aPost.$id, userName: "E2E B" },
        })
      : null;
    check("B can like a post", !!likeRes && likeRes.ok(), aPost ? aPost.$id : "no post by A");

    await A.waitForTimeout(8000);
    const aFramesAfter = countFrames(bagA, "notification:create");
    check(
      "A receives the like notification without reloading",
      aFramesAfter > aFramesBefore,
      `notification:create frames ${aFramesBefore} -> ${aFramesAfter}`,
    );

    check("realtime socket connected (A)", bagA.ws.length > 0, `ws=${bagA.ws.length}`);
    check("realtime socket connected (B)", bagB.ws.length > 0, `ws=${bagB.ws.length}`);
    await A.screenshot({ path: resolve(OUT, "02-realtime-notifications.png") });
  }

  /* --------------------------------------------------------------- messages */
  section("chat / messages");
  await A.goto(`${BASE}/messages`, { waitUntil: "domcontentloaded" });
  await A.waitForTimeout(4000);
  check("messages page renders", !A.url().includes("/login"), A.url());
  check("conversations request succeeded", bagA.bad.filter((x) => x.includes("/conversations")).length === 0);
  await A.screenshot({ path: resolve(OUT, "03-messages.png") });

  /* ---------------------------------------------------------------- stories */
  section("stories");
  await A.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  // StoryBar returns null when the viewer follows nobody who has posted, so wait for the
  // feed to settle before judging it.
  await A.waitForSelector("article", { timeout: 30000 }).catch(() => {});
  const storyVisible = await A.getByText(/stories/i)
    .first()
    .waitFor({ state: "visible", timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check("story bar renders for followed creators", storyVisible);

  /* ---------------------------------------------------------------- search */
  section("search");
  await A.goto(`${BASE}/search`, { waitUntil: "domcontentloaded" });
  await A.waitForTimeout(3000);
  const searchInput = A.locator('input[type="search"], input[placeholder*="earch"]').first();
  check("search input renders", await searchInput.isVisible().catch(() => false));
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("Browser");
    await A.waitForTimeout(4000);
    check("search runs without an API error", bagA.bad.length === 0, bagA.bad.slice(0, 2).join(" | "));
  }

  /* -------------------------------------------------------- profile + favorites */
  section("profile + favorites");
  await A.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
  await A.waitForTimeout(4000);
  check("profile renders", !A.url().includes("/login"), A.url());

  await A.goto(`${BASE}/favorites`, { waitUntil: "domcontentloaded" });
  await A.waitForTimeout(4000);
  check("favorites renders with the saved post", (await A.locator("article").count()) > 0 || (await A.getByText(/saved|favorite/i).count()) > 0);
  await A.screenshot({ path: resolve(OUT, "04-favorites.png") });

  /* ------------------------------------------------------------------ admin */
  section("admin dashboard");
  // Admin is a role, not an assumption: assert the correct behaviour for whichever
  // account is configured. Set GP_E2E_ADMIN=1 when using an admin account.
  const expectAdmin = process.env.GP_E2E_ADMIN === "1";
  const profileMenu = await A.locator('button[aria-label="Account menu"]');
  await profileMenu.click();
  await A.waitForTimeout(600);
  const adminLinkCount = await A.getByRole("menuitem", { name: "Admin" }).count();
  await A.keyboard.press("Escape");

  check(
    expectAdmin ? "admin entry shown in the profile menu" : "admin entry hidden for a non-admin",
    expectAdmin ? adminLinkCount > 0 : adminLinkCount === 0,
    `adminLinks=${adminLinkCount}`,
  );

  await A.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await A.waitForTimeout(5000);
  const adminBad = bagA.bad.filter((x) => x.includes("/api/admin"));
  if (expectAdmin) {
    check("admin dashboard loads", !A.url().includes("/login") && adminBad.length === 0, `${A.url()} ${adminBad.join(" | ")}`);
    check("admin tabs render", (await A.getByText(/users|reported|system/i).count()) > 0);
  } else {
    check(
      "non-admin sees the Admins only state",
      (await A.getByText(/admins only|don't have access/i).count()) > 0,
      A.url(),
    );
  }

  // The decisive check either way: authorization must be enforced by the server, not by
  // the client hiding a page. Call the API directly with the user's own token.
  check("captured a bearer token for direct API calls", !!bagA.token);
  if (bagA.token) {
    const direct = await ctxA.request.get(`${API}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${bagA.token}` },
    });
    check(
      expectAdmin ? "admin API allows an admin" : "admin API rejects a non-admin (403)",
      expectAdmin ? direct.status() === 200 : direct.status() === 403,
      `status ${direct.status()}`,
    );
  }
  await A.screenshot({ path: resolve(OUT, "05-admin.png") });

  /* ------------------------------------------------------------ error budget */
  section("error budget");
  check("no uncaught page errors (A)", bagA.pageErrors.length === 0, bagA.pageErrors.slice(0, 3).join(" | "));
  check("no failed API responses (A)", bagA.bad.length === 0, bagA.bad.slice(0, 5).join(" | "));
  check("no failed API responses (B)", bagB.bad.length === 0, bagB.bad.slice(0, 3).join(" | "));

  const missing = [...new Set(bagA.notFound)].filter((x) => !x.includes("/api/"));
  if (missing.length) console.log(`  info: non-API 404s: ${missing.join(", ")}`);

  await ctxB.close();
  await ctxA.close();
} finally {
  await browser.close();
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (failures.length) console.log("failed:", failures.join(", "));
console.log(`screenshots: ${OUT}`);
process.exit(fail === 0 ? 0 : 1);
