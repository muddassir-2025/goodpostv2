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

  // Simple sort by latest
  const sortedComments = [...comments].sort(
    (a, b) => new Date(b.$createdAt) - new Date(a.$createdAt)
  );

  return (
    <div className="mt-12 mb-24 max-w-[850px]">
      <div className="mb-6 flex items-center gap-8">
        <h3 className="text-[20px] font-bold text-white tracking-tight">
          {comments.length} Comments
        </h3>
        <button className="flex items-center gap-2 text-[14px] font-bold text-white hover:bg-white/5 px-3 py-2 rounded-lg transition">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
          </svg>
          Sort by
        </button>
      </div>

      {/* PRIMARY INPUT AREA */}
      <div className="flex gap-4 mb-10">
        <div className="flex-shrink-0">
          <Avatar name="User" size="sm" />
        </div>
        <div className="flex-1 group">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Add a comment..."
            className="w-full bg-transparent border-b-2 border-zinc-800 py-2 text-[15px] text-white outline-none focus:border-white transition-colors duration-500 placeholder:text-zinc-500"
          />
          <div className={`flex justify-end gap-3 mt-4 transition-all duration-300 transform ${value.trim() ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none'}`}>
            <button onClick={() => onChange("")} className="text-[13px] font-bold text-white px-5 py-2.5 hover:bg-white/10 rounded-full transition">Cancel</button>
            <button 
              onClick={() => onSubmit(value)} 
              className="text-[13px] font-bold text-black bg-blue-400 px-6 py-2.5 rounded-full hover:bg-blue-300 transition shadow-lg active:scale-95"
            >
              Comment
            </button>
          </div>
        </div>
      </div>

      {/* FLAT LIST */}
      <div className="space-y-8">
        {sortedComments.length > 0 ? (
          sortedComments.map((comment) => (
            <div key={comment.$id} className="group animate-in fade-in slide-in-from-top-1 duration-500">
              <div className="flex gap-3 sm:gap-4">
                <div className="flex-shrink-0">
                  <Avatar name={comment.userName} size="sm" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-bold text-white">
                      {getHandle(comment.userName)}
                    </span>
                    <span className="text-[12px] text-zinc-500">
                      {formatRelativeTime(comment.$createdAt)}
                    </span>
                  </div>

                  {editingId === comment.$id ? (
                    <div className="mt-2 space-y-3">
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={(e) => onEditChange(e.target.value)}
                        className="w-full bg-transparent border-b-2 border-zinc-700 py-1 text-[14px] text-white outline-none focus:border-blue-500 transition-colors"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={onEditCancel} className="text-[12px] font-bold text-white px-4 py-2 hover:bg-white/10 rounded-full transition">Cancel</button>
                        <button onClick={onEditSave} className="text-[12px] font-bold text-black bg-blue-400 px-4 py-2 rounded-full hover:bg-blue-300 transition">Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[14px] leading-[1.5] text-zinc-200 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  )}

                  {/* FLAT ACTIONS (Only Edit/Delete) */}
                  {(currentUserId === comment.userId || isAdmin) && !editingId && (
                    <div className="flex gap-4 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEditStart(comment)} className="text-[12px] font-bold text-zinc-500 hover:text-zinc-300">Edit</button>
                      <button onClick={() => onDelete(comment.$id)} className="text-[12px] font-bold text-zinc-500 hover:text-rose-400">Delete</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-zinc-500 py-12 text-sm">No comments yet.</p>
        )}
      </div>
    </div>
  );
}
