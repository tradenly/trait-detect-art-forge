
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';

let model: mobilenet.MobileNet | null = null;

export async function loadModel(): Promise<mobilenet.MobileNet> {
  if (model) return model;
  
  console.log('Loading MobileNet model...');
  
  // Set backend to webgl for better performance
  await tf.setBackend('webgl');
  await tf.ready();
  
  model = await mobilenet.load();
  console.log('MobileNet model loaded successfully');
  return model;
}

export async function getImageEmbedding(imgElement: HTMLImageElement): Promise<tf.Tensor> {
  if (!model) {
    throw new Error('Model not loaded. Call loadModel() first.');
  }
  
  // Get the feature vector (embedding) instead of classification
  // This gets the internal representation before the final classification layer
  const embedding = model.infer(imgElement, true);
  return embedding;
}

export function cosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
  if (!a || !b) {
    return 0;
  }
  
  // Ensure tensors are flattened and have the same shape
  const aFlat = a.flatten();
  const bFlat = b.flatten();
  
  if (aFlat.shape[0] !== bFlat.shape[0]) {
    aFlat.dispose();
    bFlat.dispose();
    return 0;
  }
  
  // Calculate cosine similarity
  const dotProduct = tf.sum(tf.mul(aFlat, bFlat));
  const normA = tf.norm(aFlat);
  const normB = tf.norm(bFlat);
  
  const similarity = tf.div(dotProduct, tf.mul(normA, normB));
  const result = similarity.dataSync()[0];
  
  // Clean up tensors
  dotProduct.dispose();
  normA.dispose();
  normB.dispose();
  similarity.dispose();
  aFlat.dispose();
  bFlat.dispose();
  
  return isNaN(result) ? 0 : result;
}

export async function preprocessImage(imgElement: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    // Resize image to optimal size for MobileNet (224x224)
    canvas.width = 224;
    canvas.height = 224;
    
    ctx.drawImage(imgElement, 0, 0, 224, 224);
    
    const processedImg = new Image();
    processedImg.onload = () => resolve(processedImg);
    processedImg.onerror = reject;
    processedImg.src = canvas.toDataURL();
  });
}
