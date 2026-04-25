import { Link } from "react-router-dom";

export default function AuthShell({
  eyebrow,
  title,
  description,
  footerText,
  footerLink,
  footerLabel,
  children,
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,111,77,0.2),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(255,0,153,0.16),_transparent_32%),linear-gradient(180deg,#050505_0%,#000_55%,#050505_100%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="hidden rounded-[36px] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:block">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">{eyebrow}</p>
          <h1 className="font-display mt-6 text-5xl leading-tight text-white">
            Share your life with a feed that feels alive.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-zinc-400">
            A modern social UI built around rich posts, smooth interactions, and a
            dark visual language that keeps the focus on the content.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
              <p className="text-sm font-semibold text-white">Upload-ready</p>
              <p className="mt-2 text-sm text-zinc-500">
                Preview images and audio before anything hits Appwrite.
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-black/30 p-5">
              <p className="text-sm font-semibold text-white">Mobile first</p>
              <p className="mt-2 text-sm text-zinc-500">
                Sticky nav, centered feed, and crisp spacing across screen sizes.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-[#121212]/92 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">{eyebrow}</p>
          <h2 className="font-display mt-4 text-3xl text-white">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-sm text-zinc-500">
            {footerText}{" "}
            <Link to={footerLink} className="font-semibold text-white transition hover:text-zinc-300">
              {footerLabel}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
