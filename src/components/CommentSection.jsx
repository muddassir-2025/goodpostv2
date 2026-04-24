import Avatar from "./Avatar";
import { useSelector } from "react-redux";
import { formatRelativeTime, getHandle } from "../lib/ui";

export default function CommentSection({
  comments = [],
  currentUserId,
  value,
  onChange,
  onSubmit,
  editingId,
  editValue,
  onEditChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  onDelete,
}) {
  const isAdmin = useSelector((state) => state.auth.isAdmin);

  const sortedComments = [...comments].sort(
    (a, b) => new Date(b.$createdAt) - new Date(a.$createdAt)
  );

  return (
    <div className="mt-8 mb-12">
      <div className="mb-6 flex items-center gap-4">
        <h3 className="text-lg font-bold text-white">
          {comments.length} Comments
        </h3>
      </div>

      <div className="flex gap-3 mb-8">
        <Avatar name="User" userId={currentUserId} size="sm" />
        <div className="flex-1">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Add a comment..."
            className="w-full bg-transparent border-b border-zinc-800 py-1.5 text-sm text-white outline-none focus:border-white transition-colors placeholder:text-zinc-500"
          />
          {value.trim() && (
            <div className="flex justify-end gap-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <button onClick={() => onChange("")} className="text-xs font-bold text-white px-3 py-1.5 hover:bg-white/5 rounded-full transition">Cancel</button>
              <button onClick={() => onSubmit(value)} className="text-xs font-bold text-black bg-blue-400 px-4 py-1.5 rounded-full hover:bg-blue-300 transition">Comment</button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {sortedComments.length > 0 ? (
          sortedComments.map((comment) => (
            <div key={comment.$id} className="group flex gap-3 sm:gap-4 animate-in fade-in duration-300">
              <div className="flex-shrink-0">
                <Avatar name={comment.userName} userId={comment.userId} size="sm" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-bold text-white leading-none">
                    {getHandle(comment.userName)}
                  </span>
                  <span className="text-[11px] text-zinc-500 leading-none">
                    {formatRelativeTime(comment.$createdAt)}
                  </span>
                </div>

                {editingId === comment.$id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      autoFocus
                      value={editValue}
                      onChange={(e) => onEditChange(e.target.value)}
                      className="w-full bg-transparent border-b border-zinc-700 py-1 text-sm text-white outline-none focus:border-white transition-colors"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={onEditCancel} className="text-xs font-bold text-white px-3 py-1.5 rounded-full">Cancel</button>
                      <button onClick={onEditSave} className="text-xs font-bold text-black bg-blue-400 px-3 py-1.5 rounded-full">Save</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[14px] leading-[1.4] text-zinc-300 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                )}

                {/* MOBILE FRIENDLY ACTIONS (Always visible or visible on hover) */}
                {(currentUserId === comment.userId || isAdmin) && !editingId && (
                  <div className="flex gap-4 mt-1.5 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEditStart(comment)} className="text-[11px] font-bold text-zinc-500 hover:text-zinc-300 active:text-white">Edit</button>
                    <button onClick={() => onDelete(comment.$id)} className="text-[11px] font-bold text-zinc-500 hover:text-rose-400 active:text-rose-500">Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-zinc-600 py-8 text-xs">No comments yet.</p>
        )}
      </div>
    </div>
  );
}
