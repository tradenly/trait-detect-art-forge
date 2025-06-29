
import { enhancedDetector } from './enhancedDetection';
import * as tf from '@tensorflow/tfjs';

interface TrainingExample {
  embedding: tf.Tensor;
  fileName: string;
  imageUrl: string;
}

interface DetectionResult {
  label: string;
  confidence: number;
  avgSimilarity: number;
  individualScores: number[];
}

export function findClosestLabel(
  targetEmbedding: tf.Tensor, 
  labelEmbeddings: { [key: string]: TrainingExample[] },
  category?: string
): DetectionResult | null {
  if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
    console.log('❌ Invalid inputs for detection');
    return null;
  }
  
  // Use stricter basic detection - enhanced detection was too permissive
  return basicDetection(targetEmbedding, labelEmbeddings, category);
}

function basicDetection(
  targetEmbedding: tf.Tensor, 
  labelEmbeddings: { [key: string]: TrainingExample[] },
  category?: string
): DetectionResult | null {
  let bestMatch = null;
  let bestAvgSimilarity = -1;
  let bestIndividualScores: number[] = [];
  
  console.log(`🔍 Detection for ${category || 'unknown'} with ${Object.keys(labelEmbeddings).length} labels`);
  
  for (const [label, examples] of Object.entries(labelEmbeddings)) {
    if (examples.length === 0) {
      console.log(`⚠️ No examples for label: ${label}`);
      continue;
    }
    
    const similarities: number[] = [];
    
    for (const example of examples) {
      const similarity = cosineSimilarity(targetEmbedding, example.embedding);
      similarities.push(similarity);
    }
    
    // Use more conservative scoring
    const avgSim = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    const maxSim = Math.max(...similarities);
    const minSim = Math.min(...similarities);
    
    // Consistency check - if similarities vary too much, it's not a good match
    const variance = similarities.reduce((sum, sim) => sum + Math.pow(sim - avgSim, 2), 0) / similarities.length;
    const consistencyPenalty = Math.min(0.2, variance * 2); // Penalize inconsistent training data
    
    // Conservative composite score with consistency penalty
    const compositeScore = (maxSim * 0.4 + avgSim * 0.6) - consistencyPenalty;
    
    console.log(`Label "${label}": avg=${avgSim.toFixed(3)}, max=${maxSim.toFixed(3)}, min=${minSim.toFixed(3)}, variance=${variance.toFixed(3)}, composite=${compositeScore.toFixed(3)}`);
    
    if (compositeScore > bestAvgSimilarity) {
      bestAvgSimilarity = compositeScore;
      bestMatch = label;
      bestIndividualScores = similarities;
    }
  }
  
  if (!bestMatch) {
    console.log('❌ No match found');
    return null;
  }
  
  // Much stricter threshold - only accept very confident matches
  const baseThreshold = 0.78; // Increased from 0.72
  
  // Adjust threshold based on training quality
  const exampleCount = labelEmbeddings[bestMatch].length;
  let threshold = baseThreshold;
  
  if (exampleCount < 3) {
    threshold = 0.85; // Very high threshold for poorly trained labels
  } else if (exampleCount < 5) {
    threshold = 0.82; // High threshold for moderately trained labels
  } else {
    threshold = 0.78; // Standard threshold for well-trained labels
  }
  
  console.log(`🎯 Best match: "${bestMatch}" score: ${bestAvgSimilarity.toFixed(3)}, threshold: ${threshold.toFixed(3)}`);
  
  if (bestAvgSimilarity >= threshold) {
    console.log(`✅ ACCEPTED: "${bestMatch}" confidence: ${bestAvgSimilarity.toFixed(3)}`);
    
    return {
      label: bestMatch,
      confidence: bestAvgSimilarity,
      avgSimilarity: bestAvgSimilarity,
      individualScores: bestIndividualScores
    };
  }
  
  console.log(`❌ REJECTED: "${bestMatch}" score ${bestAvgSimilarity.toFixed(3)} < threshold ${threshold.toFixed(3)}`);
  return {
    label: 'Not Detected',
    confidence: bestAvgSimilarity,
    avgSimilarity: bestAvgSimilarity,
    individualScores: bestIndividualScores
  };
}

function cosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
  if (!a || !b) {
    console.warn('Null tensor provided to cosineSimilarity');
    return 0;
  }
  
  const aFlat = a.flatten();
  const bFlat = b.flatten();
  
  if (aFlat.shape[0] !== bFlat.shape[0]) {
    console.warn('Tensor shape mismatch:', aFlat.shape, bFlat.shape);
    aFlat.dispose();
    bFlat.dispose();
    return 0;
  }
  
  const dotProduct = tf.sum(tf.mul(aFlat, bFlat));
  const normA = tf.norm(aFlat);
  const normB = tf.norm(bFlat);
  
  const epsilon = 1e-8;
  const similarity = tf.div(
    dotProduct, 
    tf.maximum(tf.mul(normA, normB), epsilon)
  );
  
  const result = similarity.dataSync()[0];
  
  dotProduct.dispose();
  normA.dispose();
  normB.dispose();
  similarity.dispose();
  aFlat.dispose();
  bFlat.dispose();
  
  return isNaN(result) ? 0 : Math.max(0, Math.min(1, result));
}

// Simplified conflict resolution - be more conservative
export function resolveTraitConflicts(detectedTraits: { [key: string]: any }): { [key: string]: any } {
  const resolved = { ...detectedTraits };
  
  // Only resolve clear conflicts with significant confidence differences
  const conflicts = [
    ['shorts', 'pants'],
    ['shirt', 'no_shirt'], 
    ['hat', 'no_hat']
  ];
  
  for (const [trait1, trait2] of conflicts) {
    const trait1Keys = Object.keys(resolved).filter(key => 
      key.toLowerCase().includes(trait1)
    );
    const trait2Keys = Object.keys(resolved).filter(key => 
      key.toLowerCase().includes(trait2)
    );
    
    if (trait1Keys.length > 0 && trait2Keys.length > 0) {
      const trait1Confidence = Math.max(...trait1Keys.map(key => resolved[key].confidence || 0));
      const trait2Confidence = Math.max(...trait2Keys.map(key => resolved[key].confidence || 0));
      
      // Only resolve if there's a significant confidence difference (>0.1)
      if (Math.abs(trait1Confidence - trait2Confidence) > 0.1) {
        if (trait1Confidence > trait2Confidence) {
          trait2Keys.forEach(key => delete resolved[key]);
          console.log(`Conflict resolved: Kept ${trait1} (${trait1Confidence.toFixed(3)}) over ${trait2} (${trait2Confidence.toFixed(3)})`);
        } else {
          trait1Keys.forEach(key => delete resolved[key]);
          console.log(`Conflict resolved: Kept ${trait2} (${trait2Confidence.toFixed(3)}) over ${trait1} (${trait1Confidence.toFixed(3)})`);
        }
      }
    }
  }
  
  return resolved;
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

// Improved validation with stricter criteria
export function validateDetectionResults(results: any[]): { 
  accuracy: number; 
  lowConfidenceCount: number; 
  recommendations: string[];
  detectionRate: number;
  consistencyScore: number;
} {
  const recommendations: string[] = [];
  let lowConfidenceCount = 0;
  let totalConfidence = 0;
  let totalPredictions = 0;
  let detectedTraits = 0;
  let totalPossibleTraits = 0;
  
  const confidenceScores: number[] = [];
  
  results.forEach(result => {
    Object.values(result.confidenceScores || {}).forEach((confidence: any) => {
      totalConfidence += confidence;
      totalPredictions++;
      confidenceScores.push(confidence);
      
      if (confidence < 0.78) { // Updated threshold
        lowConfidenceCount++;
      } else {
        detectedTraits++;
      }
      
      totalPossibleTraits++;
    });
  });
  
  const accuracy = totalPredictions > 0 ? totalConfidence / totalPredictions : 0;
  const detectionRate = totalPossibleTraits > 0 ? detectedTraits / totalPossibleTraits : 0;
  
  const avgConfidence = confidenceScores.length > 0 ? 
    confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length : 0;
  const variance = confidenceScores.length > 0 ? 
    confidenceScores.reduce((sum, conf) => sum + Math.pow(conf - avgConfidence, 2), 0) / confidenceScores.length : 0;
  const consistencyScore = Math.max(0, 1 - Math.sqrt(variance));
  
  if (accuracy < 0.78) {
    recommendations.push('Overall accuracy is low. Add more diverse, high-quality training examples.');
  }
  
  if (detectionRate < 0.4) {
    recommendations.push('Low detection rate indicates overly strict thresholds or insufficient training data.');
  }
  
  if (consistencyScore < 0.7) {
    recommendations.push('Inconsistent predictions. Review training data quality and remove poor examples.');
  }
  
  if (lowConfidenceCount > totalPredictions * 0.6) {
    recommendations.push('Many low-confidence predictions. Focus on adding clear, unambiguous training examples.');
  }
  
  return {
    accuracy,
    lowConfidenceCount,
    recommendations,
    detectionRate,
    consistencyScore
  };
}

// New utility for training data analysis
export function analyzeTrainingData(trainedTraits: any): {
  totalExamples: number;
  categoryCounts: { [key: string]: number };
  recommendations: string[];
  qualityScore: number;
} {
  let totalExamples = 0;
  const categoryCounts: { [key: string]: number } = {};
  const recommendations: string[] = [];
  let qualityTotal = 0;
  let categoryCount = 0;
  
  Object.entries(trainedTraits).forEach(([category, values]: [string, any]) => {
    let categoryTotal = 0;
    let categoryQuality = 0;
    let valueCount = 0;
    
    Object.entries(values).forEach(([value, examples]: [string, any]) => {
      const count = examples.length;
      categoryTotal += count;
      totalExamples += count;
      
      // Quality scoring
      let valueQuality = 0;
      if (count >= 8) valueQuality = 1.0;
      else if (count >= 5) valueQuality = 0.8;
      else if (count >= 3) valueQuality = 0.6;
      else valueQuality = 0.3;
      
      categoryQuality += valueQuality;
      valueCount++;
      
      if (count < 3) {
        recommendations.push(`${category}: ${value} needs more examples (${count}/3 minimum)`);
      }
    });
    
    categoryCounts[category] = categoryTotal;
    
    if (valueCount > 0) {
      qualityTotal += (categoryQuality / valueCount);
      categoryCount++;
    }
    
    if (categoryTotal < 15) {
      recommendations.push(`${category} category needs more total examples (${categoryTotal}/15 recommended)`);
    }
  });
  
  const qualityScore = categoryCount > 0 ? qualityTotal / categoryCount : 0;
  
  if (totalExamples < 50) {
    recommendations.push('Add more training examples across all categories for better detection accuracy');
  }
  
  return {
    totalExamples,
    categoryCounts,
    recommendations,
    qualityScore
  };
}
