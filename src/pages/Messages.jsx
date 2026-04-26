import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import { SearchIcon, UserIcon } from "../components/ui/Icons";
import { useDebounce } from "../hooks/useDebounce";
import messageService from "../appwrite/message";
import followService from "../appwrite/follow";
import postService from "../appwrite/post";
import { formatRelativeTime, getHandle } from "../lib/ui";

export default function Messages() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState("all");

  const [conversations, setConversations] = useState([]);
  const [usersDirectory, setUsersDirectory] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Load users directory (since we don't have a direct users API)
  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!user) return;
      setLoading(true);
      try {
        const [postsResponse, followingResponse, convsResponse] = await Promise.all([
          postService.getPosts(), // Used to extract unique users
          followService.getFollowing(user.$id),
          messageService.getConversations(user.$id)
        ]);

        if (!active) return;

        // Extract unique users
        const uniqueUsersMap = new Map();
        for (const post of postsResponse?.documents || []) {
          if (!uniqueUsersMap.has(post.authorID) && post.authorID !== user.$id) {
            uniqueUsersMap.set(post.authorID, {
              id: post.authorID,
              name: post.authorName,
            });
          }
        }
        setUsersDirectory(Array.from(uniqueUsersMap.values()));
        setFollowingIds(followingResponse || []);

        // Enhance conversations with other user's info
        const enhancedConvsPromises = (convsResponse?.documents || []).map(async conv => {
          const otherUserId = conv.members.find(id => id !== user.$id);
          const otherUser = uniqueUsersMap.get(otherUserId) || { id: otherUserId, name: "Unknown User" };
          
          let actualUnread = conv.unreadCount;
          if (actualUnread > 0) {
            // Check if we were the sender
            const msgs = await messageService.getMessages(conv.$id, 1);
            const lastMsg = msgs.documents[0];
            if (lastMsg && lastMsg.senderId === user.$id) {
               actualUnread = 0;
            }
          }

          return {
            ...conv,
            unreadCount: actualUnread,
            otherUser
          };
        });
        
        const enhancedConvs = await Promise.all(enhancedConvsPromises);
        setConversations(enhancedConvs);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, [user]);

  // 2. Handle Search Results
  const searchResults = useMemo(() => {
    if (!debouncedSearch) return [];
    return usersDirectory.filter(u => 
      u.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [debouncedSearch, usersDirectory]);

  // 3. Handle Filters
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      const isFollowing = followingIds.includes(conv.otherUser.id);
      
      if (activeTab === "unread") {
        return conv.unreadCount > 0; // Assuming unreadCount is reset when viewed
      }
      if (activeTab === "following") {
        return isFollowing;
      }
      if (activeTab === "requests") {
        return !isFollowing;
      }
      return true; // "all"
    });
  }, [conversations, activeTab, followingIds]);

  // 4. Handle User Click (from Search or Direct)
  const handleUserClick = async (targetUser) => {
    if (!user) return;
    
    // Check if conversation exists
    let conv = await messageService.getConversationByMembers(user.$id, targetUser.id);
    
    if (!conv) {
      // Create new conversation
      conv = await messageService.createConversation([user.$id, targetUser.id]);
    }
    
    navigate(`/messages/${conv.$id}`);
  };

  if (!user) {
    return (
      <EmptyState
        eyebrow="Messages"
        title="Sign in to chat"
        description="Connect with other users through direct messages."
        actionLabel="Log in"
        actionTo="/login"
      />
    );
  }

  return (
    <div className="space-y-6 max-w-[850px] mx-auto pb-20 px-4 sm:px-0">
      {/* HEADER & SEARCH */}
      <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#121212]/60 backdrop-blur-2xl p-6 shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 h-64 w-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-8">
          <div>
            <h1 className="font-black text-3xl text-white tracking-tight">Messages</h1>
            <p className="text-[13px] text-white/30 mt-1 font-medium">Connect with creators and friends</p>
          </div>
          
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 focus-within:border-white/20 focus-within:bg-white/[0.06] transition-all duration-300 w-full sm:max-w-[320px] shadow-inner">
            <SearchIcon className="h-4 w-4 text-white/20" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/10"
            />
          </div>
        </div>
 
        {/* TABS */}
        {!searchQuery && (
          <div className="relative flex gap-1 rounded-2xl bg-black/40 p-1.5 w-full sm:w-fit border border-white/[0.05]">
            {["all", "unread", "following", "requests"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative z-10 flex-1 sm:flex-none rounded-xl px-5 py-2 text-[12px] font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${
                    isActive ? "text-black" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white rounded-xl shadow-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-20">{tab}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
 
      {/* SEARCH RESULTS OR CONVERSATION LIST */}
      <section className="min-h-[500px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <div className="w-10 h-10 border-3 border-white/10 border-t-white rounded-full animate-spin" />
             <p className="text-xs font-bold text-white/20 uppercase tracking-widest">Encrypting chats...</p>
          </div>
        ) : searchQuery ? (
          // SEARCH RESULTS
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <h3 className="px-6 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/20">Discovery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchResults.length > 0 ? searchResults.map(u => (
                <motion.div
                  key={u.id}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleUserClick(u)}
                  className="flex items-center gap-4 rounded-[24px] border border-white/[0.05] bg-white/[0.03] px-5 py-4 cursor-pointer transition-all hover:bg-white/[0.06] hover:border-white/10 shadow-lg"
                >
                  <Avatar name={u.name} userId={u.id} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-black text-white truncate">{u.name}</p>
                    <p className="text-[12px] text-white/30 font-medium truncate">{getHandle(u.name)}</p>
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-full py-20 text-center rounded-[32px] border border-dashed border-white/10">
                  <p className="text-sm text-white/20 font-bold uppercase tracking-widest">No users match your search</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          // CONVERSATION LIST
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredConversations.length > 0 ? filteredConversations.map((conv) => (
                <motion.div
                  key={conv.$id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  layout
                >
                  <Link
                    to={`/messages/${conv.$id}`}
                    className="flex items-center gap-5 rounded-[28px] border border-white/[0.06] bg-[#121212]/40 backdrop-blur-md px-4 py-4 sm:px-6 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/10 hover:shadow-2xl hover:-translate-y-1 group"
                  >
                    <div 
                      onClick={(e) => { e.preventDefault(); navigate(`/profile/${conv.otherUser.id}`); }}
                      className="shrink-0 relative"
                    >
                      <Avatar name={conv.otherUser.name} userId={conv.otherUser.id} size="lg" />
                      {conv.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 rounded-full border-2 border-[#121212] animate-pulse" />
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3 mb-0.5">
                        <p className={`truncate text-[15px] ${conv.unreadCount > 0 ? "font-black text-white" : "font-bold text-white/70"}`}>
                          {conv.otherUser.name}
                        </p>
                        {conv.lastMessageAt && (
                          <span className="shrink-0 text-[10px] font-bold text-white/20 uppercase tracking-tighter">
                            {formatRelativeTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <p className={`truncate text-[13px] leading-relaxed ${conv.unreadCount > 0 ? "font-semibold text-white/90" : "text-white/30"}`}>
                        {conv.lastMessage || "Start a conversation"}
                      </p>
                    </div>
 
                    {conv.unreadCount > 0 && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-blue-600 px-2 text-[10px] font-black text-white shadow-lg shadow-blue-600/30">
                        {conv.unreadCount}
                      </span>
                    )}
                  </Link>
                </motion.div>
              )) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <EmptyState
                    eyebrow="Inbox"
                    title={`No ${activeTab !== 'all' ? activeTab : ''} messages`}
                    description="Connect with others to start chatting."
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
