import { useEffect, useMemo, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Query } from "appwrite";
import { useDebounce } from "../hooks/useDebounce";

import EmptyState from "../components/EmptyState";
import PostSkeleton from "../components/PostSkeleton";
import Avatar from "../components/Avatar";
import {
  SearchIcon,
  TrendingIcon,
  HeartIcon,
  CommentIcon,
  ImageIcon,
  AudioIcon,
  PlayIcon,
  UserIcon,
  DotsIcon,
  ShieldIcon,
} from "../components/ui/Icons";

import postService from "../appwrite/post";
import { fetchFeedPosts, sortPosts, rankPostsForYou } from "../lib/posts";
import { getFileUrl, getHandle, formatRelativeTime } from "../lib/ui";

const CATEGORIES = [
  { id: "for-you", label: "For You", emoji: "✦" },
  { id: "trending", label: "Trending", emoji: "↑" },
  { id: "islamic", label: "Islamic", emoji: "☽" },
  { id: "quran", label: "Quran", emoji: "◈" },
  { id: "knowledge", label: "Knowledge", emoji: "◉" },
  { id: "memes", label: "Memes", emoji: "◎" },
  { id: "audio", label: "Audio", emoji: "♪" },
  { id: "art", label: "Art", emoji: "◇" },
  { id: "sports", label: "Sports", emoji: "◆" },
  { id: "travel", label: "Travel", emoji: "◈" },
  { id: "other", label: "Other", emoji: "•" },
];



export default function Search() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("cat") || "for-you";
  const isFullList = searchParams.get("view") === "full";
  const urlQuery = searchParams.get("q") || "";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(urlQuery);
  const [showDropdown, setShowDropdown] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);

  const debouncedQuery = useDebounce(query, 300);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    let active = true;
    async function loadPosts() {
      setLoading(true);
      try {
        const data = await fetchFeedPosts(user, [Query.equal("isPublished", true)]);
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

  const results = useMemo(() => {
    let filtered = posts;
    const lowerQuery = debouncedQuery.toLowerCase();

    if (debouncedQuery) {
      filtered = posts.filter((p) => {
        const text =
          `${p.title} ${p.content} ${p.authorName} ${p.tags?.join(" ")}`.toLowerCase();
        return text.includes(lowerQuery);
      });
      return rankPostsForYou(filtered);
    }

    if (activeCategory === "for-you") return rankPostsForYou(posts);
    if (activeCategory === "trending") return [];

    return posts.filter((p) =>
      p.tags?.some((t) => t.toLowerCase() === activeCategory.toLowerCase())
    );
  }, [posts, debouncedQuery, activeCategory]);

  const trendingTopics = useMemo(() => {
    const topicMap = {};
    posts.forEach((p) => {
      p.tags?.forEach((tag) => {
        const lower = tag.toLowerCase();
        if (!topicMap[lower]) {
          topicMap[lower] = { name: tag, count: 0, authors: new Set() };
        }
        topicMap[lower].count++;
        topicMap[lower].authors.add(p.authorName);
      });
    });
    return Object.values(topicMap).sort((a, b) => b.count - a.count);
  }, [posts]);

  const matchingTags = useMemo(() => {
    if (!debouncedQuery) return [];
    const lowerQ = debouncedQuery.toLowerCase();
    return trendingTopics.filter((t) => t.name.toLowerCase().includes(lowerQ));
  }, [trendingTopics, debouncedQuery]);

  const updateUrl = (params) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(params).forEach(([k, v]) => {
          if (v === null) next.delete(k);
          else next.set(k, v);
        });
        return next;
      },
      { replace: true }
    );
  };

  const handleTabChange = (id) => {
    setQuery("");
    updateUrl({ cat: id, view: null, q: null });
  };

  const handlePostClick = (post) => {
    navigate(`/post/${post.slug}`);
  };

  const handleReport = async (post) => {
    if (!user) {
      navigate("/login");
      return;
    }
    const ok = await window.confirm("Report this post?");
    if (!ok) return;
    try {
      const res = await postService.reportPost(post.$id, user.$id);
      if (res.status === "deleted") {
        setPosts((prev) => prev.filter((p) => p.$id !== post.$id));
      }
    } catch (e) {}
  };

  const handleDelete = async (post) => {
    const ok = await window.confirm("Delete this post?");
    if (!ok) return;
    try {
      await postService.deletePost(post.$id);
      setPosts((prev) => prev.filter((p) => p.$id !== post.$id));
    } catch (e) {}
  };

  /* ─── POST CARD ─── */
  const renderPostItem = (post, index = 0, compact = false) => (
    <article
      key={post.$id}
      className="group relative border-b border-white/[0.06] transition-colors duration-200 hover:bg-white/[0.025]"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div
        className={`flex gap-3 cursor-pointer ${compact ? "px-5 py-3.5" : "px-5 py-5"}`}
        onClick={() => handlePostClick(post)}
      >
        {/* Avatar col */}
        <div className="flex-shrink-0 pt-0.5">
          <Avatar name={post.authorName} userId={post.authorID} size={compact ? "sm" : "md"} />
        </div>

        {/* Content col */}
        <div className="flex-1 min-w-0">
          {/* Author + time row */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[13px] font-semibold text-white/90 hover:text-white transition-colors">
              {getHandle(post.authorName)}
            </span>
            <span className="text-white/20 text-xs">·</span>
            <span className="text-[12px] text-white/35">
              {formatRelativeTime(post.$createdAt)}
            </span>
          </div>

          {/* Title */}
          <h3
            className={`font-bold text-white leading-snug group-hover:text-white/90 transition-colors ${
              compact ? "text-[14px]" : "text-[16px]"
            }`}
          >
            {post.title}
          </h3>

          {/* Excerpt */}
          {!compact && post.content && (
            <p className="mt-1.5 line-clamp-2 text-[13px] text-white/45 leading-relaxed">
              {post.content}
            </p>
          )}

          {/* Tags */}
          {!compact && post.tags?.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.06] text-white/40 border border-white/[0.08]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-4">
            <button
              className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-sky-400 transition-colors group/stat"
              onClick={(e) => e.stopPropagation()}
            >
              <CommentIcon className="h-3.5 w-3.5 group-hover/stat:scale-110 transition-transform" />
              <span>{post.commentCount ?? 0}</span>
            </button>
            <button
              className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-rose-400 transition-colors group/stat"
              onClick={(e) => e.stopPropagation()}
            >
              <HeartIcon className="h-3.5 w-3.5 group-hover/stat:scale-110 transition-transform" />
              <span>{post.likeCount ?? 0}</span>
            </button>

            {/* Dots menu */}
            <div className="relative ml-auto" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() =>
                  setMenuOpenId(menuOpenId === post.$id ? null : post.$id)
                }
                className="p-1.5 rounded-full hover:bg-white/10 text-white/25 hover:text-white/60 transition-colors"
              >
                <DotsIcon className="h-3.5 w-3.5" />
              </button>

              {menuOpenId === post.$id && (
                <div className="absolute bottom-full right-0 mb-2 z-50 w-40 rounded-2xl border border-white/10 bg-[#111113] shadow-2xl shadow-black/60 p-1.5 overflow-hidden">
                  <button
                    onClick={() => handlePostClick(post)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    View post
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpenId(null);
                      handleReport(post);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-amber-400/80 hover:bg-amber-400/[0.08] hover:text-amber-400 transition-colors"
                  >
                    Report
                  </button>
                  {(user?.$id === post.authorID || user?.isAdmin) && (
                    <>
                      <div className="my-1 border-t border-white/[0.06]" />
                      <button
                        onClick={() => navigate(`/edit/${post.$id}`)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpenId(null);
                          handleDelete(post);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-rose-400/80 hover:bg-rose-400/[0.08] hover:text-rose-400 transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Thumbnail */}
        {post.featuredImg && (
          <div
            className={`flex-shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900 ${
              compact ? "h-14 w-14" : "h-20 w-20 sm:h-24 sm:w-24"
            }`}
          >
            <img
              src={getFileUrl(post.featuredImg)}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              alt=""
            />
          </div>
        )}
      </div>
    </article>
  );

  /* ─── TRENDING ROW ─── */
  const renderTrendingRow = (topic, rank) => (
    <button
      key={topic.name}
      onClick={() => navigate(`/tag/${topic.name.toLowerCase()}`)}
      className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.025] border-b border-white/[0.05]"
    >
      <span className="text-[13px] font-bold text-white/15 w-5 text-right tabular-nums">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-white/25 mb-0.5">
          Trending
        </p>
        <h2 className="text-[15px] font-extrabold text-white group-hover:text-white/80 transition-colors">
          #{topic.name}
        </h2>
        <p className="text-[12px] text-white/30 mt-0.5">
          {topic.count} {topic.count === 1 ? "post" : "posts"}
        </p>
      </div>
      <span className="text-white/15 group-hover:text-white/40 transition-colors text-lg leading-none">
        →
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-blue-500/25">

      {/* ── STICKY HEADER ── */}
      <header className="sticky top-16 z-40 bg-[#0a0a0b]/90 backdrop-blur-xl border-b border-white/[0.06] md:top-20">

        {/* Search bar */}
        <div className="px-4 pt-4 pb-3">
          <div
            ref={dropdownRef}
            className="relative flex items-center gap-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] px-4 py-2.5 transition-all duration-200 focus-within:bg-white/[0.08] focus-within:border-white/20 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
          >
            <SearchIcon className="h-4 w-4 text-white/30 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                updateUrl({ q: val || null, view: val ? "full" : null });
              }}
              placeholder="Search posts, topics, authors…"
              className="w-full bg-transparent text-[14px] text-white placeholder:text-white/25 outline-none caret-blue-400"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  updateUrl({ q: null, view: null });
                }}
                className="flex-shrink-0 h-5 w-5 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors text-white/60 text-[11px] font-bold"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="hide-scrollbar flex overflow-x-auto gap-1.5 px-4 pb-3">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id && !debouncedQuery;
            return (
              <button
                key={cat.id}
                onClick={() => handleTabChange(cat.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? "bg-white text-black shadow-sm"
                    : "text-white/45 hover:text-white/75 hover:bg-white/[0.07]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── BODY ── */}
      <div>
        {loading ? (
          <div className="p-6">
            <PostSkeleton count={5} />
          </div>
        ) : (
          <>
            {/* ── CATEGORY VIEW (not full list, not searching) ── */}
            {!isFullList && !debouncedQuery &&
              activeCategory !== "for-you" &&
              activeCategory !== "trending" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                  {/* Section header */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-white/30 mb-0.5">
                        Category
                      </p>
                      <h2 className="text-[20px] font-extrabold text-white capitalize">
                        {activeCategory}
                      </h2>
                    </div>
                    {results.length > 5 && (
                      <button
                        onClick={() => updateUrl({ view: "full" })}
                        className="text-[13px] font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        See all
                      </button>
                    )}
                  </div>

                  {results.length > 0 ? (
                    <div>
                      {/* Featured first post */}
                      <div className="mx-5 mb-1 rounded-2xl border border-white/[0.08] overflow-hidden bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <div
                          className="cursor-pointer p-4"
                          onClick={() => handlePostClick(results[0])}
                        >
                          <div className="flex gap-3">
                            <Avatar name={results[0].authorName} userId={results[0].authorID} size="md" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[13px] font-semibold text-white/90">
                                  {getHandle(results[0].authorName)}
                                </span>
                                <span className="text-white/20 text-xs">·</span>
                                <span className="text-[12px] text-white/35">
                                  {formatRelativeTime(results[0].$createdAt)}
                                </span>
                              </div>
                              <h3 className="text-[17px] font-extrabold text-white leading-snug">
                                {results[0].title}
                              </h3>
                              {results[0].content && (
                                <p className="mt-1.5 line-clamp-3 text-[13px] text-white/45 leading-relaxed">
                                  {results[0].content}
                                </p>
                              )}
                              <div className="mt-3 flex items-center gap-4">
                                <span className="flex items-center gap-1.5 text-[12px] text-white/30">
                                  <CommentIcon className="h-3.5 w-3.5" />
                                  {results[0].commentCount ?? 0}
                                </span>
                                <span className="flex items-center gap-1.5 text-[12px] text-white/30">
                                  <HeartIcon className="h-3.5 w-3.5" />
                                  {results[0].likeCount ?? 0}
                                </span>
                              </div>
                            </div>
                            {results[0].featuredImg && (
                              <div className="flex-shrink-0 h-20 w-20 rounded-xl overflow-hidden border border-white/[0.08]">
                                <img
                                  src={getFileUrl(results[0].featuredImg)}
                                  className="h-full w-full object-cover"
                                  alt=""
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Compact follow-up posts */}
                      <div className="mt-1">
                        {results
                          .slice(1, 5)
                          .map((post, idx) => renderPostItem(post, idx + 1, true))}
                      </div>

                      {results.length > 5 && (
                        <button
                          onClick={() => updateUrl({ view: "full" })}
                          className="group flex w-full items-center justify-center gap-2 py-4 text-[13px] font-semibold text-blue-400 hover:text-blue-300 transition-colors border-t border-white/[0.05]"
                        >
                          Show all {results.length} posts
                          <span className="transition-transform group-hover:translate-x-0.5">
                            →
                          </span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="py-16 text-center">
                      <EmptyState
                        title={`Nothing in ${activeCategory} yet`}
                        description="Be the first to post here!"
                      />
                    </div>
                  )}
                </div>
              )}

            {/* ── TRENDING TOPICS ── */}
            {!isFullList && !debouncedQuery && activeCategory === "trending" && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                <div className="px-5 py-4">
                  <p className="text-[11px] uppercase tracking-widest text-white/30 mb-0.5">
                    Right now
                  </p>
                  <h2 className="text-[20px] font-extrabold text-white">
                    What's trending
                  </h2>
                </div>
                <div>
                  {trendingTopics.map((topic, i) =>
                    renderTrendingRow(topic, i + 1)
                  )}
                </div>
              </div>
            )}

            {/* ── FULL LIST / SEARCH / FOR-YOU ── */}
            {(isFullList || debouncedQuery || activeCategory === "for-you") && (
              <div className="animate-in fade-in duration-300">

                {/* Matching tags chips */}
                {debouncedQuery && matchingTags.length > 0 && (
                  <div className="px-5 py-4 border-b border-white/[0.05]">
                    <p className="text-[11px] uppercase tracking-widest text-white/30 mb-3">
                      Topics
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {matchingTags.slice(0, 5).map((tag) => (
                        <button
                          key={tag.name}
                          onClick={() =>
                            navigate(`/tag/${tag.name.toLowerCase()}`)
                          }
                          className="group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-[13px] font-medium text-white/60 hover:bg-white/[0.09] hover:border-white/20 hover:text-white/90 transition-all duration-200"
                        >
                          <span className="text-white/30">#</span>
                          {tag.name}
                          <span className="ml-1 text-[11px] text-white/25 bg-white/[0.06] px-1.5 py-0.5 rounded-full">
                            {tag.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Results count when searching */}
                {debouncedQuery && results.length > 0 && (
                  <div className="px-5 py-3 border-b border-white/[0.05]">
                    <p className="text-[12px] text-white/30">
                      {results.length} result{results.length !== 1 ? "s" : ""}{" "}
                      for{" "}
                      <span className="text-white/60 font-medium">
                        "{debouncedQuery}"
                      </span>
                    </p>
                  </div>
                )}

                {results.length > 0 ? (
                  results.map((p, idx) => renderPostItem(p, idx, false))
                ) : (
                  <div className="py-20 text-center">
                    <EmptyState
                      title={
                        debouncedQuery
                          ? `No results for "${debouncedQuery}"`
                          : "Nothing here yet"
                      }
                      description={
                        debouncedQuery
                          ? "Try a different keyword or browse a category"
                          : "Check back soon!"
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}