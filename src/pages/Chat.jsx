import { useEffect, useState, useRef } from "react";
import { confirm, toast } from "../confirmService";
import { ID, Query } from "appwrite";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "../components/Avatar";
import { ArrowLeftIcon, EditIcon, TrashIcon, CloseIcon, DotsIcon, SearchIcon } from "../components/ui/Icons";
import messageService from "../appwrite/message";
import postService from "../appwrite/post";
import { formatRelativeTime, getHandle } from "../lib/ui";

export default function Chat() {
  const { conversationId } = useParams();
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let active = true;

    async function loadChat() {
      if (!user) return;
      setLoading(true);

      try {
        const [conv, msgs] = await Promise.all([
          messageService.getConversation(conversationId),
          messageService.getMessages(conversationId),
        ]);

        if (!active || !conv) return;

        setConversation(conv);
        setMessages(msgs.documents || []);

        // Get other user info (targeted query instead of fetching all posts)
        const otherId = conv.members.find(id => id !== user.$id);
        const postRes = await postService.getPosts([
          Query.equal("authorID", otherId),
          Query.limit(1)
        ]);
        const postByOther = postRes?.documents?.[0];
        
        setOtherUser({
          id: otherId,
          name: postByOther ? postByOther.authorName : "User"
        });

        // Mark as seen if we have unread messages and we didn't send the last one
        if (conv.unreadCount > 0) {
           const lastMsg = msgs?.documents?.[0];
           if (lastMsg && lastMsg.senderId !== user.$id) {
             await messageService.markSeen(conversationId);
           }
        }

      } catch (err) {
        console.error("Failed to load chat", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadChat();

    // Subscribe to realtime
    const unsubscribe = messageService.subscribeToMessages(conversationId, (payload, isDeletedEvent) => {
      if (active) {
        if (isDeletedEvent) {
          setMessages(prev => prev.filter(m => m.$id !== payload.$id));
          return;
        }
        setMessages(prev => {
          // Prevent duplicates
          if (prev.find(m => m.$id === payload.$id)) {
             // Update if existing (e.g. seen status)
             return prev.map(m => m.$id === payload.$id ? payload : m);
          }
          return [...prev, payload];
        });
        
        // If we received a message while active, mark conversation as seen
        if (payload.senderId !== user.$id) {
           messageService.markSeen(conversationId);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [conversationId, user]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !user) return;

    const text = newMessage.trim();
    setNewMessage("");
    setSending(true);

    if (editingMessageId) {
      // HANDLE EDIT
      try {
        const actualMsg = await messageService.editMessage(editingMessageId, text);
        setMessages(prev => prev.map(m => m.$id === editingMessageId ? actualMsg : m));
        setEditingMessageId(null);
      } catch (err) {
        console.error("Failed to edit", err);
      } finally {
        setSending(false);
      }
      return;
    }

    // HANDLE SEND NEW
    // Optimistic UI update
    const tempId = ID.unique();
    const tempMsg = {
      $id: tempId,
      conversationId,
      senderId: user.$id,
      text,
      createdAt: new Date().toISOString(),
      seen: false,
    };
    
    setMessages(prev => [...prev, tempMsg]);

    try {
      const actualMsg = await messageService.sendMessage(conversationId, user.$id, text, tempId);
      // Replace temp with actual confirmed message
      setMessages(prev => prev.map(m => m.$id === tempId ? actualMsg : m));
    } catch (err) {
      console.error("Failed to send", err);
      toast("Failed to send message: " + err.message, "error");
      // Remove temp message on failure
      setMessages(prev => prev.filter(m => m.$id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (msgId) => {
    const isConfirmed = await confirm("Delete this message for everyone?");
    if (!isConfirmed) return;
    try {
      await messageService.deleteMessage(msgId);
      // Realtime will handle the update
      if (editingMessageId === msgId) {
        setEditingMessageId(null);
        setNewMessage("");
      }
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };
 
  const handleClearChat = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const isConfirmed = await confirm("Are you sure you want to clear all messages in this chat? This cannot be undone.");
    if (!isConfirmed) return;
    try {
      // Immediately update the UI
      setMessages([]);
      // Then sync with server
      await messageService.clearChat(conversationId);
    } catch (error) {
      console.error("Failed to clear chat", error);
      // Reload messages if it failed
      const msgs = await messageService.getMessages(conversationId);
      setMessages(msgs.documents || []);
    }
  };

  const handleDeleteConversation = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const isConfirmed = await confirm("Delete this conversation? All messages will be cleared.");
    if (!isConfirmed) return;
    try {
      await messageService.deleteConversation(conversationId);
      navigate("/messages");
    } catch (error) {
      console.error("Failed to delete conversation", error);
      navigate("/messages");
    }
  };
 
  const filteredMessages = messages.filter(m => 
    m.text.toLowerCase().includes(chatSearchQuery.toLowerCase())
  );

  if (!user) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] sm:h-[calc(100vh-100px)] max-w-[850px] mx-auto rounded-[32px] border border-white/10 bg-[#0a0a0b] shadow-[0_30px_90px_rgba(0,0,0,0.4)] overflow-hidden relative">
      
      {/* Immersive background glow */}
      <div className="absolute top-0 left-1/4 h-64 w-64 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 h-64 w-64 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* HEADER */}
      <header className="relative z-10 flex items-center gap-4 border-b border-white/[0.06] p-4 bg-black/40 backdrop-blur-xl">
        <button
          onClick={() => navigate("/messages")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-zinc-300 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
 
        {loading ? (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-white/10" />
            <div className="w-24 h-4 rounded-full bg-white/10" />
          </div>
        ) : otherUser ? (
          <div className="flex-1 flex items-center justify-between">
            <Link to={`/profile/${otherUser.id}`} className="flex items-center gap-3 cursor-pointer group">
              <Avatar name={otherUser.name} userId={otherUser.id} size="md" />

              <div>
                <p className="font-extrabold text-white group-hover:text-blue-400 transition-colors leading-tight">{otherUser.name}</p>
                <p className="text-[11px] text-white/30 font-medium">{getHandle(otherUser.name)}</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-2 relative">
              {/* Minimalist Search Toggle */}
              <button 
                onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setChatSearchQuery(""); }}
                className={`p-2 rounded-full transition-colors ${searchOpen ? "bg-blue-600 text-white" : "text-white/40 hover:bg-white/10 hover:text-white"}`}
              >
                <SearchIcon className="h-4 w-4" />
              </button>

              {/* Chat Options Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setMenuOpenId(menuOpenId === "chat-options" ? null : "chat-options")}
                  className={`p-2 rounded-full transition-colors ${menuOpenId === "chat-options" ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/10 hover:text-white"}`}
                >
                  <DotsIcon className="h-4 w-4" />
                </button>

                <AnimatePresence>
                  {menuOpenId === "chat-options" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-white/[0.08] bg-[#1a1a1c]/95 backdrop-blur-2xl p-1.5 shadow-2xl z-50"
                    >
                      <button 
                        onClick={(e) => { setMenuOpenId(null); handleClearChat(e); }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
                      >
                        <TrashIcon className="h-4 w-4 opacity-70" />
                        Clear Chat
                      </button>
                      
                      <div className="my-1 h-px w-full bg-white/[0.06]" />
                      
                      <button 
                        onClick={(e) => { setMenuOpenId(null); handleDeleteConversation(e); }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-500 hover:bg-rose-500/10 transition"
                      >
                        <CloseIcon className="h-4 w-4 opacity-70" />
                        Delete Chat
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : null}
      </header>
 
      {/* Search Bar Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 border-b border-white/[0.06] bg-black/20 overflow-hidden"
          >
            <div className="p-3">
              <input 
                autoFocus
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-white/20"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* MESSAGES LIST */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-3 border-white/10 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {filteredMessages.length > 0 ? (
                filteredMessages.map((msg, index) => {
                  const isMe = msg.senderId === user.$id;
                  const showAvatar = !isMe && (index === 0 || messages[index - 1].senderId !== msg.senderId);
                  const isDeleted = msg.text === "🚫 This message was deleted";
                  const canEdit = isMe && !isDeleted;
 
                  return (
                    <motion.div
                      key={msg.$id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      layout
                      className={`group flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`flex gap-3 max-w-[85%] sm:max-w-[70%] ${isMe ? "flex-row-reverse" : "flex-row"} items-end`}>
                        
                        {!isMe && (
                          <div className="w-8 shrink-0">
                            {showAvatar ? (
                              <Avatar name={otherUser?.name || "User"} userId={otherUser?.id} size="sm" />
                            ) : <div className="w-8" />}
                          </div>
                        )}
 
                        <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                          <div
                            className={`relative px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed transition-all duration-200 ${
                              isDeleted ? "italic text-white/30 bg-white/[0.03] border border-white/[0.05]" :
                              isMe
                                ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-900/20 rounded-br-sm"
                                : "bg-white/[0.07] text-zinc-100 backdrop-blur-md rounded-bl-sm border border-white/[0.05]"
                            }`}
                          >
                            {msg.text}
                            {isMe && msg.seen && !isDeleted && (
                              <span className="absolute -bottom-4 right-0 text-[9px] text-blue-400 font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Seen</span>
                            )}
                          </div>
                          <span className="text-[9px] font-bold text-white/20 mt-1.5 uppercase tracking-wider px-1">
                            {formatRelativeTime(msg.createdAt)}
                          </span>
                        </div>
 
                        {/* Actions Menu */}
                        {canEdit && (
                          <div className={`relative transition-all duration-200 flex items-center mb-4 opacity-100`}>
                            <button 
                              onClick={() => setMenuOpenId(menuOpenId === msg.$id ? null : msg.$id)}
                              className={`p-1.5 rounded-full transition-colors ${menuOpenId === msg.$id ? "bg-white/10 text-white" : "bg-white/[0.05] text-white/40 hover:text-white hover:bg-white/10"}`}
                            >
                              <DotsIcon className="h-3.5 w-3.5" />
                            </button>
 
                            <AnimatePresence>
                              {menuOpenId === msg.$id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, y: 5 }}
                                  className="absolute bottom-full right-0 mb-2 z-50 w-32 rounded-xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl p-1 shadow-2xl overflow-hidden"
                                >
                                  <button 
                                    onClick={() => {
                                      setEditingMessageId(msg.$id);
                                      setNewMessage(msg.text);
                                      setMenuOpenId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/80 hover:bg-white/10 hover:text-white transition"
                                  >
                                    <EditIcon className="h-3 w-3" />
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => {
                                      handleDelete(msg.$id);
                                      setMenuOpenId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 transition"
                                  >
                                    <TrashIcon className="h-3 w-3" />
                                    Delete
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                   <div className="relative mb-6">
                      <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150" />
                      <Avatar name={otherUser?.name || "User"} userId={otherUser?.id} size="xl" className="relative z-10 scale-125" />
                   </div>
                   <h2 className="text-xl font-black text-white mb-1">Start a Conversation</h2>
                   <p className="text-sm text-white/30 max-w-[200px]">Send your first message to connect with {otherUser?.name}.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
 
      {/* INPUT */}
      <footer className="relative z-20 p-5 bg-black/60 backdrop-blur-2xl border-t border-white/[0.06]">
        {editingMessageId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-full left-0 w-full bg-blue-600/90 backdrop-blur-xl px-5 py-2 flex items-center justify-between text-[11px] font-bold text-white border-b border-white/10"
          >
            <div className="flex items-center gap-2">
              <EditIcon className="h-3 w-3" />
              EDITING MODE
            </div>
            <button 
              onClick={() => {
                setEditingMessageId(null);
                setNewMessage("");
              }}
              className="p-1 hover:bg-black/20 rounded-full"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </motion.div>
        )}
 
        <form onSubmit={handleSend} className="flex gap-3">
          <div className="relative flex-1 group">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:bg-white/[0.08] focus:border-white/20 transition-all duration-300 placeholder:text-white/20 shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl font-black transition-all duration-300 transform active:scale-95 ${
              editingMessageId 
                ? "bg-white text-black hover:bg-zinc-200"
                : "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 hover:-translate-y-0.5"
            } disabled:opacity-30 disabled:grayscale disabled:translate-y-0`}
          >
            {editingMessageId ? "SAVE" : (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </form>
      </footer>
 
    </div>
  );
}
