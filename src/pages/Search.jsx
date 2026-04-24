import { useEffect, useMemo, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  DotsIcon
} from "../components/ui/Icons";

import postService from "../appwrite/post";
import { fetchFeedPosts, sortPosts, rankPostsForYou } from "../lib/posts";
import { getFileUrl, getHandle, formatRelativeTime } from "../lib/ui";

const CATEGORIES = [
  { id: "for-you", label: "For You" },
  { id: "trending", label: "Trending" },
  { id: "Islamic", label: "Islamic" },
  { id: "Quran", label: "Quran" },
  { id: "memes", label: "Memes" },
  { id: "Nasheed", label: "Nasheed" },
  { id: "art", label: "Art" },
  { id: "Quote", label: "Quotes" },
];

export default function Search() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState("for-you");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFullList, setIsFullList] = useState(false);
  
  const debouncedQuery = useDebounce(query, 300);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setIsFullList(true);
    }
  }, [initialQuery]);

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
    return () => { active = false; };
  }, [user]);

  // 🎯 RESULT FILTERING
  const results = useMemo(() => {
    let filtered = posts;
    const lowerQuery = debouncedQuery.toLowerCase();

    if (debouncedQuery) {
      filtered = posts.filter(p => {
        const text = `${p.title} ${p.content} ${p.authorName} ${p.tags?.join(" ")}`.toLowerCase();
        return text.includes(lowerQuery);
      });
      return rankPostsForYou(filtered);
    }

    if (activeCategory === "for-you") return rankPostsForYou(posts);
    if (activeCategory === "trending") return [];
    
    return posts.filter(p => 
      p.tags?.some(t => t.toLowerCase() === activeCategory.toLowerCase())
    );
  }, [posts, debouncedQuery, activeCategory]);

  const trendingTopics = useMemo(() => {
    const topicMap = {};
    posts.forEach(p => {
      p.tags?.forEach(tag => {
        if (!topicMap[tag]) {
          topicMap[tag] = { name: tag, count: 0, authors: new Set() };
        }
        topicMap[tag].count++;
        topicMap[tag].authors.add(p.authorName);
      });
    });
    return Object.values(topicMap).sort((a, b) => b.count - a.count);
  }, [posts]);

  const handleTabChange = (id) => {
    setActiveCategory(id);
    setQuery("");
    setIsFullList(false);
  };

  const handlePostClick = (post) => {
    navigate(`/post/${post.slug}`);
  };

  const renderPostItem = (post, compact = false) => (
    <div
      key={post.$id}
      className={`group w-full transition duration-300 hover:bg-white/[0.04] ${compact ? 'py-3' : 'py-5'}`}
    >
      <div className="flex gap-4 cursor-pointer" onClick={() => handlePostClick(post)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
            <Avatar name={post.authorName} size="xs" />
            <span className="font-semibold text-zinc-400 group-hover:text-white transition">
                {getHandle(post.authorName)}
            </span>
            <span>·</span>
            <span>{formatRelativeTime(post.$createdAt)}</span>
          </div>
          
          <h3 className={`font-display font-bold text-white leading-tight group-hover:text-blue-400 transition-colors ${compact ? 'text-[16px]' : 'text-[19px]'}`}>
            {post.title}
          </h3>
          
          {!compact && post.content && (
            <p className="mt-2 line-clamp-2 text-[14px] text-zinc-400 leading-relaxed">
              {post.content}
            </p>
          )}

          <div className="mt-4 flex items-center gap-5 text-zinc-500">
            <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase">
              <CommentIcon className="h-3.5 w-3.5" /> {post.commentCount}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase">
              <HeartIcon className="h-3.5 w-3.5" /> {post.likeCount}
            </span>
          </div>
        </div>

        {post.featuredImg && (
          <div className={`flex-shrink-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#121212] ${compact ? 'h-20 w-20' : 'h-28 w-28'}`}>
            <img 
              src={getFileUrl(post.featuredImg)} 
              className="h-full w-full object-cover transition duration-700 group-hover:scale-110" 
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen space-y-6 pb-24">
      {/* 🔍 HEADER (Glassmorphic) */}
      <section className="sticky top-16 z-40 -mx-2 bg-black/60 backdrop-blur-2xl md:top-20 md:mx-0 md:rounded-[32px] md:border md:border-white/10 md:p-1">
        <div className="flex flex-col gap-1 p-4">
          <div className="relative flex-1" ref={dropdownRef}>
            <div className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 focus-within:border-white/20 focus-within:bg-white/10 transition-all">
              <SearchIcon className="h-5 w-5 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value) setIsFullList(true);
                }}
                placeholder="Explore the feed..."
                className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-500"
              />
            </div>
          </div>

          {/* 📑 TABS */}
          <div className="hide-scrollbar mt-2 flex gap-1 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleTabChange(cat.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all whitespace-nowrap ${
                  activeCategory === cat.id && !query
                    ? "bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.2)]"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {loading ? (
          <PostSkeleton count={3} />
        ) : (
          <>
            {/* 🎯 DISCOVERY VIEW (The Glass Card) */}
            {!isFullList && !debouncedQuery && activeCategory !== "for-you" && activeCategory !== "trending" && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500">Discovery</p>
                        <h2 className="font-display mt-1 text-2xl text-white">Top in {activeCategory}</h2>
                    </div>
                    <TrendingIcon className="h-6 w-6 text-zinc-600" />
                  </div>
                  
                  {results.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {/* Featured Highlight */}
                      {renderPostItem(results[0], false)}
                      
                      {/* Compact Threads */}
                      <div className="mt-2 divide-y divide-white/5">
                        {results.slice(1, 5).map((post) => renderPostItem(post, true))}
                      </div>
                      
                      <button 
                        onClick={() => setIsFullList(true)}
                        className="mt-4 flex w-full items-center justify-center rounded-[20px] bg-white/5 py-4 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                      >
                        Show all {results.length} posts in {activeCategory}
                      </button>
                    </div>
                  ) : (
                    <EmptyState title={`No posts in ${activeCategory}`} description="Be the first to share something!" />
                  )}
                </div>
              </section>
            )}

            {/* 📈 TRENDING DIRECTORY (Glass Card) */}
            {!isFullList && !debouncedQuery && activeCategory === "trending" && (
              <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]/90 p-2 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl animate-in fade-in duration-500">
                <div className="p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500">Live Trends</p>
                    <h2 className="font-display mt-1 text-2xl text-white">Global Topics</h2>
                </div>
                <div className="divide-y divide-white/5">
                  {trendingTopics.map(topic => (
                    <button
                      key={topic.name}
                      onClick={() => {
                        setActiveCategory(topic.name);
                        setIsFullList(true);
                      }}
                      className="group flex w-full items-center justify-between p-5 text-left transition hover:bg-white/[0.04]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 transition group-hover:text-rose-400">Trending Now</p>
                        <h2 className="mt-1 font-display text-[20px] text-white transition group-hover:translate-x-1">#{topic.name}</h2>
                        <p className="mt-1 text-xs text-zinc-500">{topic.count} posts shared today</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-zinc-400 transition group-hover:bg-white/10 group-hover:text-white">
                        <DotsIcon className="h-5 w-5" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 🏁 FEED VIEW (Matching Home Style) */}
            {(isFullList || debouncedQuery || activeCategory === "for-you") && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {results.length > 0 ? results.map((p) => (
                   <div key={p.$id} className="overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]/90 p-1 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl">
                      {renderPostItem(p, false)}
                   </div>
                )) : (
                  <EmptyState title="No results found" description="Try another category" />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}