import { getInitials, getStoryGradient, getFileUrl } from "../lib/ui";
import { useSelector } from "react-redux";


const sizeMap = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg",
  xl: "h-20 w-20 text-2xl",
};

export default function Avatar({
  name,
  userId,
  src = "",
  size = "md",
  ring = false,
  showAdd = false,
  className = "",
}) {
  const currentUser = useSelector((s) => s.auth.userData);
  const isMe = userId && currentUser && userId === currentUser.$id;
  
  // Use provided src, or if it's me, use my avatarId from preferences
  const finalSrc = src || (isMe && currentUser.prefs?.avatarId ? getFileUrl(currentUser.prefs.avatarId) : "");

  const gradient = getStoryGradient(name);

  const avatarBody = (
    <div
      className={`relative ${sizeMap[size] || sizeMap.md} overflow-hidden rounded-full border border-white/10 bg-zinc-950 ${className}`}
    >
      {finalSrc ? (
        <img
          src={finalSrc}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (

        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} font-semibold uppercase text-white`}
        >
          {getInitials(name)}
        </div>
      )}

      {showAdd ? (
        <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-black bg-white text-xs font-bold text-black shadow-lg">
          +
        </span>
      ) : null}
    </div>
  );

  if (!ring) {
    return avatarBody;
  }

  return (
    <div className={`inline-flex rounded-full bg-gradient-to-br ${gradient} p-[2px]`}>
      {avatarBody}
    </div>
  );
}
