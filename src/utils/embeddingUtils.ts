
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';

let model: mobilenet.MobileNet | null = null;

export async function loadModel(): Promise<mobilenet.MobileNet> {
  if (model) return model;
  
  console.log('Loading MobileNet model with optimizations...');
  
  // Use WebGL backend for better performance
  await tf.setBackend('webgl');
  await tf.ready();
  
  // Load model with performance optimizations
  model = await mobilenet.load({
    version: 2,
    alpha: 1.0 // Full model for maximum accuracy
  });
  
  console.log('MobileNet model loaded successfully with enhanced configuration');
  return model;
}

export async function getImageEmbedding(imgElement: HTMLImageElement): Promise<tf.Tensor> {
  if (!model) {
    throw new Error('Model not loaded. Call loadModel() first.');
  }
  
  // Get deeper feature representation (1024 dimensions instead of 1000 classes)
  const embedding = model.infer(imgElement, true);
  
  // Apply L2 normalization for better similarity comparison
  const normalized = tf.div(embedding, tf.norm(embedding, 'euclidean'));
  embedding.dispose();
  
  return normalized;
}

export function cosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
  if (!a || !b) {
    console.warn('Null tensor provided to cosineSimilarity');
    return 0;
  }
  
  // Ensure tensors are flattened and compatible
  const aFlat = a.flatten();
  const bFlat = b.flatten();
  
  if (aFlat.shape[0] !== bFlat.shape[0]) {
    console.warn('Tensor shape mismatch:', aFlat.shape, bFlat.shape);
    aFlat.dispose();
    bFlat.dispose();
    return 0;
  }
  
  // Calculate cosine similarity with numerical stability
  const dotProduct = tf.sum(tf.mul(aFlat, bFlat));
  const normA = tf.norm(aFlat);
  const normB = tf.norm(bFlat);
  
  // Add small epsilon to prevent division by zero
  const epsilon = 1e-8;
  const similarity = tf.div(
    dotProduct, 
    tf.maximum(tf.mul(normA, normB), epsilon)
  );
  
  const result = similarity.dataSync()[0];
  
  // Clean up tensors
  dotProduct.dispose();
  normA.dispose();
  normB.dispose();
  similarity.dispose();
  aFlat.dispose();
  bFlat.dispose();
  
  return isNaN(result) ? 0 : Math.max(0, Math.min(1, result));
}

export async function preprocessImage(imgElement: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    // Optimal size for MobileNet
    canvas.width = 224;
    canvas.height = 224;
    
    // Enhanced preprocessing for better feature extraction
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 224, 224);
    
    // Apply image enhancement for better trait detection
    ctx.filter = 'contrast(115%) brightness(105%) saturate(110%)';
    ctx.drawImage(imgElement, 0, 0, 224, 224);
    
    // Reset filter for clean output
    ctx.filter = 'none';
    
    const processedImg = new Image();
    processedImg.onload = () => resolve(processedImg);
    processedImg.onerror = reject;
    processedImg.src = canvas.toDataURL('image/jpeg', 0.95);
  });
}

// Enhanced training quality validation
export function validateTrainingQuality(examples: any[]): { 
  isValid: boolean; 
  issues: string[]; 
  recommendations: string[] 
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (examples.length < 3) {
    issues.push('Insufficient training examples (minimum 3 required)');
  }
  
  if (examples.length < 5) {
    recommendations.push('Add more examples (5+ recommended) for better accuracy');
  }
  
  if (examples.length < 8) {
    recommendations.push('Consider adding diverse examples (different angles, lighting)');
  }
  
  return {
    isValid: examples.length >= 3,
    issues,
    recommendations
  };
}

// New function for batch processing optimization
export async function batchProcessImages(
  images: HTMLImageElement[], 
  batchSize: number = 4
): Promise<tf.Tensor[]> {
  const embeddings: tf.Tensor[] = [];
  
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);
    const batchPromises = batch.map(async (img) => {
      const processed = await preprocessImage(img);
      return getImageEmbedding(processed);
    });
    
    const batchEmbeddings = await Promise.all(batchPromises);
    embeddings.push(...batchEmbeddings);
    
    // Small delay to prevent UI blocking
    if (i + batchSize < images.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  return embeddings;
}

// Memory cleanup utility
export function cleanupTensors(tensors: tf.Tensor[]) {
  tensors.forEach(tensor => {
    if (tensor && typeof tensor.dispose === 'function') {
      tensor.dispose();
    }
  });
}
