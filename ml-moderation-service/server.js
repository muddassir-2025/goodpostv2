import express from "express";
import cors from "cors";
import axios from "axios";
import * as tf from "@tensorflow/tfjs";
import * as nsfw from "nsfwjs";

const app = express();
app.use(cors());
app.use(express.json());

let model;

// Load the model once on startup
const loadModel = async () => {
    console.log("Loading NSFW model...");
    try {
        model = await nsfw.load();
        console.log("Model loaded successfully.");
    } catch (err) {
        console.error("Error loading model:", err);
    }
};

loadModel();

app.post("/api/moderate", async (req, res) => {
    const { imageUrl } = req.body;
    console.log(`\n[${new Date().toLocaleTimeString()}] 📨 Incoming moderation request for: ${imageUrl}`);

    if (!imageUrl) {
        return res.status(400).json({ error: "No imageUrl provided" });
    }

    if (!model) {
        return res.status(503).json({ error: "Moderation model still loading..." });
    }

    try {
        // 1. Fetch image as arraybuffer
        const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data);

        // 2. Decode image into a tensor
        // Note: In Node.js without tfjs-node, we have to be careful. 
        // nsfwjs expects a 3D tensor or a DOM image.
        // Since we are in Node, we can use a small trick or tfjs-node if available.
        // If tfjs-node is NOT available, we can't use tf.node.decodeImage.
        
        // Let's assume the user has tfjs-node or we use a workaround.
        // Actually, nsfwjs has a way to handle this if we pass a buffer in some versions,
        // but typically it needs a decoded tensor.
        
        // WORKAROUND: For pure tfjs in Node, decoding is hard without a library like canvas.
        // But since the user has 'jimp' in package.json, we can use Jimp to get pixel data.
        
        const { default: Jimp } = await import("jimp");
        const jimpImage = await Jimp.read(buffer);
        jimpImage.cover(224, 224); // Resize to match model input if needed
        
        const { width, height, data } = jimpImage.bitmap;
        const imgValues = new Float32Array(width * height * 3);
        
        for (let i = 0; i < width * height; i++) {
            imgValues[i * 3] = data[i * 4] / 255; // R
            imgValues[i * 3 + 1] = data[i * 4 + 1] / 255; // G
            imgValues[i * 3 + 2] = data[i * 4 + 2] / 255; // B
        }
        
        const imgTensor = tf.tensor3d(imgValues, [height, width, 3]);

        // 3. Classify
        const predictions = await model.classify(imgTensor);
        imgTensor.dispose(); // Cleanup memory

        // 4. Decision Logic (Strict Mode)
        const unsafeLabels = ["Porn", "Hentai", "Sexy"];
        
        // Check 1: Any single unsafe category > 30%
        const singleCategoryViolation = predictions.some(p => 
            unsafeLabels.includes(p.className) && p.probability > 0.3
        );

        // Check 2: Sum of all unsafe categories > 40% (Catches suggestive images that don't hit 30% in one label)
        const nsfwScore = predictions
            .filter(p => unsafeLabels.includes(p.className))
            .reduce((sum, p) => sum + p.probability, 0);
        
        const sumViolation = nsfwScore > 0.4;

        const isUnsafe = singleCategoryViolation || sumViolation;

        // 📊 Terminal Logging
        console.log("\n--- MODERATION LOG ---");
        console.log("Image URL:", imageUrl);
        console.log("NSFW Total Score:", (nsfwScore * 100).toFixed(2) + "%");
        console.log("Predictions:", predictions.map(p => `${p.className}: ${(p.probability * 100).toFixed(2)}%`).join(" | "));
        console.log("Status:", isUnsafe ? "🚫 BLOCKED" : "✅ ALLOWED");
        if (isUnsafe) console.log("Reason:", singleCategoryViolation ? "High single category score" : "High aggregate NSFW score");
        console.log("----------------------\n");

        res.json({
            allowed: !isUnsafe,
            predictions
        });

    } catch (err) {
        console.error("Moderation error:", err);
        res.status(500).json({ error: "Failed to process image moderation" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`ML Moderation Service running on http://localhost:${PORT}`);
});