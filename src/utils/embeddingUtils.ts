
import * as mobilenet from '@tensorflow-models/mobilenet';
import '@tensorflow/tfjs';

let model: any = null;

export async function loadModel() {
  if (model) return model;
  
  console.log('Loading MobileNet model...');
  model = await mobilenet.load();
  console.log('MobileNet model loaded successfully');
  return model;
}

export async function getImageEmbedding(imgElement: HTMLImageElement) {
  if (!model) {
    throw new Error('Model not loaded. Call loadModel() first.');
  }
  
  // Get the feature vector (embedding) instead of classification
  const embedding = await model.infer(imgElement, true);
  return embedding;
}

export function cosineSimilarity(a: any, b: any): number {
  if (!a || !b || a.shape[1] !== b.shape[1]) {
    return 0;
  }
  
  const aData = a.dataSync();
  const bData = b.dataSync();
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < aData.length; i++) {
    dotProduct += aData[i] * bData[i];
    normA += aData[i] * aData[i];
    normB += bData[i] * bData[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
