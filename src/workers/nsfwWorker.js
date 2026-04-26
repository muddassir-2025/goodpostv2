import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';

// Pre-load model in worker memory
let model = null;

async function loadModel() {
  if (model) return model;
  
  // Load the default MobileNetV2 model provided by the library.
  // This automatically resolves to their official, CORS-friendly CDN.
  model = await nsfwjs.load();
  return model;
}

self.onmessage = async (event) => {
  const { imageData } = event.data;

  try {
    const loadedModel = await loadModel();
    
    // Process image bitmap
    const predictions = await loadedModel.classify(imageData);
    
    // Analyze results
    const results = {
      Porn: predictions.find(p => p.className === 'Porn')?.probability || 0,
      Hentai: predictions.find(p => p.className === 'Hentai')?.probability || 0,
      Sexy: predictions.find(p => p.className === 'Sexy')?.probability || 0,
      Neutral: predictions.find(p => p.className === 'Neutral')?.probability || 0,
      Drawing: predictions.find(p => p.className === 'Drawing')?.probability || 0,
    };

    // Stricter blocking logic
    const isUnsafe = results.Porn > 0.7 || results.Hentai > 0.7 || results.Sexy > 0.8;

    self.postMessage({
      success: true,
      isUnsafe,
      results,
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error.message
    });
  }
};
