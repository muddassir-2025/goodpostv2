/**
 * ULTRA-OPTIMIZED Image Processing for NSFW Detection
 */

export async function prepareImageForDetection(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = async () => {
      URL.revokeObjectURL(url);
      
      const MAX_WIDTH = 800;
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Use createImageBitmap for the worker - it's much faster and transferable
      try {
        const bitmap = await createImageBitmap(canvas);
        resolve(bitmap);
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    
    img.src = url;
  });
}
