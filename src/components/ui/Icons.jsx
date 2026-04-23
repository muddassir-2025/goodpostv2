function svgProps(className) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
  };
}

export function HomeIcon({ className = "", filled = false }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 3.8 3.7 10.2a1 1 0 0 0-.4.8V20a1 1 0 0 0 1 1h5.4a1 1 0 0 0 1-1v-4.6a1 1 0 0 1 1-1h.6a1 1 0 0 1 1 1V20a1 1 0 0 0 1 1h5.4a1 1 0 0 0 1-1v-9a1 1 0 0 0-.4-.8L12 3.8Z" />
      </svg>
    );
  }

  return (
    <svg {...svgProps(className)}>
      <path d="M4 10.8 12 4l8 6.8" />
      <path d="M6 9.8V20h4.8v-4.4h2.4V20H18V9.8" />
    </svg>
  );
}

export function SearchIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function ReelsIcon({ className = "", filled = false }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm2.8 4.2h-3v2h4.7l-1.7-2Zm4.3 0H12l1.7 2h2.1l-1.7-2Zm2.5 5.2-5.2 3.2a.8.8 0 0 1-1.2-.7V11.1a.8.8 0 0 1 1.2-.7l5.2 3.1a.8.8 0 0 1 0 1.4Z" />
      </svg>
    );
  }

  return (
    <svg {...svgProps(className)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M3.8 8.7h16.4" />
      <path d="m8 3.8 3.1 4.9" />
      <path d="m13 3.8 3.1 4.9" />
      <path d="m10 11.3 5.1 3.2-5.1 3.2v-6.4Z" />
    </svg>
  );
}

export function HeartIcon({ className = "", filled = false }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 20.2c-.3 0-.7-.1-.9-.4-3-2.4-5.6-4.7-7.2-6.8C2 10.7 2.2 7.3 4.7 5.1a4.9 4.9 0 0 1 6.6.2L12 6l.7-.7a4.9 4.9 0 0 1 6.6-.2c2.5 2.2 2.7 5.6.8 7.9-1.6 2.1-4.2 4.4-7.2 6.8-.2.3-.6.4-.9.4Z" />
      </svg>
    );
  }

  return (
    <svg {...svgProps(className)}>
      <path d="M12 20.2c-.3 0-.7-.1-.9-.4-3-2.4-5.6-4.7-7.2-6.8C2 10.7 2.2 7.3 4.7 5.1a4.9 4.9 0 0 1 6.6.2L12 6l.7-.7a4.9 4.9 0 0 1 6.6-.2c2.5 2.2 2.7 5.6.8 7.9-1.6 2.1-4.2 4.4-7.2 6.8-.2.3-.6.4-.9.4Z" />
    </svg>
  );
}

export function BookmarkIcon({ className = "", filled = false }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M7 3.5h10A2.5 2.5 0 0 1 19.5 6v14.2a.3.3 0 0 1-.5.2L12 15.1l-7 5.3a.3.3 0 0 1-.5-.2V6A2.5 2.5 0 0 1 7 3.5Z" />
      </svg>
    );
  }

  return (
    <svg {...svgProps(className)}>
      <path d="M6.5 5.5A2.5 2.5 0 0 1 9 3h6a2.5 2.5 0 0 1 2.5 2.5V21l-5.5-4.2L6.5 21V5.5Z" />
    </svg>
  );
}

export function MessageIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <path d="m20 5-8.5 8.2a1 1 0 0 1-1.2.2L4 10.5 20 5Z" />
      <path d="m20 5-3.9 13.1a.8.8 0 0 1-1.3.4l-3.4-2.9a1 1 0 0 0-1.2-.1L7.3 17" />
    </svg>
  );
}

export function PlusSquareIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function UserIcon({ className = "", filled = false }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 12.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Zm0 2.4c-4.7 0-8.5 2.4-8.5 5.4a.6.6 0 0 0 .6.6h15.8a.6.6 0 0 0 .6-.6c0-3-3.8-5.4-8.5-5.4Z" />
      </svg>
    );
  }

  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M5 19.5c1.7-3 4.1-4.5 7-4.5s5.3 1.5 7 4.5" />
    </svg>
  );
}

export function DotsIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CommentIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M6 17.3 4.5 20l3.5-1.4h9A3.5 3.5 0 0 0 20.5 15V7.5A3.5 3.5 0 0 0 17 4H7A3.5 3.5 0 0 0 3.5 7.5v6A3.7 3.7 0 0 0 6 17.3Z" />
    </svg>
  );
}

export function ShareIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <path d="m20 4-8.4 14.3a.6.6 0 0 1-1.1-.1L8.8 13 4 11.1A.6.6 0 0 1 4 10l15.2-6.5a.6.6 0 0 1 .8.7Z" />
      <path d="m8.8 13 4.1-4.1" />
    </svg>
  );
}

export function CloseIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

export function EditIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <path d="m4 20 4.2-.8L18.5 8.9a1.8 1.8 0 0 0 0-2.5l-.9-.9a1.8 1.8 0 0 0-2.5 0L4.8 15.8 4 20Z" />
      <path d="m13.8 6.8 3.4 3.4" />
    </svg>
  );
}

export function TrashIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8v1.7" />
      <path d="m7 6.5.8 11.2A1.5 1.5 0 0 0 9.3 19h5.4a1.5 1.5 0 0 0 1.5-1.3L17 6.5" />
      <path d="M10 10.2v5.3" />
      <path d="M14 10.2v5.3" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <path d="m14.5 5.5-6 6 6 6" />
      <path d="M8.5 11.5H20" />
    </svg>
  );
}

export function ImageIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3.5" y="4" width="17" height="16" rx="3.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m5.5 17 4.1-4.1a1.5 1.5 0 0 1 2.1 0l1.5 1.5a1.5 1.5 0 0 0 2.1 0l3.2-3.2" />
    </svg>
  );
}

export function AudioIcon({ className = "" }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M9 18a2.5 2.5 0 1 1-2.5-2.5c.4 0 .8.1 1.2.3V7.5l9-1.8v9.8A2.5 2.5 0 1 1 14.2 13c.4 0 .8.1 1.2.3V7.2L9 8.5V18Z" />
    </svg>
  );
}

export function BellIcon({ className = "", filled = false }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
      </svg>
    );
  }

  return (
    <svg {...svgProps(className)}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
