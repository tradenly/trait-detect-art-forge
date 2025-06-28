
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

let models: {
  mobilenet: mobilenet.MobileNet | null;
  ensemble: tf.LayersModel | null;
} = {
  mobilenet: null,
  ensemble: null
};

// Enhanced preprocessing with proper normalization
export async function createAugmentedVersions(imgElement: HTMLImageElement): Promise<HTMLImageElement[]> {
  const versions: HTMLImageElement[] = [imgElement]; // Original
  
  // Create augmented versions for better feature extraction
  const augmentations = [
    { brightness: 1.1, contrast: 1.1, saturation: 1.0 },
    { brightness: 0.9, contrast: 1.2, saturation: 1.1 },
    { brightness: 1.0, contrast: 0.9, saturation: 1.2 },
  ];
  
  for (const aug of augmentations) {
    try {
      const augmented = await applyImageAugmentation(imgElement, aug);
      versions.push(augmented);
    } catch (error) {
      console.warn('Failed to create augmented version:', error);
      // Continue with original if augmentation fails
    }
  }
  
  return versions;
}

async function applyImageAugmentation(
  imgElement: HTMLImageElement, 
  params: { brightness: number; contrast: number; saturation: number }
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    canvas.width = 224;
    canvas.height = 224;
    
    // Apply filtering with bounds checking
    const brightness = Math.max(0.5, Math.min(2.0, params.brightness));
    const contrast = Math.max(0.5, Math.min(2.0, params.contrast));
    const saturation = Math.max(0.5, Math.min(2.0, params.saturation));
    
    ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    ctx.drawImage(imgElement, 0, 0, 224, 224);
    
    const processedImg = new Image();
    processedImg.onload = () => resolve(processedImg);
    processedImg.onerror = reject;
    processedImg.src = canvas.toDataURL('image/jpeg', 0.95);
  });
}

// Enhanced embedding with proper tensor management and normalization
export async function getEnhancedEmbedding(imgElement: HTMLImageElement): Promise<tf.Tensor> {
  if (!models.mobilenet) {
    throw new Error('Models not loaded');
  }
  
  try {
    // Get multiple augmented versions
    const augmentedVersions = await createAugmentedVersions(imgElement);
    
    // Extract features from all versions
    const embeddings: tf.Tensor[] = [];
    
    for (const version of augmentedVersions) {
      try {
        // Ensure image is properly preprocessed for MobileNet
        const tensor = tf.browser.fromPixels(version)
          .resizeNearestNeighbor([224, 224])
          .toFloat()
          .div(255.0) // Normalize to [0, 1] range
          .expandDims();
        
        // Get deep features (before final classification layer)
        const features = models.mobilenet.infer(tensor, true);
        
        // Clean up input tensor
        tensor.dispose();
        
        // Apply multiple pooling strategies with proper bounds checking
        const globalAvg = tf.mean(features, [1, 2], true);
        const globalMax = tf.max(features, [1, 2], true);
        
        // Combine pooling strategies
        const combined = tf.concat([globalAvg, globalMax], -1);
        
        // Normalize to prevent out-of-range values
        const normalized = tf.div(combined, tf.add(tf.norm(combined), 1e-8));
        
        embeddings.push(normalized);
        
        // Clean up intermediate tensors
        features.dispose();
        globalAvg.dispose();
        globalMax.dispose();
        combined.dispose();
        
      } catch (error) {
        console.warn('Failed to process augmented version:', error);
        // Continue with other versions
      }
    }
    
    if (embeddings.length === 0) {
      throw new Error('No embeddings could be extracted');
    }
    
    // Create ensemble embedding with proper error handling
    const stackedEmbeddings = tf.stack(embeddings);
    const meanEmbedding = tf.mean(stackedEmbeddings, 0);
    
    // Final normalization with epsilon to prevent division by zero
    const norm = tf.norm(meanEmbedding);
    const normalizedEmbedding = tf.div(meanEmbedding, tf.add(norm, 1e-8));
    
    // Clamp values to safe range
    const clampedEmbedding = tf.clipByValue(normalizedEmbedding, -2.0, 2.0);
    
    // Cleanup
    embeddings.forEach(emb => emb.dispose());
    stackedEmbeddings.dispose();
    meanEmbedding.dispose();
    norm.dispose();
    normalizedEmbedding.dispose();
    
    return clampedEmbedding;
    
  } catch (error) {
    console.error('Error in getEnhancedEmbedding:', error);
    throw error;
  }
}

// Advanced similarity calculation with safe tensor operations
export function calculateAdvancedSimilarity(embedding1: tf.Tensor, embedding2: tf.Tensor): {
  cosine: number;
  euclidean: number;
  manhattan: number;
  composite: number;
} {
  try {
    const flat1 = embedding1.flatten();
    const flat2 = embedding2.flatten();
    
    // Cosine similarity with safe division
    const dotProduct = tf.sum(tf.mul(flat1, flat2));
    const norm1 = tf.add(tf.norm(flat1), 1e-8);
    const norm2 = tf.add(tf.norm(flat2), 1e-8);
    const cosine = Math.max(-1, Math.min(1, tf.div(dotProduct, tf.mul(norm1, norm2)).dataSync()[0]));
    
    // Euclidean distance (converted to similarity)
    const euclideanDist = tf.norm(tf.sub(flat1, flat2)).dataSync()[0];
    const euclidean = 1 / (1 + euclideanDist);
    
    // Manhattan distance (converted to similarity)
    const manhattanDist = tf.sum(tf.abs(tf.sub(flat1, flat2))).dataSync()[0];
    const manhattan = 1 / (1 + manhattanDist);
    
    // Composite score with learned weights
    const composite = (cosine * 0.5) + (euclidean * 0.3) + (manhattan * 0.2);
    
    // Cleanup
    flat1.dispose();
    flat2.dispose();
    dotProduct.dispose();
    norm1.dispose();
    norm2.dispose();
    
    return { 
      cosine: Math.max(0, Math.min(1, cosine)), 
      euclidean: Math.max(0, Math.min(1, euclidean)), 
      manhattan: Math.max(0, Math.min(1, manhattan)), 
      composite: Math.max(0, Math.min(1, composite)) 
    };
    
  } catch (error) {
    console.error('Error in calculateAdvancedSimilarity:', error);
    return { cosine: 0, euclidean: 0, manhattan: 0, composite: 0 };
  }
}

export async function loadAdvancedModels(): Promise<void> {
  try {
    console.log('Loading advanced AI models for maximum accuracy...');
    
    // Use WebGL for better performance if available, fallback to CPU
    try {
      await tf.setBackend('webgl');
    } catch (error) {
      console.warn('WebGL not available, falling back to CPU:', error);
      await tf.setBackend('cpu');
    }
    
    await tf.ready();
    
    // Load MobileNet with error handling
    models.mobilenet = await mobilenet.load({
      version: 2,
      alpha: 1.0, // Full model
      modelUrl: undefined, // Use default for best accuracy
      inputRange: [0, 1]
    });
    
    console.log('Advanced models loaded successfully');
    
  } catch (error) {
    console.error('Failed to load advanced models:', error);
    throw error;
  }
}
