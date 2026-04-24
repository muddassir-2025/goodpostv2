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
  const [menuOpenId, setMenuOpenId] = useState(null); // Track which menu is open
  
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
        setPosts(prev => prev.filter(p => p.$id !== post.$id));
        alert("Post removed.");
      } else {
        alert("Reported.");
      }
    } catch {
      alert("Report failed.");
    }
  };

  const handleDelete = async (post) => {
    const ok = await window.confirm("Delete this post?");
    if (!ok) return;

    try {
      if (post.featuredImg) await postService.deleteFile(post.featuredImg);
      if (post.audioId) await postService.deleteFile(post.audioId);
      await postService.deletePost(post.$id);
      setPosts(prev => prev.filter(p => p.$id !== post.$id));
    } catch {
      alert("Delete failed.");
    }
  };

  const renderPostItem = (post, index = 0, compact = false) => (
    <div
      key={post.$id}
      className={`group w-full border-b border-white/5 transition hover:bg-white/[0.03] ${compact ? 'p-4' : 'p-5'}`}
    >
      <div className="flex gap-4 cursor-pointer" onClick={() => handlePostClick(post)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[13px] text-zinc-500 mb-1">
            <span className="font-bold text-white transition group-hover:text-blue-400">
                {getHandle(post.authorName)}
            </span>
            <span>·</span>
            <span>{formatRelativeTime(post.$createdAt)}</span>
          </div>
          
          <h3 className={`font-bold text-white leading-snug group-hover:text-zinc-200 transition ${compact ? 'text-[15px]' : 'text-[17px]'}`}>
            {post.title}
          </h3>
          
          {!compact && (
            <p className="mt-1 line-clamp-2 text-[14px] text-zinc-400 leading-normal">
              {post.content}
            </p>
          )}

          <div className="mt-3 flex items-center gap-5 text-zinc-500">
            <span className="flex items-center gap-1.5 text-xs">
              <CommentIcon className="h-4 w-4" /> {post.commentCount}
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <HeartIcon className="h-4 w-4" /> {post.likeCount}
            </span>
            
            <div className="relative ml-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === post.$id ? null : post.$id);
                }}
                className="p-1 rounded-full hover:bg-white/10 text-zinc-500"
              >
                <DotsIcon className="h-4 w-4" />
              </button>

              {menuOpenId === post.$id && (
                <div className="absolute bottom-full right-0 mb-2 z-50 w-36 rounded-xl border border-white/10 bg-zinc-950 p-1 shadow-2xl shadow-black">
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePostClick(post); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/5"
                  >
                    View
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); handleReport(post); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-amber-400 hover:bg-amber-400/10"
                  >
                    Report
                  </button>
                  {((user?.$id === post.authorID) || user?.isAdmin) && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/edit/${post.$id}`); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white hover:bg-white/5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); handleDelete(post); }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10"
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

        {post.featuredImg && (
          <div className={`flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 ${compact ? 'h-16 w-16' : 'h-24 w-24'}`}>
            <img 
              src={getFileUrl(post.featuredImg)} 
              className="h-full w-full object-cover transition duration-500 group-hover:scale-110" 
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* 🔍 TOP NAV */}
      <header className="sticky top-16 z-40 bg-black/80 backdrop-blur-md md:top-20">
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="relative flex-1" ref={dropdownRef}>
            <div className="flex items-center gap-3 rounded-full bg-[#202327] px-4 py-2 transition focus-within:bg-black focus-within:ring-1 focus-within:ring-blue-500">
              <SearchIcon className="h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value) setIsFullList(true);
                }}
                placeholder="Search"
                className="w-full bg-transparent text-[15px] outline-none"
              />
            </div>
          </div>
        </div>

        {/* 📑 TABS */}
        <div className="hide-scrollbar flex overflow-x-auto border-b border-white/10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleTabChange(cat.id)}
              className={`relative min-w-[100px] py-4 text-sm font-bold transition whitespace-nowrap px-4 ${
                activeCategory === cat.id && !query ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {cat.label}
              {activeCategory === cat.id && !query && (
                <div className="absolute bottom-0 left-1/2 h-1 w-full -translate-x-1/2 rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="">
        {loading ? (
          <div className="p-10 text-center"><PostSkeleton count={5} /></div>
        ) : (
          <>
            {/* 🎯 DISCOVERY VIEW */}
            {!isFullList && !debouncedQuery && activeCategory !== "for-you" && activeCategory !== "trending" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-5">
                   <h2 className="text-xl font-extrabold text-white">Trending in {activeCategory}</h2>
                </div>
                
                {results.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {/* The "Headliner" - First Post is bigger */}
                    {renderPostItem(results[0], 0, false)}
                    
                    {/* The rest are compact list items */}
                    {results.slice(1, 5).map((post, idx) => renderPostItem(post, idx + 1, true))}
                    
                    <button 
                      onClick={() => setIsFullList(true)}
                      className="group flex w-full items-center justify-between p-5 text-sm font-medium text-blue-500 hover:bg-white/5 transition"
                    >
                      Show more
                      <span className="opacity-0 transition group-hover:opacity-100 group-hover:translate-x-1">→</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-10 text-center">
                    <EmptyState title={`No posts in ${activeCategory}`} description="Be the first to share!" />
                  </div>
                )}
              </div>
            )}

            {/* 📈 TRENDING TAB VIEW */}
            {!isFullList && !debouncedQuery && activeCategory === "trending" && (
              <div className="divide-y divide-white/10">
                {trendingTopics.map(topic => (
                   <button
                    key={topic.name}
                    onClick={() => {
                      setActiveCategory(topic.name);
                      setIsFullList(true);
                    }}
                    className="flex w-full items-start justify-between p-5 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-zinc-500">Trending</p>
                      <h2 className="mt-1 text-[16px] font-extrabold text-white">#{topic.name}</h2>
                      <p className="text-[13px] text-zinc-500 mt-1">{topic.count} posts</p>
                    </div>
                    <DotsIcon className="h-5 w-5 text-zinc-600" />
                  </button>
                ))}
              </div>
            )}

            {/* 🏁 FULL LIST / FOR YOU VIEW */}
            {(isFullList || debouncedQuery || activeCategory === "for-you") && (
              <div className="divide-y divide-white/10 animate-in fade-in duration-500">
                {results.length > 0 ? results.map((p, idx) => renderPostItem(p, idx, false)) : (
                  <div className="p-10 text-center">
                    <EmptyState title="No results found" description="Try another category" />
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