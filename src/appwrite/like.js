import { Client, Databases, ID, Query } from "appwrite";
import postService from "./post";

class LikeService {
    client = new Client();
    databases;

    constructor() {
        this.client
            .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
            .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

        this.databases = new Databases(this.client);
    }

    async createLike({ postId, userId }) {
        try {
            const res = await this.databases.createDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_LIKES_ID,
                ID.unique(),
                { postId, userId }
            );

            // ✅ UPDATE POST LIKE COUNT
            const post = await postService.getPostById(postId);

            if (post) {
                await postService.updatePost(postId, {
                    likeCount: (post.likeCount || 0) + 1
                });

                // ✅ NOTIFY POST AUTHOR
                if (post.authorID && post.authorID !== userId) {
                    import("./notification").then(({ default: notificationService }) => {
                        notificationService.createNotification({
                            userId: post.authorID,
                            actorId: userId,
                            type: "like",
                            postId: postId,
                        });
                    });
                }
            }

            return res;

        } catch (error) {
            console.log("createLike error", error);
        }
    }

    async deleteLike(likeId, postId) {
        try {
            await this.databases.deleteDocument(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_LIKES_ID,
                likeId
            );

            if (postId) {
                const post = await postService.getPostById(postId);

                await postService.updatePost(postId, {
                    likeCount: Math.max((post?.likeCount || 0) - 1, 0)
                });
            }

        } catch (error) {
            console.log("deleteLike error", error);
        }
    }

    async getUserLike(postId, userId) {
        try {
            return await this.databases.listDocuments(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_LIKES_ID,
                [
                    Query.equal("postId", postId),
                    Query.equal("userId", userId)
                ]
            );
        } catch (error) {
            console.log("getUserLike error", error);
        }
    }

    async countLikes(postId) {
        try {
            return await this.databases.listDocuments(
                import.meta.env.VITE_APPWRITE_DATABASE_ID,
                import.meta.env.VITE_APPWRITE_LIKES_ID,
                [
                    Query.equal("postId", postId)
                ]
            );
        } catch (error) {
            console.log("countLikes error", error);
        }
    }
}

const likeService = new LikeService();
export default likeService;
