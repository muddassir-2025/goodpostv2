import "dotenv/config";
import express from "express";
import cors from "cors";
import { moderateImage } from "./moderateImage.js";

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Unified API endpoint (Google Vision API Only)
 */
app.post("/moderate-image", async (req, res) => {
    const { imageUrl } = req.body;

    console.log(`\n📥 Moderation Request: ${imageUrl}`);

    if (!imageUrl) {
        return res.status(400).json({ error: "imageUrl is required" });
    }

    try {
        console.log("➡️ Sending to Google Vision API...");
        const visionResult = await moderateImage(imageUrl);
        
        console.log("Vision API Result:", visionResult.allowed ? "✅ ALLOWED" : "🚫 BLOCKED");
        if (!visionResult.allowed) console.log("Reason:", visionResult.reason);

        return res.json(visionResult);
    } catch (err) {
        console.error("❌ Endpoint Error:", err.message);
        return res.status(500).json({
            allowed: false,
            reason: "Image moderation service unavailable",
            raw: null
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});