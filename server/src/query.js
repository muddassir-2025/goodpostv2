// The frontend builds Appwrite-style queries like:
//   { method: "equal", attribute: "isPublished", values: [true] }
//   { method: "orderDesc", attribute: "$createdAt" }
//   { method: "limit", values: [20] }
// This module turns them into parameterized SQL with a strict column whitelist.

const COLUMNS = {
  posts: {
    $id: "id",
    $createdAt: "created_at",
    $updatedAt: "updated_at",
    authorID: "author_id",
    authorName: "author_name",
    featuredImg: "featured_img",
    audioId: "audio_id",
    videoId: "video_id",
    tags: "tags",
    isPublished: "is_published",
    likeCount: "like_count",
    commentCount: "comment_count",
    isSystem: "is_system",
    reportCount: "report_count",
    reportedBy: "reported_by",
    title: "title",
    content: "content",
    slug: "slug",
  },
  comments: {
    $id: "id",
    $createdAt: "created_at",
    postId: "post_id",
    userId: "user_id",
    userName: "user_name",
    parentId: "parent_id",
  },
  likes: { $id: "id", $createdAt: "created_at", postId: "post_id", userId: "user_id" },
  favorites: { $id: "id", $createdAt: "created_at", postId: "post_id", userId: "user_id" },
  follows: {
    $id: "id",
    $createdAt: "created_at",
    followerId: "follower_id",
    followingId: "following_id",
  },
  conversations: {
    $id: "id",
    $createdAt: "created_at",
    members: "members",
    lastMessage: "last_message",
    lastMessageAt: "last_message_at",
    unreadCount: "unread_count",
  },
  messages: {
    $id: "id",
    $createdAt: "created_at",
    conversationId: "conversation_id",
    senderId: "sender_id",
    text: "text",
    seen: "seen",
  },
  notifications: {
    $id: "id",
    $createdAt: "created_at",
    userId: "user_id",
    actorId: "actor_id",
    actorName: "actor_name",
    type: "type",
    postId: "post_id",
    postSlug: "post_slug",
    isRead: "is_read",
  },
  stories: {
    $id: "id",
    $createdAt: "created_at",
    userId: "user_id",
    userName: "user_name",
    imageUrl: "image_url",
  },
};

function columnFor(table, attribute) {
  const map = COLUMNS[table] || {};
  const column = map[attribute];
  if (!column) {
    throw new Error(`Unsupported query attribute "${attribute}" for table "${table}"`);
  }
  return column;
}

/**
 * @param {string} table
 * @param {Array<{method:string,attribute?:string,values?:any[]}>} queries
 * @param {number} startIndex - next $n parameter index to use
 */
export function buildQuery(table, queries = [], startIndex = 1) {
  const params = [];
  const where = [];
  const order = [];
  let limit = null;
  let offset = 0;
  let index = startIndex;

  const pushParam = (value) => {
    params.push(value);
    return `$${index++}`;
  };

  for (const q of queries || []) {
    const method = q?.method;
    const values = q?.values || [];

    switch (method) {
      case "equal": {
        const col = columnFor(table, q.attribute);
        if (Array.isArray(values[0]) && values.length === 1) {
          where.push(`${col} = ANY(${pushParam(values[0])})`);
        } else if (values.length > 1) {
          where.push(`${col} = ANY(${pushParam(values)})`);
        } else {
          where.push(`${col} = ${pushParam(values[0])}`);
        }
        break;
      }
      case "notEqual": {
        const col = columnFor(table, q.attribute);
        where.push(`${col} <> ${pushParam(values[0])}`);
        break;
      }
      case "lessThan": {
        const col = columnFor(table, q.attribute);
        where.push(`${col} < ${pushParam(values[0])}`);
        break;
      }
      case "greaterThan": {
        const col = columnFor(table, q.attribute);
        where.push(`${col} > ${pushParam(values[0])}`);
        break;
      }
      case "contains": {
        const col = columnFor(table, q.attribute);
        where.push(`${pushParam(values[0])} = ANY(${col})`);
        break;
      }
      case "search": {
        const col = columnFor(table, q.attribute);
        where.push(`${col} ILIKE '%' || ${pushParam(values[0])} || '%'`);
        break;
      }
      case "isNotNull": {
        const col = columnFor(table, q.attribute);
        where.push(`${col} IS NOT NULL`);
        break;
      }
      case "isNull": {
        const col = columnFor(table, q.attribute);
        where.push(`${col} IS NULL`);
        break;
      }
      case "orderAsc": {
        order.push(`${columnFor(table, q.attribute)} ASC`);
        break;
      }
      case "orderDesc": {
        order.push(`${columnFor(table, q.attribute)} DESC`);
        break;
      }
      case "limit": {
        limit = Number(values[0]) || null;
        break;
      }
      case "offset": {
        offset = Number(values[0]) || 0;
        break;
      }
      default:
        // Ignore unknown query methods rather than failing the whole request.
        break;
    }
  }

  return {
    where: where.length ? `WHERE ${where.join(" AND ")}` : "",
    order: order.length ? `ORDER BY ${order.join(", ")}` : "",
    limit,
    offset,
    params,
    nextIndex: index,
  };
}

export function parseQueriesParam(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
