// Temporary full E2E. Usage:
//   GP_AUTH=<neon auth base> GP_API=<api base> GP_EMAIL=.. GP_PASSWORD=.. node scripts/_e2e.js
const AUTH = (process.env.GP_AUTH || "").replace(/\/+$/, "");
const API = (process.env.GP_API || "").replace(/\/+$/, "");
const EMAIL = process.env.GP_EMAIL;
const PASSWORD = process.env.GP_PASSWORD;
const ORIGIN = process.env.GP_ORIGIN || "https://goodpostv2.vercel.app";

if (!AUTH || !API || !EMAIL || !PASSWORD) {
  console.error("GP_AUTH, GP_API, GP_EMAIL, GP_PASSWORD are required");
  process.exit(1);
}

let pass = 0;
let fail = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  <- ${detail}` : ""}`);
  }
}

const { readFileSync, writeFileSync } = await import("node:fs");

/* ---------------- auth ---------------- */
const signIn = await fetch(`${AUTH}/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: ORIGIN },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const cookies = (signIn.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
const tokenRes = await fetch(`${AUTH}/token`, { headers: { Cookie: cookies, Origin: ORIGIN } });
const TOKEN = (await tokenRes.json())?.token;
if (!TOKEN) {
  console.error("could not obtain a JWT");
  process.exit(1);
}
writeFileSync("/tmp/gp_tok", TOKEN);

async function call(method, path, { body, auth = true, form } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Bearer ${TOKEN}`;
  const options = { method, headers };
  if (form) options.body = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const stamp = Date.now();
console.log(`\n=== full E2E against ${API} ===\n`);
console.log("-- identity --");

let r = await call("GET", "/api/users/me");
check("GET /api/users/me", r.status === 200 && !!r.data?.$id, `status ${r.status}`);
const me = r.data?.["$id"];

r = await call("PATCH", "/api/users/me", { body: { bio: `e2e ${stamp}` } });
check("PATCH /api/users/me", r.status === 200 && r.data?.prefs?.bio === `e2e ${stamp}`, `status ${r.status}`);

r = await call("GET", "/api/users?search=Smoke");
check("GET /api/users?search", r.status === 200 && Array.isArray(r.data?.documents), `status ${r.status}`);

r = await call("GET", `/api/users/${me}`);
check("GET /api/users/:id", r.status === 200 && r.data?.$id === me, `status ${r.status}`);

console.log("-- uploads (storage + moderation) --");
const jpegBytes = readFileSync("../public/GoodPost.jpeg");
const img = new FormData();
img.append("file", new Blob([jpegBytes], { type: "image/jpeg" }), "real.jpg");
r = await call("POST", "/api/uploads/image", { form: img });
check("POST /api/uploads/image (201)", r.status === 201 && !!r.data?.key, `status ${r.status}`);
const imageKey = r.data?.key;
if (r.data?.url) {
  const pub = await fetch(r.data.url);
  check("uploaded object publicly readable", pub.status === 200, `status ${pub.status}`);
}
const aud = new FormData();
aud.append("file", new Blob([Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00".padEnd(64, "\0"))], { type: "audio/mpeg" }), "t.mp3");
r = await call("POST", "/api/uploads/audio", { form: aud });
check("POST /api/uploads/audio", r.status === 201 && !!r.data?.key, `status ${r.status} ${JSON.stringify(r.data).slice(0, 90)}`);
const audioKey = r.data?.key;

const badImg = new FormData();
badImg.append("file", new Blob([Buffer.from("<html/>")], { type: "image/jpeg" }), "bad.jpg");
r = await call("POST", "/api/uploads/image", { form: badImg });
check("upload rejects non-image bytes (400)", r.status === 400, `status ${r.status}`);

console.log("-- posts --");
r = await call("POST", "/api/posts", {
  body: { title: `E2E ${stamp}`, content: "full e2e", tags: ["e2etag"], imageId: imageKey, audioId: audioKey, userName: "Smoke Test" },
});
check("POST /api/posts (201)", r.status === 201 && !!r.data?.$id, `status ${r.status}`);
const post = r.data;
check("  featuredImg stored as key", post?.featuredImg === imageKey, `got ${post?.featuredImg}`);
check("  Appwrite document shape", !!post?.["$id"] && "isPublished" in (post || {}) && "authorID" in (post || {}));

r = await call("GET", `/api/posts/slug/${post?.slug}`);
check("GET /api/posts/slug/:slug", r.status === 200 && r.data?.$id === post?.$id, `status ${r.status}`);
r = await call("GET", `/api/posts/${post?.$id}`);
check("GET /api/posts/:id", r.status === 200, `status ${r.status}`);
r = await call("GET", "/api/posts");
check("GET /api/posts", r.status === 200 && Array.isArray(r.data?.documents), `status ${r.status}`);

const q = encodeURIComponent(JSON.stringify([{ method: "contains", attribute: "tags", values: ["e2etag"] }]));
r = await call("GET", `/api/posts?queries=${q}`);
check("GET /api/posts?queries=contains(tags)", r.status === 200 && (r.data?.documents || []).some((d) => d.$id === post?.$id), `total ${r.data?.total}`);

const qp = encodeURIComponent(JSON.stringify([
  { method: "equal", attribute: "isPublished", values: [true] },
  { method: "orderDesc", attribute: "$createdAt" },
  { method: "limit", values: [10] },
  { method: "offset", values: [0] },
]));
r = await call("GET", `/api/posts?queries=${qp}`);
check("GET /api/posts multi-query (equal+order+limit+offset)", r.status === 200, `status ${r.status}`);

const qbad = encodeURIComponent(JSON.stringify([{ method: "equal", attribute: "evil", values: ["x"] }]));
r = await call("GET", `/api/posts?queries=${qbad}`);
check("query whitelist rejects unknown attribute (400)", r.status === 400, `status ${r.status}`);

r = await call("GET", `/api/posts/search?search=E2E ${stamp}`);
check("GET /api/posts/search", r.status === 200 && (r.data?.documents || []).length >= 1, `total ${r.data?.total}`);

r = await call("PATCH", `/api/posts/${post?.$id}`, { body: { title: `E2E renamed ${stamp}`, status: "private" } });
check("PATCH /api/posts/:id", r.status === 200 && r.data?.title === `E2E renamed ${stamp}` && r.data?.isPublished === false, `status ${r.status}`);

console.log("-- likes --");
r = await call("POST", "/api/likes", { body: { postId: post?.$id, userName: "Smoke Test" } });
check("POST /api/likes (201)", r.status === 201, `status ${r.status}`);
const likeId = r.data?.$id;
r = await call("GET", `/api/likes/count?postId=${post?.$id}`);
check("GET /api/likes/count", r.status === 200 && r.data?.total === 1, `total ${r.data?.total}`);
const lq = encodeURIComponent(JSON.stringify([{ method: "equal", attribute: "postId", values: [post?.$id] }]));
r = await call("GET", `/api/likes?queries=${lq}`);
check("GET /api/likes?queries", r.status === 200 && r.data?.total === 1, `total ${r.data?.total}`);

console.log("-- comments --");
r = await call("POST", "/api/comments", { body: { postId: post?.$id, content: `e2e comment ${stamp}` } });
check("POST /api/comments (201)", r.status === 201 && !!r.data?.$id, `status ${r.status}`);
const commentId = r.data?.$id;
r = await call("PATCH", `/api/comments/${commentId}`, { body: { content: "edited" } });
check("PATCH /api/comments/:id", r.status === 200 && r.data?.content === "edited", `status ${r.status}`);
const cq = encodeURIComponent(JSON.stringify([{ method: "equal", attribute: "postId", values: [post?.$id] }]));
r = await call("GET", `/api/comments?queries=${cq}`);
check("GET /api/comments?queries", r.status === 200 && r.data?.total === 1, `total ${r.data?.total}`);

console.log("-- favorites --");
r = await call("POST", "/api/favorites", { body: { postId: post?.$id } });
check("POST /api/favorites (201)", r.status === 201, `status ${r.status}`);
const favId = r.data?.$id;
const fq = encodeURIComponent(JSON.stringify([{ method: "equal", attribute: "userId", values: [me] }]));
r = await call("GET", `/api/favorites?queries=${fq}`);
check("GET /api/favorites?queries", r.status === 200 && r.data?.total === 1, `total ${r.data?.total}`);

console.log("-- follows --");
const SYSTEM = "00000000-0000-0000-0000-000000000001";
r = await call("POST", "/api/follows", { body: { followingId: SYSTEM, followerName: "Smoke Test" } });
check("POST /api/follows (201)", r.status === 201, `status ${r.status}`);
r = await call("GET", `/api/follows/status?followingId=${SYSTEM}`);
check("GET /api/follows/status", r.status === 200 && r.data?.following === true, `got ${JSON.stringify(r.data)}`);
r = await call("GET", `/api/follows/following?userId=${me}`);
check("GET /api/follows/following", r.status === 200 && (r.data?.ids || []).includes(SYSTEM), `ids ${JSON.stringify(r.data?.ids)}`);
r = await call("GET", `/api/follows/count?userId=${me}&type=following`);
check("GET /api/follows/count", r.status === 200 && r.data?.total === 1, `total ${r.data?.total}`);
r = await call("GET", `/api/follows?userId=${me}`);
check("GET /api/follows", r.status === 200, `status ${r.status}`);
r = await call("POST", "/api/follows", { body: { followingId: me } });
check("cannot follow yourself (400)", r.status === 400, `status ${r.status}`);

console.log("-- notifications --");
r = await call("GET", "/api/notifications");
check("GET /api/notifications", r.status === 200 && Array.isArray(r.data?.documents), `status ${r.status}`);
const notifId = r.data?.documents?.[0]?.["$id"];
r = await call("GET", "/api/notifications/unread-count");
check("GET /api/notifications/unread-count", r.status === 200 && typeof r.data?.total === "number", `got ${JSON.stringify(r.data)}`);
if (notifId) {
  r = await call("PATCH", `/api/notifications/${notifId}/read`);
  check("PATCH /api/notifications/:id/read", r.status === 200, `status ${r.status}`);
  r = await call("DELETE", `/api/notifications/${notifId}`);
  check("DELETE /api/notifications/:id", r.status === 200, `status ${r.status}`);
}
r = await call("POST", "/api/notifications/read-all");
check("POST /api/notifications/read-all", r.status === 200, `status ${r.status}`);
r = await call("DELETE", "/api/notifications");
check("DELETE /api/notifications (all)", r.status === 200, `status ${r.status}`);

console.log("-- stories --");
r = await call("GET", "/api/stories");
check("GET /api/stories", r.status === 200 && Array.isArray(r.data?.documents), `status ${r.status}`);

console.log("-- messaging --");
r = await call("POST", "/api/conversations", { body: { members: [me, SYSTEM] } });
check("POST /api/conversations (201)", r.status === 201 && !!r.data?.$id, `status ${r.status} ${JSON.stringify(r.data).slice(0, 90)}`);
const convId = r.data?.["$id"];
r = await call("GET", `/api/conversations/by-members?userId1=${me}&userId2=${SYSTEM}`);
check("GET /api/conversations/by-members", r.status === 200 && r.data?.$id === convId, `status ${r.status}`);
r = await call("GET", `/api/conversations/${convId}`);
check("GET /api/conversations/:id", r.status === 200 && r.data?.$id === convId, `status ${r.status}`);
const convq = encodeURIComponent(JSON.stringify([{ method: "contains", attribute: "members", values: [me] }]));
r = await call("GET", `/api/conversations?queries=${convq}`);
check("GET /api/conversations?queries=contains(members)", r.status === 200 && (r.data?.documents || []).some((d) => d.$id === convId), `total ${r.data?.total}`);

r = await call("POST", "/api/messages", { body: { conversationId: convId, text: `e2e msg ${stamp}` } });
check("POST /api/messages (201)", r.status === 201 && !!r.data?.$id, `status ${r.status}`);
const msgId = r.data?.["$id"];
r = await call("PATCH", `/api/messages/${msgId}`, { body: { text: "edited msg" } });
check("PATCH /api/messages/:id", r.status === 200 && r.data?.text === "edited msg", `status ${r.status}`);
const mq = encodeURIComponent(JSON.stringify([{ method: "equal", attribute: "conversationId", values: [convId] }]));
r = await call("GET", `/api/messages?queries=${mq}`);
check("GET /api/messages?queries", r.status === 200 && r.data?.total === 1, `total ${r.data?.total}`);
r = await call("POST", `/api/conversations/${convId}/seen`);
check("POST /api/conversations/:id/seen", r.status === 200, `status ${r.status}`);

console.log("-- report --");
r = await call("POST", `/api/posts/${post?.$id}/report`);
check("POST /api/posts/:id/report", r.status === 200 && ["reported", "already_reported"].includes(r.data?.status), `got ${JSON.stringify(r.data)}`);

console.log("-- guards --");
r = await call("GET", "/api/users/me", { auth: false });
check("anonymous -> 401", r.status === 401, `status ${r.status}`);
r = await call("GET", "/api/admin/stats");
check("non-admin -> 403 (until promoted)", r.status === 403 || r.status === 200, `status ${r.status}`);

console.log("-- admin --");
r = await call("GET", "/api/admin/stats");
const isAdmin = r.status === 200;
check("GET /api/admin/stats (needs admin)", isAdmin, `status ${r.status} — promote first if this fails`);
if (isAdmin) {
  check("  stats.counts present", !!r.data?.counts && typeof r.data.counts.users === "number", JSON.stringify(r.data?.counts));
  check("  stats.process present", !!r.data?.process, JSON.stringify(r.data?.process || {}).slice(0, 90));
  check("  stats.moderation present", !!r.data?.moderation, JSON.stringify(r.data?.moderation || {}).slice(0, 90));
  check("  stats.storage valid", r.data?.storage?.ok === true, JSON.stringify(r.data?.storage));

  r = await call("GET", "/api/admin/users?limit=5");
  check("GET /api/admin/users", r.status === 200 && Array.isArray(r.data?.documents), `status ${r.status}`);
  check("  users have isAdmin flag", typeof r.data?.documents?.[0]?.isAdmin === "boolean", JSON.stringify(r.data?.documents?.[0] || {}).slice(0, 120));

  r = await call("GET", "/api/admin/posts/reported");
  check("GET /api/admin/posts/reported", r.status === 200 && Array.isArray(r.data?.documents), `status ${r.status}`);

  r = await call("PATCH", `/api/admin/users/${me}`, { body: { isAdmin: false } });
  check("cannot revoke your own admin (400)", r.status === 400, `status ${r.status} ${JSON.stringify(r.data)}`);

  r = await call("PATCH", `/api/admin/users/${me}`, { body: { isAdmin: true } });
  check("PATCH /api/admin/users/:id (promote)", r.status === 200 && r.data?.isAdmin === true, `status ${r.status}`);

  r = await call("PATCH", "/api/admin/users/00000000-0000-0000-0000-0000000000ff", { body: { isAdmin: true } });
  check("PATCH unknown user -> 404", r.status === 404, `status ${r.status}`);
}

console.log("-- cleanup --");
if (msgId) await call("DELETE", `/api/messages/${msgId}`);
if (convId) await call("POST", `/api/conversations/${convId}/clear`);
if (convId) await call("DELETE", `/api/conversations/${convId}`);
if (commentId) await call("DELETE", `/api/comments/${commentId}`);
if (likeId) await call("DELETE", `/api/likes/${likeId}`);
if (favId) await call("DELETE", `/api/favorites/${favId}`);
r = await call("DELETE", `/api/follows?followingId=${SYSTEM}`);
check("DELETE /api/follows", r.status === 200, `status ${r.status}`);
if (imageKey) await call("POST", "/api/uploads/delete", { body: { key: imageKey } });
if (audioKey) await call("POST", "/api/uploads/delete", { body: { key: audioKey } });
r = await call("DELETE", `/api/posts/${post?.$id}`);
check("DELETE /api/posts/:id", r.status === 200, `status ${r.status}`);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (failures.length) console.log("failed:", failures.join(", "));
process.exit(fail === 0 ? 0 : 1);
