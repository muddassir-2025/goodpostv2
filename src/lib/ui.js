const endpoint = (import.meta.env.VITE_APPWRITE_ENDPOINT || "").replace(/\/$/, "");
const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;

export function normalizeText(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

export function getFileUrl(fileId, params = {}) {
  if (!fileId || !endpoint || !bucketId || !projectId) {
    return "";
  }

  let url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
  
  Object.entries(params).forEach(([key, value]) => {
    url += `&${key}=${encodeURIComponent(value)}`;
  });

  return url;
}

export function getInitials(name = "Guest") {
  const safeName = normalizeText(name, "Guest");

  return safeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function getHandle(name = "guest user") {
  return normalizeText(name, "guest_user").toLowerCase().replace(/\s+/g, "_");
}

export function formatCompactNumber(value = 0) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(safeValue);
}

export function formatRelativeTime(dateString) {
  if (!dateString) {
    return "just now";
  }

  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) {
    return "just now";
  }

  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  const ranges = [
    { limit: 60, divisor: 1, unit: "minute" },
    { limit: 1440, divisor: 60, unit: "hour" },
    { limit: 43200, divisor: 1440, unit: "day" },
    { limit: 525600, divisor: 43200, unit: "month" },
    { limit: Infinity, divisor: 525600, unit: "year" },
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const range of ranges) {
    if (Math.abs(diffMinutes) < range.limit) {
      return formatter.format(
        Math.round(diffMinutes / range.divisor),
        range.unit,
      );
    }
  }

  return "just now";
}

export function createSlug(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const storyGradients = [
  "from-fuchsia-500 via-rose-500 to-amber-400",
  "from-sky-500 via-cyan-400 to-emerald-400",
  "from-violet-500 via-purple-500 to-pink-500",
  "from-orange-500 via-amber-400 to-yellow-300",
  "from-emerald-500 via-teal-400 to-sky-400",
  "from-indigo-600 via-blue-500 to-cyan-400",
  "from-rose-500 via-pink-500 to-orange-400",
  "from-teal-500 via-emerald-400 to-lime-300",
  "from-amber-600 via-orange-500 to-rose-500",
  "from-violet-600 via-indigo-500 to-sky-500",
  "from-cyan-500 via-sky-500 to-blue-600",
  "from-red-500 via-orange-500 to-yellow-500",
];

export function getStoryGradient(seed = "") {
  const safeSeed = normalizeText(seed, "guest");
  const total = [...safeSeed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return storyGradients[total % storyGradients.length];
}

export function buildStories(posts = [], user) {
  const stories = [];
  const seen = new Set();

  if (user) {
    stories.push({
      id: `user-${user.$id}`,
      label: "Your story",
      name: user.name,
      href: "/profile",
      isOwn: true,
    });
    seen.add(user.$id);
  }

  posts.forEach((post) => {
    if (!post?.authorID || seen.has(post.authorID)) {
      return;
    }

    seen.add(post.authorID);

    const authorName = normalizeText(post.authorName, "Guest");
    const slug = normalizeText(post.slug, "");

    stories.push({
      id: post.authorID,
      label: getHandle(authorName),
      name: authorName,
      href: slug ? `/post/${slug}` : "/",
      cover: post.featuredImg ? getFileUrl(post.featuredImg) : "",
      isOwn: false,
    });
  });

  return stories.slice(0, 8);
}

const FORBIDDEN_WORDS = [
  "fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "whore", "slut", "bastard",
  "porn", "sexy", "nude", "naked", "sex", "hentai", "milf", "bra", "lingerie", "boobs", "ass", "hot", "beach"
];

export function containsForbiddenWord(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return FORBIDDEN_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });
}

