import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import notificationService from "../appwrite/notification";
import messageService from "../appwrite/message";
import postService from "../appwrite/post";
import { formatRelativeTime } from "../lib/ui";
import { BellIcon, HeartIcon, CommentIcon, UserIcon, MessageIcon, DotsIcon, TrashIcon } from "../components/ui/Icons";
import { confirm } from "../confirmService";

export default function Notifications() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    let active = true;

    async function loadAllNotifications() {
      try {
        const [notifRes, convRes, postsRes] = await Promise.all([
          notificationService.getUserNotifications(user.$id),
          messageService.getConversations(user.$id),
          postService.getPosts() // Used to find user names
        ]);

        if (!active) return;

        // Build a user map for faster lookups
        const userMap = {};
        if (postsRes?.documents) {
          postsRes.documents.forEach(p => {
            if (p.authorID && p.authorName) {
              userMap[p.authorID] = p.authorName;
            }
          });
        }

        const regularNotifs = notifRes?.documents || [];
        
        // Transform unread conversations into notification objects (Filter out own messages)
        const chatNotifsPromises = (convRes?.documents || [])
          .filter(c => c.unreadCount > 0 && c.lastMessage)
          .map(async (c) => {
            // Fetch the last message to see who sent it
            const msgs = await messageService.getMessages(c.$id);
            const lastMsg = msgs.documents[msgs.documents.length - 1];
            
            if (!lastMsg || lastMsg.senderId === user.$id) return null;

            const otherId = c.members.find(id => id !== user.$id) || "unknown";
            return {
              $id: `chat_${c.$id}`,
              conversationId: c.$id,
              type: "chat",
              actorId: otherId,
              actorName: userMap[otherId] || "Someone",
              content: c.lastMessage,
              $createdAt: c.lastMessageAt,
              isRead: false
            };
          });

        const chatNotifsResolved = await Promise.all(chatNotifsPromises);
        const chatNotifs = chatNotifsResolved.filter(n => n !== null);

        const merged = [...regularNotifs, ...chatNotifs].sort((a, b) => 
          new Date(b.$createdAt) - new Date(a.$createdAt)
        );

        setNotifications(merged);

        // Mark regular notifications as read after 2 seconds
        if (regularNotifs.some(n => !n.isRead)) {
          setTimeout(() => {
            if (active) notificationService.markAllAsRead(user.$id);
          }, 2000);
        }
      } catch (error) {
        console.error("Failed to load notifications:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAllNotifications();

    // Subscribe to realtime notifications
    const unsubNotifs = notificationService.subscribeToNotifications(user.$id, () => {
      loadAllNotifications();
    });

    // Subscribe to realtime conversations (chats)
    const unsubChats = messageService.subscribeToConversations(user.$id, () => {
      loadAllNotifications();
    });

    return () => {
      active = false;
      unsubNotifs();
      unsubChats();
    };
  }, [user, navigate]);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm("Delete this notification?");
    if (!ok) return;

    try {
      await notificationService.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.$id !== id));
      setMenuOpenId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    const ok = await confirm("Clear all notifications?");
    if (!ok) return;

    try {
      await notificationService.deleteAllNotifications(user.$id);
      setNotifications([]);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-500 border-t-white"></div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        eyebrow="Notifications"
        title="All caught up!"
        description="When someone interacts with your posts or follows you, it will show up here."
        actionLabel="Go to feed"
        actionTo="/"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <section className="rounded-[28px] border border-white/10 bg-[#121212]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
            <BellIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl text-white">Alerts</h1>
            <p className="text-sm text-zinc-400">Activity on your account</p>
          </div>
          <button
            onClick={handleClearAll}
            className="ml-auto rounded-full bg-white/5 px-4 py-2 text-xs font-bold text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            Clear All
          </button>
        </div>
      </section>

      {/* NOTIFICATIONS LIST */}
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[#121212]/90 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl">
        {notifications.map((notif) => {
          let Icon = BellIcon;
          let color = "text-white";
          let actionText = "interacted with your post";
          let link = "/";

          if (notif.type === "like") {
            Icon = HeartIcon;
            color = "text-rose-500";
            actionText = "liked your post.";
            link = `/post/${notif.postSlug || notif.postId}`;
          } else if (notif.type === "comment") {
            Icon = CommentIcon;
            color = "text-blue-400";
            actionText = "commented on your post.";
            link = `/post/${notif.postSlug || notif.postId}?scroll=comments`;
          } else if (notif.type === "follow") {
            Icon = UserIcon;
            color = "text-green-400";
            actionText = "started following you.";
            link = `/profile/${notif.actorId}`;
          } else if (notif.type === "chat") {
            Icon = MessageIcon;
            color = "text-blue-500";
            actionText = "sent you a message.";
            link = `/messages/${notif.conversationId}`;
          }

          return (
            <Link
              key={notif.$id}
              to={link}
              className={`flex items-start gap-4 border-b border-white/5 p-5 transition hover:bg-white/5 ${
                !notif.isRead ? "bg-white/[0.03]" : ""
              }`}
            >
              <div className="relative mt-1">
                <Avatar name={notif.actorName} size="md" />
                <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black ${color}`}>
                  <Icon className="h-3 w-3" filled />
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  <span className="font-semibold text-white">
                    {notif.actorName}
                  </span>{" "}
                  {actionText}
                </p>

                {(notif.type === "comment" || notif.type === "chat") && notif.content && (
                  <div className="mt-2 rounded-2xl border border-white/5 bg-white/5 p-3">
                    <p className="line-clamp-2 text-xs text-zinc-400 italic">
                      {notif.type === "chat" && notif.content === "🚫 This message was deleted" 
                        ? "🚫 This message was deleted"
                        : `"${notif.content}"`
                      }
                    </p>
                  </div>
                )}

                <p className="mt-2 text-[10px] text-zinc-500 uppercase tracking-wider">
                  {formatRelativeTime(notif.$createdAt)}
                </p>
              </div>

              {!notif.isRead && (
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
              )}

              {/* ACTION MENU (For regular notifications) */}
              {!notif.$id.startsWith("chat_") && (
                <div className="relative ml-2 flex items-center self-center">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === notif.$id ? null : notif.$id);
                    }}
                    className="p-2 rounded-full hover:bg-white/10 text-zinc-500 transition"
                  >
                    <DotsIcon className="h-4 w-4" />
                  </button>

                  {menuOpenId === notif.$id && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-32 rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-2xl animate-in fade-in zoom-in-95">
                      <button
                        onClick={(e) => handleDelete(e, notif.$id)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 transition"
                      >
                        <TrashIcon className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
