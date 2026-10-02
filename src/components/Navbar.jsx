import { useSelector } from "react-redux";
import { Link, NavLink } from "react-router-dom";
import Avatar from "./Avatar";
import LogoutBtn from "./LogoutBtn";
import {
  HeartIcon,
  MessageIcon,
  PlusSquareIcon,
  BellIcon,
  ShieldIcon,
  UserIcon,
} from "./ui/Icons";
import { getHandle } from "../lib/ui";
import notificationService from "../services/notification";
import messageService from "../services/message";
import { useEffect, useRef, useState } from "react";

function ActionLink({ to, label, icon, badge = 0, className = "" }) {
  const Icon = icon;

  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        `relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
          isActive
            ? "border-white/20 bg-zinc-100 !text-zinc-950"
            : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:text-white"
        } ${className}`
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

/**
 * Popover menu that closes on outside click and Escape. Shared by the profile menu and
 * the mobile overflow so both behave identically.
 */
function Menu({ open, onClose, align = "right", className = "", children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    }
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className={`absolute top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-xl ${
        align === "right" ? "right-0" : "left-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function MenuItem({ to, icon: Icon, label, onSelect }) {
  const body = (
    <>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </>
  );
  const cls =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-200 transition hover:bg-white/5";

  if (to) {
    return (
      <Link to={to} role="menuitem" className={cls} onClick={onSelect}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" className={cls} onClick={onSelect}>
      {body}
    </button>
  );
}

export default function Navbar() {
  const user = useSelector((state) => state.auth.userData);
  const isAdmin = useSelector((state) => state.auth.isAdmin);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!user) return undefined;

    async function checkNotifications() {
      const [notifCount, unreadChats] = await Promise.all([
        notificationService.countUnread(user.$id),
        messageService.getUnreadInbox(user.$id),
      ]);

      setUnreadCount(notifCount + unreadChats.length);
    }

    checkNotifications();

    // Realtime keeps this fresh without polling.
    const unsubNotifs = notificationService.subscribeToNotifications(user.$id, checkNotifications);
    const unsubChats = messageService.subscribeToConversations(user.$id, checkNotifications);

    return () => {
      unsubNotifs();
      unsubChats();
    };
  }, [user]);

  const closeMenus = () => setProfileOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/72 backdrop-blur-xl">
      {/* min-w-0 + overflow guards keep the right-hand group from ever clipping. */}
      <div className="mx-auto flex min-w-0 max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-5">
        <Link
          to="/"
          onClick={(e) => {
            if (window.location.pathname === "/") {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          className="flex min-w-0 shrink items-center gap-3 transition-transform hover:scale-105 active:scale-95"
        >
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-black shadow-lg shadow-rose-500/20 ring-1 ring-white/10">
            <img src="/GoodPost.svg" alt="logo" className="h-full w-full object-cover" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="font-display text-lg font-amatic tracking-wide text-white">GoodPost</p>
            <p className="hidden text-xs text-zinc-500 sm:block">Clear View</p>
          </div>
        </Link>

        {user ? (
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            {/*
              Four actions total. Admin is an operator role, not everyday navigation, so it
              lives in the profile menu instead of consuming a permanent slot — five actions
              is what pushed the Messages icon off-screen on 320-390px phones. Favorites
              moves into the profile menu on small screens rather than a second popover.
            */}
            <ActionLink to="/create" label="Create post" icon={PlusSquareIcon} />
            <ActionLink to="/favorites" label="Favorites" icon={HeartIcon} className="hidden xs:flex" />
            <ActionLink to="/notifications" label="Notifications" icon={BellIcon} badge={unreadCount} />
            <ActionLink to="/messages" label="Messages" icon={MessageIcon} />

            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((open) => !open)}
                className="flex shrink-0 items-center gap-3 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white md:pr-3"
              >
                <Avatar name={user.name} userId={user.$id} size="sm" />
                <div className="hidden min-w-0 pr-1 text-left md:block">
                  <p className="truncate font-medium text-white">{getHandle(user.name)}</p>
                  <p className="text-xs text-zinc-500">Profile</p>
                </div>
              </button>

              <Menu open={profileOpen} onClose={closeMenus}>
                <div className="border-b border-white/5 px-3 pb-2.5 pt-2">
                  <p className="truncate text-sm font-medium text-white">{getHandle(user.name)}</p>
                  <p className="truncate text-xs text-zinc-500">{user.email}</p>
                </div>
                <MenuItem to="/profile" icon={UserIcon} label="Profile" onSelect={closeMenus} />
                <MenuItem to="/favorites" icon={HeartIcon} label="Favorites" onSelect={closeMenus} />
                {isAdmin ? (
                  <MenuItem to="/admin" icon={ShieldIcon} label="Admin" onSelect={closeMenus} />
                ) : null}
                <div className="mt-1 border-t border-white/5 pt-1.5 md:hidden">
                  <LogoutBtn className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-rose-300 transition hover:bg-rose-500/10" />
                </div>
              </Menu>
            </div>

            <div className="hidden md:block">
              <LogoutBtn />
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
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
