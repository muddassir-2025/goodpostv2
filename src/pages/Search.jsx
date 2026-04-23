import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import EmptyState from "../components/EmptyState";
import PostSkeleton from "../components/PostSkeleton";
import { SearchIcon } from "../components/ui/Icons";

import { fetchFeedPosts } from "../lib/posts";
import { getFileUrl, getHandle } from "../lib/ui";

// 🏷️ TAGS (your updated list)
const TAGS = [
  { name: "Islamic", emoji: "📿" },
  { name: "Quran", emoji: "📖" },
  { name: "Quote", emoji: "💬" },
  { name: "memes", emoji: "😂" },
  { name: "art", emoji: "🎨" },
  { name: "Nasheed", emoji: "🎶" },
  { name: "News", emoji: "📰" },
  { name: "Travel", emoji: "✈️" },
  { name: "Education", emoji: "📚" },
  { name: "Tech", emoji: "💻" },
  { name: "Health", emoji: "🧠" },
  { name: "Other", emoji: "✨" },
];

export default function Search() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let active = true;

    async function loadPosts() {
      setLoading(true);

      try {
        const data = await fetchFeedPosts(user);
        if (active) setPosts(data);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPosts();

    return () => {
      active = false;
    };
  }, [user]);

  // 🔍 POST SEARCH
  const results = useMemo(() => {
    if (!deferredQuery) return posts;

    return posts.filter((post) => {
      const text = `
        ${post.title || ""}
        ${post.content || ""}
        ${post.authorName || ""}
      `.toLowerCase();

      return text.includes(deferredQuery.toLowerCase());
    });
  }, [posts, deferredQuery]);

  // 🏷️ TAG SEARCH FILTER
  const filteredTags = useMemo(() => {
    if (!query) return TAGS;

    return TAGS.filter((tag) =>
      tag.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <section className="rounded-[32px] border border-white/10 bg-[#121212]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
        <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
          Explore
        </p>

        <h1 className="font-display mt-3 text-3xl text-white">
          Discover content
        </h1>

        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Search posts or explore by topics.
        </p>

        {/* SEARCH INPUT */}
        <div className="mt-5 rounded-[26px] border border-white/10 bg-black/35 p-3">
          <label className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-zinc-400">
              <SearchIcon className="h-5 w-5" />
            </span>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts, captions, creators..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </label>
        </div>
      </section>

     {/* 🏷️ TAG CARDS */}
<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
  {filteredTags.length ? (
    filteredTags.map((tag) => (
      <button
        key={tag.name}
        onClick={() => navigate(`/tag/${tag.name}`)}
        className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        {/* glow effect */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-3xl opacity-0 transition group-hover:opacity-100" />

        {/* emoji bubble */}
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-3xl transition group-hover:scale-110 group-hover:bg-white/10">
          {tag.emoji}
        </div>

        {/* title */}
        <h2 className="mt-4 font-display text-lg text-white transition group-hover:translate-x-0.5">
          {tag.name}
        </h2>

        {/* subtitle */}
        <p className="mt-1 text-xs text-zinc-500">
          Explore {tag.name.toLowerCase()} content
        </p>

        {/* bottom accent line */}
        <div className="mt-4 h-[1px] w-full bg-gradient-to-r from-white/10 to-transparent" />
      </button>
    ))
  ) : (
    <div className="col-span-full text-center text-sm text-zinc-500">
      No tags found for "{query}"
    </div>
  )}
</div>

      
     {/* POSTS (ONLY WHEN SEARCH ACTIVE) */}
{deferredQuery ? (
  loading ? (
    <PostSkeleton count={3} />
  ) : results.length ? (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {results.map((post) => {
        const imageSrc = getFileUrl(post.featuredImg);

        return (
          <button
            key={post.$id}
            onClick={() => navigate(`/post/${post.slug}`)}   // 🔥 FIX HERE
            className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[#121212]/90 text-left shadow-[0_10px_40px_rgba(0,0,0,0.45)] transition duration-300 hover:-translate-y-1 hover:border-white/20"
          >
            {/* IMAGE */}
            {imageSrc ? (
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={imageSrc}
                  alt={post.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              </div>
            ) : (
              <div className="aspect-square bg-gradient-to-br from-zinc-900 to-black" />
            )}

            {/* CONTENT */}
            <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/95 via-black/60 to-transparent p-3 pt-8">
              <p className="truncate text-sm font-semibold text-white">
                {post.title}
              </p>

              {post.content && (
                <p className="mt-0.5 truncate text-[11px] text-zinc-300">
                  {post.content}
                </p>
              )}

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-zinc-400">
                  {getHandle(post.authorName)}
                </p>

                {post.tags?.length ? (
                  <div className="flex gap-1 overflow-hidden">
                    {post.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-white/10 px-2 py-[2px] text-[9px] uppercase tracking-wider text-zinc-200 whitespace-nowrap">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  ) : (
    <EmptyState
      eyebrow="Search"
      title="No posts found"
      description="Try different keywords or search something else."
      actionLabel="Back to feed"
      actionTo="/"
    />
  )
) : null}

    </div>
  );
}