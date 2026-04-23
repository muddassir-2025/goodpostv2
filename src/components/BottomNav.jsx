import { NavLink } from "react-router-dom";
import {
  HeartIcon,
  HomeIcon,
  ReelsIcon,
  SearchIcon,
  UserIcon,
  BellIcon,
} from "./ui/Icons";

const items = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/search", label: "Search", icon: SearchIcon },
  { to: "/feed", label: "Following", icon: ReelsIcon },
  { to: "/favorites", label: "Saved", icon: HeartIcon },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-[540px] items-center justify-between rounded-full border border-white/10 bg-[#121212]/95 px-2 py-2 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        {items.map((item) => {
          const IconComponent = item.icon;

          return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-w-[62px] flex-col items-center gap-1 rounded-full px-3 py-2 text-[11px] font-medium transition ${
                isActive ? "bg-zinc-100 !text-zinc-950" : "text-zinc-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <IconComponent className="h-5 w-5" filled={isActive} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
