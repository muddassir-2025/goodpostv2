// The React app was written against Appwrite's document shape ($id, $createdAt, ...).
// We keep that shape at the API boundary so the pages/components need no rewrites.

const FIELD_MAPS = {
  posts: {
    id: "$id",
    created_at: "$createdAt",
    updated_at: "$updatedAt",
    author_id: "authorID",
    author_name: "authorName",
    featured_img: "featuredImg",
    audio_id: "audioId",
    video_id: "videoId",
    is_published: "isPublished",
    like_count: "likeCount",
    comment_count: "commentCount",
    is_system: "isSystem",
    report_count: "reportCount",
    reported_by: "reportedBy",
  },
  comments: {
    id: "$id",
    created_at: "$createdAt",
    updated_at: "$updatedAt",
    post_id: "postId",
    user_id: "userId",
    user_name: "userName",
    parent_id: "parentId",
  },
  likes: { id: "$id", created_at: "$createdAt", post_id: "postId", user_id: "userId" },
  favorites: { id: "$id", created_at: "$createdAt", post_id: "postId", user_id: "userId" },
  follows: {
    id: "$id",
    created_at: "$createdAt",
    follower_id: "followerId",
    following_id: "followingId",
  },
  conversations: {
    id: "$id",
    created_at: "$createdAt",
    last_message: "lastMessage",
    last_message_at: "lastMessageAt",
    unread_count: "unreadCount",
  },
  messages: {
    id: "$id",
    created_at: "$createdAt",
    conversation_id: "conversationId",
    sender_id: "senderId",
  },
  notifications: {
    id: "$id",
    created_at: "$createdAt",
    user_id: "userId",
    actor_id: "actorId",
    actor_name: "actorName",
    post_id: "postId",
    post_slug: "postSlug",
    is_read: "isRead",
  },
  stories: {
    id: "$id",
    created_at: "$createdAt",
    user_id: "userId",
    user_name: "userName",
    image_url: "imageUrl",
  },
};

export function serializeRow(table, row) {
  if (!row) return null;
  const map = FIELD_MAPS[table] || {};
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[map[key] || key] = value;
  }
  return out;
}

export function serializeRows(table, rows) {
  return (rows || []).map((row) => serializeRow(table, row));
}

export function listResponse(table, rows, total = null) {
  return {
    total: total ?? (rows?.length || 0),
    documents: serializeRows(table, rows),
  };
}

/** Shape a profile row into the user object the frontend expects. */
export function serializeUser(profile) {
  if (!profile) return null;
  return {
    $id: profile.id,
    id: profile.id,
    name: profile.name,
    email: profile.email,
    isAdmin: Boolean(profile.is_admin),
    prefs: {
      bio: profile.bio || "",
      avatarId: profile.avatar_id || null,
    },
    $createdAt: profile.created_at,
    $updatedAt: profile.updated_at,
  };
}
