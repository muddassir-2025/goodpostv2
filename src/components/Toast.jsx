import { useSelector } from "react-redux";
import { useEffect, useState } from "react";

export default function Toast() {
  const { toast } = useSelector((state) => state.confirm);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Deferred in both directions so we never setState synchronously during commit.
    // The 300ms delay keeps the element mounted while it fades out.
    const timer = setTimeout(() => setVisible(toast.open), toast.open ? 0 : 300);
    return () => clearTimeout(timer);
  }, [toast.open]);

  if (!visible && !toast.open) return null;

  const typeStyles = {
    info: "border-white/10 bg-zinc-900/90 text-white",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
    error: "border-rose-500/20 bg-rose-500/10 text-rose-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  };

  return (
    <div
      className={`fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 transition-all duration-300 ${
        toast.open ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"
      }`}
    >
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
          typeStyles[toast.type] || typeStyles.info
        }`}
      >
        <p className="text-xs font-medium tracking-wide whitespace-nowrap">
          {toast.message}
        </p>
      </div>
    </div>
  );
}
