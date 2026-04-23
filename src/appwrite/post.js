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

        isPublished: true,

        likeCount: 0,
        commentCount: 0,

        isSystem,
      }
    );
  } catch (error) {
    console.log("create post error ", error);
    throw error;
  }
}

  // ✅ Get All Posts
  async getPosts() {
    try {
      return await this.databases.listDocuments(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_TABLE_ID
      );
    } catch (error) {
      console.log("get posts error ", error);
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
      return await this.databases.updateDocument(
        import.meta.env.VITE_APPWRITE_DATABASE_ID,
        import.meta.env.VITE_APPWRITE_TABLE_ID,
        postId,
        data
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

  // ✅ Preview Image
  getFileView(fileId) {
    return this.storage.getFilePreview(
      import.meta.env.VITE_APPWRITE_BUCKET_ID,
      fileId
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


}



// ✅ FIXED instance + export
const postService = new PostService();
export default postService;
