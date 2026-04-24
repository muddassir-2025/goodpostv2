import { useState } from "react";
import { 
  XIcon, 
  CopyIcon, 
  CheckIcon,
  TwitterIcon,
  WhatsappIcon,
  FacebookIcon
} from "./ui/Icons";
import { getFileUrl } from "../lib/ui";

export default function ShareModal({ post, onClose }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = window.location.href;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const socialLinks = [
    {
      name: "Twitter",
      icon: TwitterIcon,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`,
      color: "hover:bg-sky-500/10 hover:text-sky-400"
    },
    {
      name: "WhatsApp",
      icon: WhatsappIcon,
      url: `https://wa.me/?text=${encodeURIComponent(post.title + " " + shareUrl)}`,
      color: "hover:bg-emerald-500/10 hover:text-emerald-400"
    },
    {
      name: "Facebook",
      icon: FacebookIcon,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      color: "hover:bg-blue-500/10 hover:text-blue-400"
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-[#121212] shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/5 p-5">
          <h2 className="text-lg font-bold text-white">Share Post</h2>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* POST PREVIEW CARD */}
        <div className="p-6">
          <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="flex gap-4 p-4">
              {post.featuredImg ? (
                <img 
                  src={getFileUrl(post.featuredImg)} 
                  alt="" 
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 text-xs font-bold text-white">
                  Post
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {post.authorName}'s post
                </p>
                <h3 className="mt-1 truncate font-display text-lg text-white">
                  {post.title}
                </h3>
                <p className="mt-1 truncate text-xs text-zinc-400">
                  {post.content}
                </p>
              </div>
            </div>
          </div>

          {/* SOCIAL ACTIONS */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] py-4 text-zinc-400 transition ${social.color}`}
              >
                <social.icon className="h-6 w-6" />
                <span className="text-[11px] font-medium">{social.name}</span>
              </a>
            ))}
          </div>

          {/* COPY LINK */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Copy Link
            </p>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 p-1.5 focus-within:border-white/20 transition">
              <input 
                type="text" 
                readOnly 
                value={shareUrl}
                className="flex-1 bg-transparent px-3 text-xs text-zinc-400 outline-none"
              />
              <button
                onClick={handleCopy}
                className={`flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
                  copied 
                    ? "bg-emerald-500 text-white" 
                    : "bg-white text-black hover:bg-zinc-200"
                }`}
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <CopyIcon className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
