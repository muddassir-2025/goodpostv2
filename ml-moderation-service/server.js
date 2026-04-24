import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";
import * as tf from "@tensorflow/tfjs";
import * as nsfw from "nsfwjs";
import jimp from "jimp";
import { moderateImage } from "./moderateImage.js";

const app = express();
app.use(cors());
app.use(express.json());

let model;

/**
 * Load NSFW model once at startup
 */
const loadModel = async () => {
    try {
        console.log("🔄 Loading NSFW model...");
        model = await nsfw.load();
        console.log("✅ Model loaded successfully");
    } catch (err) {
        console.error("❌ Model load error:", err);
    }
};

loadModel();

/**
 * Helper: classify image buffer
 */
async function classifyImage(buffer) {
    const image = await jimp.read(Buffer.from(buffer));
    image.resize(224, 224);
    
    const numChannels = 3;
    const numPixels = image.bitmap.width * image.bitmap.height;
    const values = new Int32Array(numPixels * numChannels);

    for (let i = 0; i < numPixels; i++) {
        for (let c = 0; c < numChannels; c++) {
            values[i * numChannels + c] = image.bitmap.data[i * 4 + c];
        }
    }

    const imageTensor = tf.tensor3d(values, [image.bitmap.height, image.bitmap.width, numChannels], 'int32');
    const predictions = await model.classify(imageTensor);
    
    imageTensor.dispose();
    return predictions;
}

/**
 * Decision logic (more stable than raw thresholds)
 */
function isNSFW(predictions) {
    const get = (label) =>
        predictions.find((p) => p.className === label)?.probability || 0;

    const porn = get("Porn");
    const hentai = get("Hentai");
    const sexy = get("Sexy");

    const maxNSFW = Math.max(porn, hentai, sexy);
    const sumNSFW = porn + hentai + sexy;

    // Strict Mode Calibration
    const isUnsafe = maxNSFW > 0.05 || sumNSFW > 0.1;
    const borderline = maxNSFW > 0.01 && !isUnsafe;

    return {
        isUnsafe,
        borderline,
        score: maxNSFW,
        sumScore: sumNSFW
    };
}

/**
 * Unified API endpoint (ML Model -> Vision API)
 */
app.post("/moderate-image", async (req, res) => {
    const { imageUrl } = req.body;

    console.log(`\n📥 Unified Moderation Request: ${imageUrl}`);

    if (!imageUrl) {
        return res.status(400).json({ error: "imageUrl is required" });
    }

    if (!model) {
        return res.status(503).json({ error: "ML Model still loading" });
    }

    try {
        // 1. Fetch image
        const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
        });
        const buffer = response.data;

        // 2. ML Model Check (nsfwjs)
        console.log("➡️ Running ML Model...");
        const predictions = await classifyImage(buffer);
        const mlResult = isNSFW(predictions);

        if (mlResult.isUnsafe) {
            console.log("🚫 BLOCKED by ML Model (Fast Reject)");
            console.log("NSFW Max Score:", (mlResult.score * 100).toFixed(2) + "%");
            return res.json({
                allowed: false,
                reason: "Explicit content detected by initial scan",
                raw: predictions,
            });
        }

        console.log("✅ Passed ML Model, sending to Google Vision API...");

        // 3. Google Vision API Check
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