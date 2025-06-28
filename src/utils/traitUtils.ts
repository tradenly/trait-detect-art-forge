import { cosineSimilarity } from './embeddingUtils';
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
  labelEmbeddings: { [key: string]: TrainingExample[] }
): DetectionResult | null {
  if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
    return null;
  }
  
  let bestMatch = null;
  let bestAvgSimilarity = -1;
  let bestIndividualScores: number[] = [];
  const allScores: { [key: string]: number[] } = {};
  
  console.log('Enhanced trait detection for labels:', Object.keys(labelEmbeddings));
  
  // Calculate similarity against all examples for each label
  for (const [label, examples] of Object.entries(labelEmbeddings)) {
    if (examples.length === 0) continue;
    
    const similarities: number[] = [];
    
    for (const example of examples) {
      const similarity = cosineSimilarity(targetEmbedding, example.embedding);
      similarities.push(similarity);
    }
    
    // Use weighted average (give more weight to higher similarities)
    const sortedSims = similarities.sort((a, b) => b - a);
    const weights = sortedSims.map((_, i) => Math.pow(0.8, i)); // Exponential decay
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    const weightedAvg = sortedSims.reduce((sum, sim, i) => sum + sim * weights[i], 0) / weightSum;
    
    allScores[label] = similarities;
    
    console.log(`Label "${label}": weighted avg = ${weightedAvg.toFixed(3)}, samples = ${similarities.length}`);
    
    if (weightedAvg > bestAvgSimilarity) {
      bestAvgSimilarity = weightedAvg;
      bestMatch = label;
      bestIndividualScores = similarities;
    }
  }
  
  if (!bestMatch) {
    return null;
  }
  
  // Dynamic threshold based on training data quality
  const minSamples = Math.min(...Object.values(labelEmbeddings).map(ex => ex.length));
  const baseThreshold = 0.75;
  const qualityAdjustment = minSamples >= 5 ? 0.05 : (minSamples >= 3 ? 0.0 : -0.05);
  const dynamicThreshold = baseThreshold + qualityAdjustment;
  
  console.log(`Dynamic threshold: ${dynamicThreshold.toFixed(3)} (base: ${baseThreshold}, adjustment: ${qualityAdjustment})`);
  
  if (bestAvgSimilarity > dynamicThreshold) {
    // Enhanced confidence calculation
    const sortedScores = Object.values(allScores)
      .map(scores => scores.reduce((sum, sim) => sum + sim, 0) / scores.length)
      .sort((a, b) => b - a);
    
    const confidence = sortedScores.length > 1 
      ? Math.min(1, bestAvgSimilarity / Math.max(sortedScores[1], 0.1))
      : bestAvgSimilarity;
    
    // Boost confidence for very consistent predictions
    const consistencyBoost = bestIndividualScores.length > 1 
      ? 1 - (Math.max(...bestIndividualScores) - Math.min(...bestIndividualScores))
      : 0;
    
    const finalConfidence = Math.min(1, confidence + consistencyBoost * 0.1);
    
    console.log(`✅ Match: "${bestMatch}" confidence: ${finalConfidence.toFixed(3)}, consistency: ${consistencyBoost.toFixed(3)}`);
    
    return {
      label: bestMatch,
      confidence: finalConfidence,
      avgSimilarity: bestAvgSimilarity,
      individualScores: bestIndividualScores
    };
  }
  
  console.log(`❌ No confident match. Best: ${bestAvgSimilarity.toFixed(3)} < ${dynamicThreshold.toFixed(3)}`);
  return {
    label: 'Not Detected',
    confidence: bestAvgSimilarity,
    avgSimilarity: bestAvgSimilarity,
    individualScores: bestIndividualScores
  };
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
    // Analyze confidence distribution
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
    
    // Check for conflicting traits
    const hasConflicts = checkForConflicts(result.attributes || []);
    if (hasConflicts.length > 0) {
      recommendations.push(`Conflicting traits detected: ${hasConflicts.join(', ')}. Review training data.`);
    }
  });
  
  const accuracy = totalPredictions > 0 ? totalConfidence / totalPredictions : 0;
  const detectionRate = totalPossibleTraits > 0 ? detectedTraits / totalPossibleTraits : 0;
  
  // Calculate consistency score
  const avgConfidence = confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length;
  const variance = confidenceScores.reduce((sum, conf) => sum + Math.pow(conf - avgConfidence, 2), 0) / confidenceScores.length;
  const consistencyScore = Math.max(0, 1 - Math.sqrt(variance));
  
  // Generate recommendations
  if (accuracy < 0.75) {
    recommendations.push('Overall accuracy is low. Add more diverse training examples.');
  }
  
  if (detectionRate < 0.6) {
    recommendations.push('Low detection rate. Consider lowering confidence thresholds or improving training data.');
  }
  
  if (consistencyScore < 0.7) {
    recommendations.push('Inconsistent predictions. Ensure training examples are high quality and representative.');
  }
  
  if (lowConfidenceCount > totalPredictions * 0.4) {
    recommendations.push('Many low-confidence predictions. Review training data quality and add more examples.');
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
  let totalExamples = 0;
  const categoryCounts: { [key: string]: number } = {};
  const recommendations: string[] = [];
  
  Object.entries(trainedTraits).forEach(([category, values]: [string, any]) => {
    let categoryTotal = 0;
    Object.entries(values).forEach(([value, examples]: [string, any]) => {
      const count = examples.length;
      categoryTotal += count;
      totalExamples += count;
      
      if (count < 3) {
        recommendations.push(`${category} → ${value}: needs more examples (${count}/3 minimum)`);
      }
    });
    categoryCounts[category] = categoryTotal;
  });
  
  // Calculate quality score
  const categories = Object.keys(trainedTraits);
  const avgExamplesPerCategory = totalExamples / categories.length;
  const qualityScore = Math.min(1, avgExamplesPerCategory / 15); // Optimal is ~15 examples per category
  
  if (qualityScore < 0.5) {
    recommendations.push('Overall training data is insufficient. Add more examples across all categories.');
  }
  
  return {
    totalExamples,
    categoryCounts,
    recommendations,
    qualityScore
  };
}
