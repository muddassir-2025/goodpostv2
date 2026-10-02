import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

const GAP = 8; // space between the anchor and the menu
const MARGIN = 8; // minimum distance from the viewport edge

/**
 * Popover anchored to an element but rendered into document.body.
 *
 * Menus placed with `position: absolute` inside a scrollable or `overflow-hidden`
 * ancestor get clipped by it, and a fixed side (always above/below) runs off-screen for
 * items near the edge. This measures the anchor instead, then flips vertically and
 * shifts horizontally so the menu always stays fully visible.
 *
 * Position is written straight to the node rather than through state — this runs on every
 * scroll, and re-rendering the menu on each frame would be wasteful.
 */
export default function FloatingMenu({
  anchorEl,
  open,
  onClose,
  align = "end",
  className = "",
  children,
}) {
  const ref = useRef(null);

  const position = useCallback(() => {
    const anchor = anchorEl?.current || anchorEl;
    const menu = ref.current;
    if (!anchor || !menu) return;

    const rect = anchor.getBoundingClientRect();
    const menuW = menu.offsetWidth || 160;
    const menuH = menu.offsetHeight || 0;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Flip up only when below genuinely does not fit and above is roomier.
    const openUp = spaceBelow < menuH + GAP + MARGIN && spaceAbove > spaceBelow;

    let left = align === "end" ? rect.right - menuW : rect.left;
    left = Math.min(Math.max(MARGIN, left), window.innerWidth - menuW - MARGIN);

    const top = openUp ? rect.top - menuH - GAP : rect.bottom + GAP;

    menu.style.top = `${Math.max(MARGIN, top)}px`;
    menu.style.left = `${left}px`;
    menu.style.width = `${menuW}px`;
    menu.style.visibility = "visible";
  }, [anchorEl, align]);

  // Measure after paint so offsetHeight is real, then reposition on any scroll/resize.
  useLayoutEffect(() => {
    if (!open) return undefined;

    position();
    const raf = requestAnimationFrame(position);

    // Capture phase catches scrolling inside the chat container, not just the window.
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      const anchor = anchorEl?.current || anchorEl;
      if (ref.current?.contains(event.target) || anchor?.contains(event.target)) return;
      onClose();
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
  }, [open, onClose, anchorEl]);

  if (!open) return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      // Hidden until measured, so the first frame never flashes at 0,0.
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden", zIndex: 80 }}
      className={`overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
