import { Link } from "react-router-dom";
import Avatar from "./Avatar";

export default function StoryBar({ stories = [] }) {
  if (!stories.length) return null;

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#121212]/88 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Stories</p>
          <h2 className="font-display text-lg text-white">True_Circle</h2>
        </div>
        <p className="text-xs text-zinc-500">Tap to peek</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 pt-1">
        {stories.map((story) => (
          <Link
            key={story.id}
            to={story.href}
            className="group flex min-w-[76px] flex-col items-center gap-2 text-center"
          >
            <Avatar
              name={story.name}
              src={story.cover}
              size="lg"
              ring
              showAdd={story.isOwn}
            />
            <span className="max-w-[76px] truncate text-xs text-zinc-300 group-hover:text-white">
              {story.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}