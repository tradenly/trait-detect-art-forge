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
    return null;
  }
  
  // Use enhanced detection if category is provided
  if (category) {
    const enhancedResult = enhancedDetector.enhancedDetection(targetEmbedding, labelEmbeddings, category);
    
    if (enhancedResult) {
      return {
        label: enhancedResult.label,
        confidence: enhancedResult.confidence,
        avgSimilarity: enhancedResult.similarity,
        individualScores: [enhancedResult.qualityScore]
      };
    }
  }
  
  // Fallback to basic detection
  return basicDetection(targetEmbedding, labelEmbeddings);
}

function basicDetection(
  targetEmbedding: tf.Tensor, 
  labelEmbeddings: { [key: string]: TrainingExample[] }
): DetectionResult | null {
  let bestMatch = null;
  let bestAvgSimilarity = -1;
  let bestIndividualScores: number[] = [];
  
  console.log('Basic trait detection for labels:', Object.keys(labelEmbeddings));
  
  for (const [label, examples] of Object.entries(labelEmbeddings)) {
    if (examples.length === 0) continue;
    
    const similarities: number[] = [];
    
    for (const example of examples) {
      const similarity = cosineSimilarity(targetEmbedding, example.embedding);
      similarities.push(similarity);
    }
    
    const avgSim = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    const maxSim = Math.max(...similarities);
    
    // Use max similarity as primary metric with average as secondary
    const compositeScore = maxSim * 0.7 + avgSim * 0.3;
    
    console.log(`Label "${label}": avg = ${avgSim.toFixed(3)}, max = ${maxSim.toFixed(3)}, composite = ${compositeScore.toFixed(3)}`);
    
    if (compositeScore > bestAvgSimilarity) {
      bestAvgSimilarity = compositeScore;
      bestMatch = label;
      bestIndividualScores = similarities;
    }
  }
  
  if (!bestMatch) {
    return null;
  }
  
  const threshold = 0.72; // Slightly lower threshold for basic detection
  
  if (bestAvgSimilarity > threshold) {
    console.log(`✅ Match: "${bestMatch}" confidence: ${bestAvgSimilarity.toFixed(3)}`);
    
    return {
      label: bestMatch,
      confidence: bestAvgSimilarity,
      avgSimilarity: bestAvgSimilarity,
      individualScores: bestIndividualScores
    };
  }
  
  console.log(`❌ No confident match. Best: ${bestAvgSimilarity.toFixed(3)} < ${threshold.toFixed(3)}`);
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

// Enhanced conflict resolution
export function resolveTraitConflicts(detectedTraits: { [key: string]: any }): { [key: string]: any } {
  const resolved = { ...detectedTraits };
  
  // Define conflicting trait pairs
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
      // Keep the one with higher confidence
      const trait1Confidence = Math.max(...trait1Keys.map(key => resolved[key].confidence || 0));
      const trait2Confidence = Math.max(...trait2Keys.map(key => resolved[key].confidence || 0));
      
      if (trait1Confidence > trait2Confidence) {
        trait2Keys.forEach(key => delete resolved[key]);
        console.log(`Conflict resolved: Kept ${trait1} (${trait1Confidence.toFixed(3)}) over ${trait2} (${trait2Confidence.toFixed(3)})`);
      } else {
        trait1Keys.forEach(key => delete resolved[key]);
        console.log(`Conflict resolved: Kept ${trait2} (${trait2Confidence.toFixed(3)}) over ${trait1} (${trait1Confidence.toFixed(3)})`);
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

// Enhanced validation with detailed analysis
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
      
      if (confidence < 0.75) {
        lowConfidenceCount++;
      } else {
        detectedTraits++;
      }
      
      totalPossibleTraits++;
    });
  });
  
  const accuracy = totalPredictions > 0 ? totalConfidence / totalPredictions : 0;
  const detectionRate = totalPossibleTraits > 0 ? detectedTraits / totalPossibleTraits : 0;
  
  const avgConfidence = confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length;
  const variance = confidenceScores.reduce((sum, conf) => sum + Math.pow(conf - avgConfidence, 2), 0) / confidenceScores.length;
  const consistencyScore = Math.max(0, 1 - Math.sqrt(variance));
  
  if (accuracy < 0.75) {
    recommendations.push('Overall accuracy is low. Add more diverse training examples.');
  }
  
  if (detectionRate < 0.6) {
    recommendations.push('Low detection rate. Consider using the Training Manager to add more examples.');
  }
  
  if (consistencyScore < 0.7) {
    recommendations.push('Inconsistent predictions. Review training data quality using Training Manager.');
  }
  
  if (lowConfidenceCount > totalPredictions * 0.4) {
    recommendations.push('Many low-confidence predictions. Add more high-quality training examples.');
  }
  
  return {
    accuracy,
    lowConfidenceCount,
    recommendations,
    detectionRate,
    consistencyScore
  };
}

function checkForConflicts(attributes: any[]): string[] {
  const conflicts: string[] = [];
  const traitTypes = attributes.map(attr => attr.trait_type.toLowerCase());
  
  if (traitTypes.includes('shorts') && traitTypes.includes('pants')) {
    conflicts.push('shorts vs pants');
  }
  
  return conflicts;
}

// New utility for training data analysis
export function analyzeTrainingData(trainedTraits: any): {
  totalExamples: number;
  categoryCounts: { [key: string]: number };
  recommendations: string[];
  qualityScore: number;
} {
  const analysis = enhancedDetector.analyzeTrainingQuality(trainedTraits);
  
  let totalExamples = 0;
  const categoryCounts: { [key: string]: number } = {};
  
  Object.entries(trainedTraits).forEach(([category, values]: [string, any]) => {
    let categoryTotal = 0;
    Object.entries(values).forEach(([value, examples]: [string, any]) => {
      const count = examples.length;
      categoryTotal += count;
      totalExamples += count;
    });
    categoryCounts[category] = categoryTotal;
  });
  
  return {
    totalExamples,
    categoryCounts,
    recommendations: analysis.recommendations,
    qualityScore: analysis.overallQuality
  };
}
