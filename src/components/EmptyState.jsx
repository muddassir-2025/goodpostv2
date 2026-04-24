import { Link } from "react-router-dom";

export default function EmptyState({
  eyebrow = "Nothing here yet",
  title,
  description,
  actionLabel,
  actionTo,
  actionState,
}) {
  return (
    <section className="rounded-[30px] border border-dashed border-white/10 bg-[#121212]/80 px-6 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{eyebrow}</p>
      <h2 className="font-display mt-4 text-2xl text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">{description}</p>
      {actionLabel && actionTo ? (
        <Link
          to={actionTo}
          state={actionState}
          className="mt-6 inline-flex rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold !text-zinc-950 transition hover:bg-zinc-200 hover:!text-zinc-950"
        >
          {actionLabel}
        </Link>
      ) : null}

    </section>
  );
}
