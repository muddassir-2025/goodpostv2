import { useState } from "react";
import Avatar from "./Avatar";
import StoryViewer from "./StoryViewer";
import { getFileUrl } from "../lib/ui";
import { PlusSquareIcon } from "./ui/Icons";

/**
 * Horizontal story rail. `groups` is one entry per author (see lib/stories.js); the
 * current user's group is first and gets an "add" affordance.
 */
export default function StoryBar({ groups = [], onAddStory, onDeleteStory }) {
  const [openIndex, setOpenIndex] = useState(null);

  if (!groups.length) return null;

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#121212]/88 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Stories</p>
          <h2 className="font-display text-lg text-white">Fresh in the last 24h</h2>
        </div>
        <p className="text-xs text-zinc-500">Tap to peek</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-3 pt-1">
        {groups.map((group, index) => {
          const cover = group.items[0]?.imageUrl;

          return (
            <div key={group.userId} className="relative flex min-w-[76px] flex-col items-center gap-2 text-center">
              <button
                type="button"
                onClick={() => (group.items.length ? setOpenIndex(index) : onAddStory?.())}
                aria-label={group.isOwn ? "Your story" : `${group.name}'s story`}
                className="flex flex-col items-center gap-2"
              >
                <Avatar
                  name={group.name}
                  userId={group.userId}
                  src={cover ? getFileUrl(cover, { thumb: true }) : ""}
                  size="lg"
                  ring
                />
                <span className="max-w-[76px] truncate text-xs text-zinc-300 hover:text-white">
                  {group.isOwn ? "Your story" : group.name}
                </span>
              </button>

              {group.isOwn && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddStory?.();
                  }}
                  aria-label="Add to your story"
                  className="absolute right-2 top-8 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#121212] bg-blue-500 text-white transition hover:bg-blue-400"
                >
                  <PlusSquareIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {openIndex !== null && groups[openIndex] && (
        <StoryViewer
          groups={groups}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
          onDelete={async (id) => {
            await onDeleteStory?.(id);
            setOpenIndex(null);
          }}
        />
      )}
    </section>
  );
}
