import { useState, useCallback, useEffect, useRef } from 'react';
import { prepareImageForDetection } from '../lib/imageOptimization';

export function useNSFW() {
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState(null);
  const workerRef = useRef(null);

  useEffect(() => {
    // Lazy initialize worker only when needed
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const checkImage = useCallback(async (file) => {
    if (!file) return { safe: true };
    
    setIsChecking(true);
    setError(null);

    try {
      // 1. Prepare image (resize + bitmap)
      const imageData = await prepareImageForDetection(file);

      // 2. Initialize worker if not exists
      if (!workerRef.current) {
        // In Vite, we use this syntax for workers
        workerRef.current = new Worker(
          new URL('../workers/nsfwWorker.js', import.meta.url),
          { type: 'module' }
        );
      }

      const worker = workerRef.current;

      // 3. Await the worker's verdict
      const result = await new Promise((resolve) => {
        const handleMessage = (e) => {
          worker.removeEventListener('message', handleMessage);

          if (e.data.success) {
            resolve({
              safe: !e.data.isUnsafe,
              results: e.data.results
            });
          } else {
            resolve({ safe: false, error: e.data.error });
          }
        };

        worker.addEventListener('message', handleMessage);

        // 4. Send to worker (transferring bitmap for performance)
        worker.postMessage({ imageData }, [imageData]);
      });

      if (result.error) setError(result.error);
      return result;
    } catch (err) {
      setError(err.message);
      return { safe: false, error: err.message };
    } finally {
      setIsChecking(false);
    }
  }, []);

  return { checkImage, isChecking, error };
}
