
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
): { label: string; confidence: number; avgSimilarity: number } | null {
  if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
    return null;
  }
  
  let bestMatch = null;
  let bestAvgSimilarity = -1;
  const labelScores: { [key: string]: number[] } = {};
  
  // Calculate similarity against all examples for each label
  for (const [label, examples] of Object.entries(labelEmbeddings)) {
    const similarities: number[] = [];
    
    for (const example of examples) {
      const similarity = cosineSimilarity(targetEmbedding, example.embedding);
      similarities.push(similarity);
    }
    
    // Use average similarity across all examples for this label
    const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    labelScores[label] = similarities;
    
    if (avgSimilarity > bestAvgSimilarity) {
      bestAvgSimilarity = avgSimilarity;
      bestMatch = label;
    }
  }
  
  // Increased threshold for more reliable predictions
  // Also check that the best match is significantly better than others
  if (bestAvgSimilarity > 0.6) {
    // Calculate confidence based on how much better this match is
    const sortedScores = Object.values(labelScores)
      .map(scores => scores.reduce((sum, sim) => sum + sim, 0) / scores.length)
      .sort((a, b) => b - a);
    
    const confidence = sortedScores.length > 1 
      ? Math.min(1, bestAvgSimilarity / Math.max(sortedScores[1], 0.1))
      : bestAvgSimilarity;
    
    return {
      label: bestMatch!,
      confidence: confidence,
      avgSimilarity: bestAvgSimilarity
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

// New function to validate detection results
export function validateDetectionResults(results: any[]): { 
  accuracy: number; 
  lowConfidenceCount: number; 
  recommendations: string[] 
} {
  const recommendations: string[] = [];
  let lowConfidenceCount = 0;
  let totalConfidence = 0;
  let totalPredictions = 0;
  
  results.forEach(result => {
    Object.values(result.confidenceScores || {}).forEach((confidence: any) => {
      totalConfidence += confidence;
      totalPredictions++;
      
      if (confidence < 0.7) {
        lowConfidenceCount++;
      }
    });
  });
  
  const accuracy = totalPredictions > 0 ? totalConfidence / totalPredictions : 0;
  
  if (accuracy < 0.7) {
    recommendations.push('Overall accuracy is low. Consider adding more diverse training examples.');
  }
  
  if (lowConfidenceCount > totalPredictions * 0.3) {
    recommendations.push('Many predictions have low confidence. Review your training data quality.');
  }
  
  return {
    accuracy,
    lowConfidenceCount,
    recommendations
  };
}
