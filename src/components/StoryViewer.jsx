import { useEffect, useState } from "react";
import { getFileUrl, formatRelativeTime } from "../lib/ui";
import { CloseIcon, TrashIcon } from "./ui/Icons";

// How long each story shows before auto-advancing.
const DURATION_MS = 5000;

export default function StoryViewer({ groups = [], startIndex = 0, onClose, onDelete }) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [itemIndex, setItemIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const group = groups[groupIndex];
  const item = group?.items?.[itemIndex];

  useEffect(() => {
    if (!item) return undefined;

    setProgress(0);
    const startedAt = Date.now();
    const tick = setInterval(
      () => setProgress(Math.min(100, ((Date.now() - startedAt) / DURATION_MS) * 100)),
      50,
    );
    const advance = setTimeout(() => {
      if (itemIndex + 1 < group.items.length) {
        setItemIndex((index) => index + 1);
      } else if (groupIndex + 1 < groups.length) {
        setGroupIndex((index) => index + 1);
        setItemIndex(0);
      } else {
        onClose();
      }
    }, DURATION_MS);

    return () => {
      clearInterval(tick);
      clearTimeout(advance);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, itemIndex, groups.length, item?.id]);

  function goPrevious() {
    if (itemIndex > 0) {
      setItemIndex(itemIndex - 1);
    } else if (groupIndex > 0) {
      const previous = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setItemIndex(Math.max(0, (previous?.items?.length || 1) - 1));
    }
  }

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrevious();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, itemIndex]);

  if (!group || !item) return null;

  const handleDelete = async () => {
    await onDelete?.(item.id);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="relative h-full w-full max-w-md overflow-hidden bg-black sm:h-[85vh] sm:rounded-3xl">
        {/* Progress bars */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-3">
          {group.items.map((entry, index) => (
            <div key={entry.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                style={{
                  width:
                    index < itemIndex ? "100%" : index === itemIndex ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute inset-x-0 top-5 z-20 flex items-center gap-3 px-4 pt-3">
          <span className="text-sm font-semibold text-white">{group.name}</span>
          <span className="text-xs text-white/50">{formatRelativeTime(item.createdAt)}</span>

          <div className="ml-auto flex items-center gap-1">
            {group.isOwn && (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Delete story"
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close story"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Media */}
        <img
          src={getFileUrl(item.imageUrl)}
          alt={`${group.name}'s story`}
          className="h-full w-full object-contain"
        />

        {/* Tap zones */}
        <button
          type="button"
          aria-label="Previous story"
          onClick={goPrevious}
          className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-pointer"
        />
        <button
          type="button"
          aria-label="Next story"
          onClick={() => {
            if (itemIndex + 1 < group.items.length) setItemIndex(itemIndex + 1);
            else if (groupIndex + 1 < groups.length) {
              setGroupIndex(groupIndex + 1);
              setItemIndex(0);
            } else onClose();
          }}
          className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-pointer"
        />
      </div>
    </div>
  );
}
