
import { cosineSimilarity } from './embeddingUtils';
import * as tf from '@tensorflow/tfjs';

interface TrainingExample {
  embedding: tf.Tensor;
  fileName: string;
  imageUrl: string;
}

export function findClosestLabel(
  targetEmbedding: tf.Tensor, 
  labelEmbeddings: { [key: string]: TrainingExample[] }
): { label: string; confidence: number } | null {
  if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
    return null;
  }
  
  let bestMatch = null;
  let bestSimilarity = -1;
  
  // Compare against all training examples for each label
  for (const [label, examples] of Object.entries(labelEmbeddings)) {
    for (const example of examples) {
      const similarity = cosineSimilarity(targetEmbedding, example.embedding);
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = label;
      }
    }
  }
  
  // Only return a match if similarity is above a threshold
  if (bestSimilarity > 0.3) {
    return {
      label: bestMatch!,
      confidence: bestSimilarity
    };
  }
  
  return null;
}

export function calculateTraitRarity(traitType: string, value: string, allMetadata: any[]): string {
  if (allMetadata.length === 0) return "0%";
  
  const count = allMetadata.filter(item => 
    item.attributes.some((attr: any) => attr.trait_type === traitType && attr.value === value)
  ).length;
  
  const percentage = ((count / allMetadata.length) * 100).toFixed(1);
  return `${percentage}%`;
}

export function getTraitStatistics(metadata: any[]) {
  const stats: any = {};
  
  metadata.forEach(item => {
    item.attributes.forEach((attr: any) => {
      if (!stats[attr.trait_type]) {
        stats[attr.trait_type] = {};
      }
      if (!stats[attr.trait_type][attr.value]) {
        stats[attr.trait_type][attr.value] = 0;
      }
      stats[attr.trait_type][attr.value]++;
    });
  });
  
  return stats;
}
