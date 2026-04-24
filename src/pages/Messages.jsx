import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import messageService from "../appwrite/message";
import followService from "../appwrite/follow";
import postService from "../appwrite/post";
import { formatRelativeTime, getHandle } from "../lib/ui";
import { 
  SearchIcon, 
  SendIcon, 
  ArrowLeftIcon, 
  DotsIcon,
  UserIcon
} from "../components/ui/Icons";

export default function Messages() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialChatId = searchParams.get("chat");

  const [threads, setThreads] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // { userId, userName }
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [filter, setFilter] = useState("all");
  const [isFollowingIds, setIsFollowingIds] = useState([]);
  const [followersIds, setFollowersIds] = useState([]);

  const scrollRef = useRef(null);

  // 🔥 LOAD INBOX & RELATIONSHIPS
  useEffect(() => {
    if (!user) return;

    let active = true;

    async function loadInbox() {
      setLoading(true);
      try {
        const [convos, following, followers] = await Promise.all([
          messageService.getConversations(user.$id),
          followService.getFollowing(user.$id),
          followService.getFollowers(user.$id)
        ]);

        if (active) {
          setThreads(convos);
          setIsFollowingIds(following);
          setFollowersIds(followers);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInbox();
    return () => (active = false);
  }, [user]);

  // 🔥 REAL-TIME SUBSCRIPTION
  useEffect(() => {
    if (!user) return;

    const unsubscribe = messageService.subscribe((res) => {
      const payload = res.payload;
      
      // Update thread list
      setThreads((prev) => {
        const otherId = payload.senderId === user.$id ? payload.receiverId : payload.senderId;
        const exists = prev.find(t => (t.senderId === otherId || t.receiverId === otherId));
        
        if (exists) {
          return [payload, ...prev.filter(t => t.$id !== exists.$id)];
        }
        return [payload, ...prev];
      });

      // Update active chat
      if (activeChat && (payload.senderId === activeChat.userId || payload.receiverId === activeChat.userId)) {
        setMessages((prev) => [...prev, payload]);
      }
    });

    return () => unsubscribe();
  }, [user, activeChat]);

  // 🔥 LOAD MESSAGES FOR ACTIVE CHAT
  useEffect(() => {
    if (!user || !activeChat) return;

    async function fetchHistory() {
      const history = await messageService.getMessages(user.$id, activeChat.userId);
      setMessages(history);
    }

    fetchHistory();
  }, [user, activeChat]);

  // 🔥 AUTO SCROLL
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🔥 SEARCH USERS (via Posts authors)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setUserResults([]);
      return;
    }

    const delay = setTimeout(async () => {
      const res = await postService.getPosts();
      const uniqueUsers = [];
      const seen = new Set();
      
      for (const post of res.documents) {
        if (post.authorID === user.$id) continue;
        if (post.authorName.toLowerCase().includes(searchQuery.toLowerCase()) && !seen.has(post.authorID)) {
          seen.add(post.authorID);
          uniqueUsers.push({ userId: post.authorID, userName: post.authorName });
        }
      }
      setUserResults(uniqueUsers);
    }, 300);

    return () => clearTimeout(delay);
  }, [searchQuery, user.$id]);

  // 🔥 FILTER LOGIC
  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      const otherId = thread.senderId === user.$id ? thread.receiverId : thread.senderId;
      
      const isFollowing = isFollowingIds.includes(otherId);
      const isFollower = followersIds.includes(otherId);

      if (filter === "following") return isFollowing;
      if (filter === "follower") return isFollower;
      if (filter === "stranger") return !isFollowing && !isFollower;
      if (filter === "pending") return thread.receiverId === user.$id && thread.status === "sent"; // Mocking pending as unread
      return true;
    });
  }, [threads, filter, user.$id, isFollowingIds, followersIds]);

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const msg = newMessage.trim();
    setNewMessage("");

    try {
      await messageService.sendMessage({
        senderId: user.$id,
        receiverId: activeChat.userId,
        senderName: user.name,
        content: msg,
      });
    } catch (error) {
      console.error("Message send failed");
    }
  }

  if (!user) {
    return (
      <EmptyState
        eyebrow="Messages"
        title="Sign in to chat"
        description="Connect with others through real-time messaging."
        actionLabel="Log in"
        actionTo="/login"
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
      {/* LEFT PANE: CONVERSATION LIST */}
      <aside className={`flex-1 flex flex-col min-w-0 md:max-w-[360px] rounded-[32px] border border-white/10 bg-[#121212]/92 shadow-2xl transition-all ${activeChat ? "hidden md:flex" : "flex"}`}>
        {/* HEADER */}
        <div className="p-6 border-b border-white/5">
          <h1 className="font-display text-3xl text-white font-black">Inbox</h1>
          
          {/* SEARCH */}
          <div className="mt-4 relative group">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-white transition" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full bg-black/40 border border-white/5 rounded-2xl py-2.5 pl-11 pr-4 text-sm text-white outline-none focus:border-white/20 transition"
            />
            
            {/* SEARCH RESULTS DROPDOWN */}
            {userResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-zinc-950 border border-white/10 rounded-2xl p-2 shadow-2xl max-h-60 overflow-y-auto">
                {userResults.map(u => (
                  <button 
                    key={u.userId}
                    onClick={() => {
                      setActiveChat(u);
                      setSearchQuery("");
                      setUserResults([]);
                    }}
                    className="flex items-center gap-3 w-full p-3 hover:bg-white/5 rounded-xl transition text-left"
                  >
                    <Avatar name={u.userName} size="sm" />
                    <span className="text-sm font-semibold text-white">{getHandle(u.userName)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* FILTERS */}
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {["all", "following", "follower", "stranger", "pending"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${
                  filter === f ? "bg-white text-black" : "bg-white/5 text-zinc-500 hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* THREADS LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : filteredThreads.length > 0 ? (
            filteredThreads.map(thread => {
              const otherId = thread.senderId === user.$id ? thread.receiverId : thread.senderId;
              const isSelected = activeChat?.userId === otherId;
              
              return (
                <button
                  key={thread.$id}
                  onClick={() => setActiveChat({ userId: otherId, userName: thread.senderName === user.name ? "Chat" : thread.senderName })}
                  className={`flex items-center gap-4 w-full p-4 rounded-2xl transition ${
                    isSelected ? "bg-white text-black" : "bg-white/5 hover:bg-white/10 text-white"
                  }`}
                >
                  <Avatar name={thread.senderName === user.name ? "User" : thread.senderName} size="md" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-bold truncate text-sm">
                      {thread.senderName === user.name ? "Message" : getHandle(thread.senderName)}
                    </p>
                    <p className={`text-xs truncate mt-0.5 ${isSelected ? "text-black/70" : "text-zinc-500"}`}>
                      {thread.content}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-center py-10 opacity-40">
              <UserIcon className="h-10 w-10 mx-auto mb-2" />
              <p className="text-xs uppercase tracking-widest">No messages</p>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT PANE: CHAT WINDOW */}
      <main className={`flex-[2] flex flex-col min-w-0 rounded-[32px] border border-white/10 bg-[#121212]/92 shadow-2xl transition-all ${!activeChat ? "hidden md:flex opacity-20 pointer-events-none" : "flex"}`}>
        {activeChat ? (
          <>
            {/* CHAT HEADER */}
            <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveChat(null)}
                  className="md:hidden p-2 rounded-full hover:bg-white/5"
                >
                  <ArrowLeftIcon className="h-5 w-5 text-white" />
                </button>
                <Link to={`/profile/${activeChat.userId}`} className="flex items-center gap-3">
                  <Avatar name={activeChat.userName} size="md" ring />
                  <div>
                    <p className="font-display text-lg text-white font-black leading-none">{getHandle(activeChat.userName)}</p>
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Active Now</p>
                  </div>
                </Link>
              </div>
              <button className="p-2 text-zinc-500 hover:text-white transition">
                <DotsIcon className="h-5 w-5" />
              </button>
            </div>

            {/* MESSAGES AREA */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => {
                const isMine = msg.senderId === user.$id;
                return (
                  <div key={msg.$id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-[24px] px-5 py-3 text-sm leading-relaxed shadow-xl ${
                      isMine 
                        ? "bg-white text-black rounded-tr-none" 
                        : "bg-zinc-900 text-white rounded-tl-none border border-white/5"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            {/* INPUT AREA */}
            <form onSubmit={handleSendMessage} className="p-6 pt-0">
              <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-3xl px-5 py-2.5 focus-within:border-white/20 transition">
                <input 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 bg-transparent text-sm text-white outline-none py-2"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-white text-black rounded-full hover:scale-105 active:scale-95 transition disabled:opacity-30"
                >
                  <SendIcon className="h-4 w-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <SendIcon className="h-8 w-8 text-white/20" />
            </div>
            <h3 className="text-xl font-bold text-white">Your Messages</h3>
            <p className="text-sm text-zinc-500 mt-2 max-w-[280px]">
              Select a conversation or search for a user to start chatting in real-time.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
