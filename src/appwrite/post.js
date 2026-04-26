import { Client, ID, Databases, Storage, Query } from "appwrite";

class PostService {
  client = new Client();
  databases;
  storage;

  constructor() {
    this.client
      .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
      .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

    // ✅ IMPORTANT
    this.databases = new Databases(this.client);
    this.storage = new Storage(this.client);
  }

  // ✅ Create Post
  async createPost({
  title,
  content,
  slug,
  userId,
  imageId,
  userName,
  audioId,
  tags = [], // ✅ correct way
  isSystem = false,
  status = "public", // ✅ received status
}) {
  try {
    return await this.databases.createDocument(
      import.meta.env.VITE_APPWRITE_DATABASE_ID,
      import.meta.env.VITE_APPWRITE_TABLE_ID,
      ID.unique(),
      {
        title,
        content,
        slug,
        authorID: userId,
        authorName: userName,

        featuredImg: imageId,
        audioId: audioId,

        tags: tags, // ✅ IMPORTANT FIX

        isPublished: status === "public", // ✅ Use isPublished instead of status

        likeCount: 0,
        commentCount: 0,

        isSystem,

        reportCount: 0,
        reportedBy: [],
      }
    );
  } catch (error) {
    console.log("create post error ", error);
    throw error;
  }
}

  // ✅ Get All Posts
  async getPosts(queries = []) {
    try {
      return await this.databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_TABLE_ID,
        queries
      );
    } catch (error) {
      console.error("get posts error ", error);
      // If unauthorized, return empty documents rather than crashing
      if (error?.code === 401 || error?.code === 403) {
        return { documents: [], total: 0 };
      }
      throw error;
    }
  }

  // ✅ Get Single Post (by slug)
  async getPost(slug) {
    try {
      const res = await this.databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_TABLE_ID,
        [Query.equal("slug", slug)]
      );
      return res.documents[0] || null;
    } catch (error) {
      console.log("get post error: ", error);
    }
  }

  //get post - search 

  async getPostBySearch(search = "") {
    console.log("SERVICE SEARCH:", search);

    try {
      const queries = [];

      if (search) {
        queries.push(Query.search("title", search));
      }

      return await this.databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_TABLE_ID,
        queries
      )

    } catch (error) {
      console.log("get post by search error ", error)
    }
  }

  // ✅ Delete Post (FIXED)
  async deletePost(postId) {
    try {
      return await this.databases.deleteDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_TABLE_ID,
        postId
      );
    } catch (error) {
      console.log("delete post error: ", error);
      throw error;
    }
  }

  // ✅ DeleteImage - it is not in databse but in storage
  async deleteFile(fileId) {
    try {
      return await this.storage.deleteFile(
        import.meta.env.VITE_APPWRITE_BUCKET_ID,
        fileId
      )
    } catch (error) {
      console.log("delete File error: ", error);
      throw error; // 👈 IMPORTANT
    }
  }

  // ✅ Update Post (FIXED)
  async updatePost(postId, data) {
    try {
      const finalData = { ...data };

      // ✅ Map status to isPublished if present
      if (finalData.status) {
        finalData.isPublished = finalData.status === "public";
        delete finalData.status;
      }

      return await this.databases.updateDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_TABLE_ID,
        postId,
        finalData
      );
    } catch (error) {
      console.log("updatePost error: ", error);
    }
  }

  // ✅ Get by ID - useful when linking in likes count and comments count 
  async getPostById(id) {
    try {
      return await this.databases.getDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_TABLE_ID,
        id
      );
    } catch (error) {
      console.log("getPostById error:", error);
    }
  }

  // ✅ Upload Image
  async uploadImage(file, userId) {
    try {
      return await this.storage.createFile(
        import.meta.env.VITE_APPWRITE_BUCKET_ID,
        ID.unique(), //this will be the fileId
        file,
        [ //👉 Now even hackers can’t edit others' posts
          `read("any")`,
          `update("user:${userId}")`,
          `delete("user:${userId}")`
        ]
      );
    } catch (error) {
      console.log("upload error:", error);
    }
  }

  // ✅ Preview Image (Optimized for bandwidth)
  getFileView(fileId) {
    return this.storage.getFilePreview(
      import.meta.env.VITE_APPWRITE_BUCKET_ID,
      fileId,
      600, // width
      600, // height
      "center", // gravity
      60 // quality (0-100) - Massive bandwidth saver
    );
  }

  // ✅ Upload Audio
  async uploadAudio(file, userId) {
    try {
      return await this.storage.createFile(
        import.meta.env.VITE_APPWRITE_BUCKET_ID,
        ID.unique(),
        file,
        [
          `read("any")`,
          `update("user:${userId}")`,
          `delete("user:${userId}")`
        ]
      );
    } catch (error) {
      console.log("upload audio error:", error);
    }
  }

  // ✅ Report Post
  async reportPost(postId, userId) {
    try {
      const post = await this.getPostById(postId);
      if (!post) return;

      const reportedBy = post.reportedBy || [];
      if (reportedBy.includes(userId)) return { status: "already_reported" };

      const newReportedBy = [...reportedBy, userId];
      const newReportCount = newReportedBy.length;

      if (newReportCount >= 5) {
        // ✅ AUTO-DELETE IF 5 REPORTS
        await this.deletePost(postId);
        if (post.featuredImg) await this.deleteFile(post.featuredImg);
        if (post.audioId) await this.deleteFile(post.audioId);
        return { status: "deleted" };
      }

      // ✅ UPDATE REPORT COUNT
      await this.updatePost(postId, {
        reportCount: newReportCount,
        reportedBy: newReportedBy,
      });

      return { status: "reported" };
    } catch (error) {
      console.log("reportPost error:", error);
      throw error;
    }
  }
}



// ✅ FIXED instance + export
const postService = new PostService();
export default postService;
