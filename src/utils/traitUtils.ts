
import { cosineSimilarity } from './embeddingUtils';

export function findClosestLabel(targetEmbedding: any, labelEmbeddings: any): string | null {
  if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
    return null;
  }
  
  let bestMatch = null;
  let bestSimilarity = -1;
  
  // Compare against all training examples for each label
  for (const [label, examples] of Object.entries(labelEmbeddings)) {
    const exampleArray = examples as any[];
    
    for (const example of exampleArray) {
      const similarity = cosineSimilarity(targetEmbedding, example.embedding);
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = label;
      }
    }
  }
  
  // Only return a match if similarity is above a threshold
  return bestSimilarity > 0.3 ? bestMatch : null;
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
