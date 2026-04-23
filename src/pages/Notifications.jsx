import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import notificationService from "../appwrite/notification";
import { formatRelativeTime } from "../lib/ui";
import { BellIcon, HeartIcon, CommentIcon, UserIcon } from "../components/ui/Icons";

export default function Notifications() {
  const user = useSelector((state) => state.auth.userData);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    async function loadNotifications() {
      try {
        const res = await notificationService.getUserNotifications(user.$id);
        setNotifications(res?.documents || []);

        // Mark as read after 2 seconds of opening the page
        setTimeout(() => {
          notificationService.markAllAsRead(user.$id);
        }, 2000);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [user, navigate]);

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
            link = `/post/${notif.postId}`; // Assuming postId works or can find the slug
          } else if (notif.type === "comment") {
            Icon = CommentIcon;
            color = "text-blue-400";
            actionText = "commented on your post.";
            link = `/post/${notif.postId}`;
          } else if (notif.type === "follow") {
            Icon = UserIcon;
            color = "text-green-400";
            actionText = "started following you.";
            link = `/profile/${notif.actorId}`;
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
                <Avatar name={notif.actorId} size="md" />
                <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black ${color}`}>
                  <Icon className="h-3 w-3" filled />
                </div>
              </div>

              <div className="flex-1">
                <p className="text-sm text-zinc-300">
                  <span className="font-semibold text-white">Someone</span> {actionText}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatRelativeTime(notif.$createdAt)}
                </p>
              </div>

              {!notif.isRead && (
                <div className="mt-2 h-2 w-2 rounded-full bg-blue-500"></div>
              )}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
