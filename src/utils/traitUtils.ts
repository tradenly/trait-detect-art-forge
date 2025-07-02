
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

// UNIFIED DETECTION: Only use enhanced detector, remove basic detection fallback
export function findClosestLabel(
  targetEmbedding: tf.Tensor, 
  labelEmbeddings: { [key: string]: TrainingExample[] },
  category?: string
): DetectionResult | null {
  if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
    console.log('❌ Invalid inputs for unified detection');
    return null;
  }
  
  console.log(`🎯 UNIFIED findClosestLabel redirecting to enhancedDetector for ${category || 'unknown'}`);
  
  // UNIFIED: Always use enhanced detector with feedback integration
  const enhancedResult = enhancedDetector.enhancedDetection(targetEmbedding, labelEmbeddings, category || 'unknown');
  
  if (!enhancedResult) {
    return null;
  }
  
  // Convert enhanced result to legacy format for compatibility
  return {
    label: enhancedResult.label,
    confidence: enhancedResult.confidence,
    avgSimilarity: enhancedResult.similarity,
    individualScores: [enhancedResult.similarity] // Simplified for compatibility
  };
}

// Simplified conflict resolution - now handled by unified detection
export function resolveTraitConflicts(detectedTraits: { [key: string]: any }): { [key: string]: any } {
  const resolved = { ...detectedTraits };
  
  // Minimal conflict resolution since unified detection handles most conflicts
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
      
      // Only resolve significant confidence differences (unified approach)
      if (Math.abs(trait1Confidence - trait2Confidence) > 0.15) {
        if (trait1Confidence > trait2Confidence) {
          trait2Keys.forEach(key => delete resolved[key]);
          console.log(`🔧 Unified conflict resolved: Kept ${trait1} (${trait1Confidence.toFixed(3)}) over ${trait2} (${trait2Confidence.toFixed(3)})`);
        } else {
          trait1Keys.forEach(key => delete resolved[key]);
          console.log(`🔧 Unified conflict resolved: Kept ${trait2} (${trait2Confidence.toFixed(3)}) over ${trait1} (${trait1Confidence.toFixed(3)})`);
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

// Enhanced validation with unified detection metrics
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
      
      // Updated threshold to match unified system
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
  
  const avgConfidence = confidenceScores.length > 0 ? 
    confidenceScores.reduce((sum, conf) => sum + conf, 0) / confidenceScores.length : 0;
  const variance = confidenceScores.length > 0 ? 
    confidenceScores.reduce((sum, conf) => sum + Math.pow(conf - avgConfidence, 2), 0) / confidenceScores.length : 0;
  const consistencyScore = Math.max(0, 1 - Math.sqrt(variance));
  
  // Updated recommendations for unified system
  if (accuracy < 0.75) {
    recommendations.push('Overall accuracy is low. Add more diverse, high-quality training examples.');
  }
  
  if (detectionRate < 0.35) {
    recommendations.push('Low detection rate. Consider reviewing training data quality or providing more feedback.');
  }
  
  if (consistencyScore < 0.65) {
    recommendations.push('Inconsistent predictions. Review training data quality and provide user feedback.');
  }
  
  if (lowConfidenceCount > totalPredictions * 0.6) {
    recommendations.push('Many low-confidence predictions. Add clear training examples and use feedback system.');
  }
  
  return {
    accuracy,
    lowConfidenceCount,
    recommendations,
    detectionRate,
    consistencyScore
  };
}

// Enhanced training data analysis for unified system
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
      
      // Enhanced quality scoring for unified system
      let valueQuality = 0;
      if (count >= 8) valueQuality = 1.0;
      else if (count >= 5) valueQuality = 0.85; // Higher score for moderate samples
      else if (count >= 3) valueQuality = 0.65; // More lenient for unified system
      else valueQuality = 0.35;
      
      categoryQuality += valueQuality;
      valueCount++;
      
      // Updated recommendations for unified system
      if (count < 3) {
        recommendations.push(`${category}: ${value} needs more examples (${count}/3 minimum for unified system)`);
      }
    });
    
    categoryCounts[category] = categoryTotal;
    
    if (valueCount > 0) {
      qualityTotal += (categoryQuality / valueCount);
      categoryCount++;
    }
    
    // Updated category recommendations
    if (categoryTotal < 12) {
      recommendations.push(`${category} category needs more examples (${categoryTotal}/12 recommended for unified system)`);
    }
  });
  
  const qualityScore = categoryCount > 0 ? qualityTotal / categoryCount : 0;
  
  // Updated overall recommendations
  if (totalExamples < 40) {
    recommendations.push('Add more training examples across all categories for unified system optimization');
  }
  
  return {
    totalExamples,
    categoryCounts,
    recommendations,
    qualityScore
  };
}
