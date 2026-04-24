import { useEffect, useState, useRef } from "react";
import { ID } from "appwrite";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import Avatar from "../components/Avatar";
import { ArrowLeftIcon } from "../components/ui/Icons";
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
        const [conv, msgs, postsRes] = await Promise.all([
          messageService.getConversation(conversationId),
          messageService.getMessages(conversationId),
          postService.getPosts() // For getting user details
        ]);

        if (!active || !conv) return;

        setConversation(conv);
        setMessages(msgs.documents || []);

        // Get other user info
        const otherId = conv.members.find(id => id !== user.$id);
        const postByOther = (postsRes?.documents || []).find(p => p.authorID === otherId);
        
        setOtherUser({
          id: otherId,
          name: postByOther ? postByOther.authorName : "User"
        });

        // Mark as seen if we have unread messages and we didn't send the last one
        if (conv.unreadCount > 0) {
           await messageService.markSeen(conversationId);
        }

      } catch (err) {
        console.error("Failed to load chat", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadChat();

    // Subscribe to realtime
    const unsubscribe = messageService.subscribeToMessages(conversationId, (payload) => {
      if (active) {
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
      // Remove temp message on failure
      setMessages(prev => prev.filter(m => m.$id !== tempId));
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] sm:h-[calc(100vh-100px)] max-w-[850px] mx-auto rounded-[32px] border border-white/10 bg-[#121212]/92 shadow-[0_30px_90px_rgba(0,0,0,0.34)] overflow-hidden">
      
      {/* HEADER */}
      <header className="flex items-center gap-4 border-b border-white/10 p-4 bg-black/40 backdrop-blur-md">
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
          <Link to={`/profile/${otherUser.id}`} className="flex items-center gap-3 cursor-pointer group">
            <Avatar name={otherUser.name} size="md" />
            <div>
              <p className="font-bold text-white group-hover:underline">{otherUser.name}</p>
              <p className="text-xs text-zinc-500">{getHandle(otherUser.name)}</p>
            </div>
          </Link>
        ) : null}
      </header>

      {/* MESSAGES LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-zinc-600 border-t-white rounded-full animate-spin" />
          </div>
        ) : messages.length > 0 ? (
          messages.map((msg, index) => {
            const isMe = msg.senderId === user.$id;
            const showAvatar = !isMe && (index === 0 || messages[index - 1].senderId !== msg.senderId);

            return (
              <div key={msg.$id} className={`flex ${isMe ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`flex gap-2 max-w-[75%] sm:max-w-[65%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  
                  {/* Avatar Placeholder for alignment if no avatar needed this row */}
                  {!isMe && (
                    <div className="w-8 shrink-0 flex items-end">
                      {showAvatar && <Avatar name={otherUser?.name || "User"} size="sm" />}
                    </div>
                  )}

                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div
                      className={`px-4 py-2 rounded-2xl text-[15px] leading-relaxed ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-white/10 text-zinc-100 rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-zinc-600 mt-1 px-1">
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
               <Avatar name={otherUser?.name || "User"} size="xl" />
            </div>
            <p className="text-sm">Say hello to {otherUser?.name}!</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="p-4 bg-black/40 border-t border-white/10">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition placeholder:text-zinc-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ↑
          </button>
        </form>
      </div>

    </div>
  );
}
