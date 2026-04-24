import express from "express";
import cors from "cors";
import axios from "axios";
import * as tf from "@tensorflow/tfjs-node";
import nsfw from "nsfwjs";

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
    console.log(`[Debug] Buffer received. Size: ${buffer.byteLength} bytes`);
    
    const imageTensor = tf.node
        .decodeImage(new Uint8Array(buffer), 3)
        .resizeBilinear([224, 224]);
        // Removed expandDims(0) - nsfwjs prefers 3D [224, 224, 3]

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
    const isUnsafe = maxNSFW > 0.35 || sumNSFW > 0.45;
    const borderline = maxNSFW > 0.2 && !isUnsafe;

    return {
        isUnsafe,
        borderline,
        score: maxNSFW,
        sumScore: sumNSFW
    };
}

/**
 * API endpoint
 */
app.post("/api/moderate", async (req, res) => {
    const { imageUrl } = req.body;

    console.log(`\n📥 Request: ${imageUrl}`);

    if (!imageUrl) {
        return res.status(400).json({ error: "imageUrl is required" });
    }

    if (!model) {
        return res.status(503).json({ error: "Model still loading" });
    }

    try {
        // 1. Fetch image
        const response = await axios.get(imageUrl, {
            responseType: "arraybuffer",
        });

        const buffer = response.data;

        // 2. Classify
        const predictions = await classifyImage(buffer);

        // 3. Decision
        const result = isNSFW(predictions);

        const allowed = !result.isUnsafe;

        // 4. Logging
        console.log("\n--- MODERATION RESULT ---");
        console.log("URL:", imageUrl);
        console.log(
            "Predictions:",
            predictions.map(
                (p) =>
                    `${p.className}: ${(p.probability * 100).toFixed(2)}%`
            )
        );
        console.log("NSFW Max Score:", (result.score * 100).toFixed(2) + "%");
        console.log("NSFW Sum Score:", (result.sumScore * 100).toFixed(2) + "%");
        console.log(
            "Status:",
            allowed ? "✅ ALLOWED" : "🚫 BLOCKED"
        );
        if (!allowed) console.log("Reason:", result.score > 0.35 ? "High category score" : "High aggregate score");
        console.log("------------------------\n");

        // 5. Response
        return res.json({
            allowed,
            nsfwScore: result.score,
            borderline: result.borderline,
            predictions,
        });
    } catch (err) {
        console.error("❌ Error:", err.message);
        return res.status(500).json({
            error: "Failed to process image",
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});