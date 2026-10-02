/**
 * Single source of truth for post tags and Explore categories.
 *
 * Both the composer and Explore read from here, so adding a category needs no UI change.
 * Keep these generic — the platform is for any interest, not one community or niche.
 * `emoji` is optional; Explore shows it, the composer does not.
 */
export const CATEGORIES = [
  { id: "technology", label: "Technology", emoji: "⚡" },
  { id: "education", label: "Education", emoji: "🎓" },
  { id: "science", label: "Science", emoji: "🔬" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "photography", label: "Photography", emoji: "📷" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "food", label: "Food", emoji: "🍜" },
  { id: "fitness", label: "Fitness", emoji: "🏋️" },
  { id: "news", label: "News", emoji: "📰" },
  { id: "lifestyle", label: "Lifestyle", emoji: "🌿" },
  { id: "business", label: "Business", emoji: "📈" },
  { id: "programming", label: "Programming", emoji: "💻" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "books", label: "Books", emoji: "📚" },
  { id: "movies", label: "Movies", emoji: "🍿" },
  { id: "nature", label: "Nature", emoji: "🌲" },
  { id: "motivation", label: "Motivation", emoji: "🔥" },
  { id: "other", label: "Other", emoji: "•" },
];

/** Lowercased tag names, in display order — what a post stores in its `tags` array. */
export const TAG_LABELS = CATEGORIES.map((category) => category.label.toLowerCase());

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));
const BY_LABEL = new Map(CATEGORIES.map((category) => [category.label.toLowerCase(), category]));

export function findCategory(value) {
  if (!value) return null;
  const key = String(value).toLowerCase();
  return BY_ID.get(key) || BY_LABEL.get(key) || null;
}

/** Resolve a stored tag to its display label, falling back to the raw value. */
export function categoryLabel(tag) {
  return findCategory(tag)?.label || String(tag || "");
}

/**
 * Filter categories for a composer search box. Returns every category for an empty
 * query so the picker is never blank.
 */
export function searchCategories(query, { limit = 12 } = {}) {
  const term = String(query || "").trim().toLowerCase();
  const matches = term
    ? CATEGORIES.filter((category) => category.label.toLowerCase().includes(term))
    : CATEGORIES;
  return matches.slice(0, limit);
}

/**
 * Highest-priority recommendation signal: which categories the viewer already engages
 * with. Derived from the posts they have written, so it needs no extra storage.
 */
export function categoryAffinity(posts = [], currentUserId) {
  const affinity = new Map();
  for (const post of posts) {
    if (!post || post.authorID !== currentUserId) continue;
    for (const tag of post.tags || []) {
      const key = String(tag).toLowerCase();
      affinity.set(key, (affinity.get(key) || 0) + 1);
    }
  }
  return affinity;
}
