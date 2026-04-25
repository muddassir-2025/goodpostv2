import { useSelector } from "react-redux";
import { Link, NavLink } from "react-router-dom";
import Avatar from "./Avatar";
import LogoutBtn from "./LogoutBtn";
import { HeartIcon, MessageIcon, PlusSquareIcon, BellIcon } from "./ui/Icons";
import { getHandle } from "../lib/ui";
import notificationService from "../appwrite/notification";
import messageService from "../appwrite/message";
import { useEffect, useState } from "react";

function ActionLink({ to, label, icon, badge = 0 }) {
  const Icon = icon;

  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        `flex h-11 w-11 items-center justify-center rounded-full border transition relative ${
          isActive
            ? "border-white/20 bg-zinc-100 !text-zinc-950"
            : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-5 w-5" filled={isActive} />
          {badge > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-black">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Navbar() {
  const user = useSelector((state) => state.auth.userData);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    async function checkNotifications() {
      const [notifCount, convRes] = await Promise.all([
        notificationService.countUnread(user.$id),
        messageService.getConversations(user.$id)
      ]);
      
      const convDocs = convRes?.documents || [];
      const unreadChatPromises = convDocs
        .filter(c => c.unreadCount > 0 && c.lastMessage)
        .map(async (c) => {
          const msgs = await messageService.getMessages(c.$id, 1);
          const lastMsg = msgs.documents[0];
          return lastMsg && lastMsg.senderId !== user.$id;
        });

      const results = await Promise.all(unreadChatPromises);
      const unreadChats = results.filter(Boolean).length;

      setUnreadCount(notifCount + unreadChats);
    }

    checkNotifications();

    // Switch from polling to Realtime for zero-waste bandwidth
    const unsubNotifs = notificationService.subscribeToNotifications(user.$id, checkNotifications);
    const unsubChats = messageService.subscribeToConversations(user.$id, checkNotifications);

    return () => {
      unsubNotifs();
      unsubChats();
    };
  }, [user]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/72 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-3 py-3 sm:px-5">
        <Link 
          to="/" 
          onClick={(e) => {
            if (window.location.pathname === "/") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="flex items-center gap-3 transition-transform hover:scale-105 active:scale-95"
        >
        <div className="h-11 w-11 overflow-hidden rounded-2xl bg-black shadow-lg shadow-rose-500/20 ring-1 ring-white/10">
  <img
    src="/GoodPost.svg"
    alt="logo"
    className="h-full w-full object-cover"
  />
</div>
          <div>
            <p className="font-display text-lg font-amatic tracking-wide text-white">GoodPost</p>
            <p className="hidden text-xs text-zinc-500 sm:block">Clear View</p>
          </div>
        </Link>

        {user ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <ActionLink to="/create" label="Create post" icon={PlusSquareIcon} />
            <ActionLink to="/favorites" label="Favorites" icon={HeartIcon} />
            <ActionLink to="/notifications" label="Notifications" icon={BellIcon} badge={unreadCount} />
            <ActionLink to="/messages" label="Messages" icon={MessageIcon} />

            <Link
              to="/profile"
              className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white md:flex"
            >
              <Avatar name={user.name} userId={user.$id} size="sm" />
              <div className="pr-2">
                <p className="font-medium text-white">{getHandle(user.name)}</p>
                <p className="text-xs text-zinc-500">Profile</p>
              </div>
            </Link>

            <div className="hidden md:block">
              <LogoutBtn />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 hover:!text-zinc-950"
            >
              Join now
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
