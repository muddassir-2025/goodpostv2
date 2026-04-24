import { useState, useMemo } from "react";
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
  const [replyToId, setReplyToId] = useState(null);
  const [replyValue, setReplyValue] = useState("");
  const [expandedReplies, setExpandedReplies] = useState({});

  // 🌳 BUILD FLAT-NESTED TREE (YouTube Style)
  const commentTree = useMemo(() => {
    const map = {};
    const roots = [];
    comments.forEach(c => map[c.$id] = { ...c, replies: [] });
    comments.forEach(c => {
      if (c.parentId) {
        let currentParentId = c.parentId;
        let rootParent = map[currentParentId];
        while (rootParent && rootParent.parentId) rootParent = map[rootParent.parentId];
        if (rootParent) rootParent.replies.push(map[c.$id]);
        else if (map[c.parentId]) map[c.parentId].replies.push(map[c.$id]);
      } else roots.push(map[c.$id]);
    });
    return roots.sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt));
  }, [comments]);

  const toggleReplies = (commentId) => {
    setExpandedReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const handleReplySubmit = (parentId) => {
    if (!replyValue.trim()) return;
    onSubmit(replyValue, parentId);
    setReplyValue("");
    setReplyToId(null);
    setExpandedReplies(prev => ({ ...prev, [parentId]: true }));
  };

  const CommentItem = ({ comment, isReply = false }) => {
    const isEditing = editingId === comment.$id;
    const isReplying = replyToId === comment.$id;
    const hasReplies = comment.replies?.length > 0;
    const isExpanded = expandedReplies[comment.$id];

    return (
      <div className={`transition-all duration-500 ease-out animate-in fade-in slide-in-from-top-1 ${isReply ? 'mt-4' : 'mt-6'}`}>
        <div className="flex gap-3 sm:gap-4">
          <div className="flex-shrink-0">
            <Avatar name={comment.userName} size={isReply ? "xs" : "sm"} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-bold text-white hover:underline cursor-pointer">
                {getHandle(comment.userName)}
              </span>
              <span className="text-[12px] text-zinc-500">
                {formatRelativeTime(comment.$createdAt)}
              </span>
            </div>

            {isEditing ? (
              <div className="mt-2 space-y-3">
                <textarea
                  autoFocus
                  value={editValue}
                  onChange={(e) => onEditChange(e.target.value)}
                  className="w-full bg-transparent border-b-2 border-zinc-700 py-1 text-[14px] text-white outline-none focus:border-blue-500 transition-colors duration-300"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={onEditCancel} className="text-[12px] font-bold text-white px-4 py-2 hover:bg-white/10 rounded-full transition">Cancel</button>
                  <button onClick={onEditSave} className="text-[12px] font-bold text-black bg-blue-400 px-4 py-2 rounded-full hover:bg-blue-300 transition shadow-lg">Save</button>
                </div>
              </div>
            ) : (
              <p className="text-[14px] leading-[1.5] text-zinc-200 whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            )}

            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={() => {
                  setReplyToId(isReplying ? null : comment.$id);
                  setReplyValue("");
                }}
                className={`text-[12px] font-bold transition-colors ${isReplying ? 'text-blue-400' : 'text-zinc-400 hover:text-white'}`}
              >
                Reply
              </button>
              {(currentUserId === comment.userId || isAdmin) && (
                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button onClick={() => onEditStart(comment)} className="text-[12px] font-bold text-zinc-500 hover:text-zinc-300">Edit</button>
                  <button onClick={() => onDelete(comment.$id)} className="text-[12px] font-bold text-zinc-500 hover:text-rose-400">Delete</button>
                </div>
              )}
            </div>

            {/* SMOOTH REPLY INPUT */}
            <div className={`grid transition-all duration-300 ease-in-out ${isReplying ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="flex gap-3">
                  <Avatar name="User" size="xs" />
                  <div className="flex-1">
                    <input
                      autoFocus
                      value={replyValue}
                      onChange={(e) => setReplyValue(e.target.value)}
                      placeholder="Add a reply..."
                      className="w-full bg-transparent border-b-2 border-zinc-800 py-1 text-[14px] text-white outline-none focus:border-white transition-colors duration-300"
                    />
                    <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setReplyToId(null)} className="text-[12px] font-bold text-white px-4 py-2 hover:bg-white/10 rounded-full transition">Cancel</button>
                      <button 
                        onClick={() => handleReplySubmit(comment.$id)} 
                        disabled={!replyValue.trim()}
                        className="text-[12px] font-bold text-black bg-blue-500 px-4 py-2 rounded-full disabled:bg-zinc-800 disabled:text-zinc-500 transition-all"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SMOOTH REPLIES TOGGLE */}
            {hasReplies && !isReply && (
              <div className="mt-2">
                <button
                  onClick={() => toggleReplies(comment.$id)}
                  className="flex items-center gap-3 text-[14px] font-bold text-blue-400 hover:bg-blue-400/10 px-3 py-2 rounded-full transition-all -ml-3 group/btn"
                >
                  <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <span>{isExpanded ? 'Hide' : `View ${comment.replies.length} replies`}</span>
                </button>

                <div className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <div className="space-y-2 border-l-2 border-zinc-800 ml-2 pl-4">
                      {comment.replies.map(reply => (
                        <CommentItem key={reply.$id} comment={reply} isReply />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-12 mb-24 max-w-[850px] mx-auto lg:mx-0">
      <div className="mb-8 flex items-center gap-8">
        <h3 className="text-[22px] font-bold text-white tracking-tight">
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
      <div className="flex gap-4 mb-12">
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
              className="text-[13px] font-bold text-black bg-blue-400 px-6 py-2.5 rounded-full hover:bg-blue-300 transition shadow-lg shadow-blue-500/10 active:scale-95"
            >
              Comment
            </button>
          </div>
        </div>
      </div>

      {/* MAIN LIST WITH SMOOTH STAGGERED ANIMATION */}
      <div className="space-y-2">
        {commentTree.length > 0 ? (
          commentTree.map((comment) => (
            <CommentItem key={comment.$id} comment={comment} />
          ))
        ) : (
          <div className="text-center py-20 animate-pulse">
            <p className="text-zinc-500 text-sm">No comments yet. Be the first to start the conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
