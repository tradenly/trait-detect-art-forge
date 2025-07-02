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

// Enhanced conflict resolution with strict mutual exclusion rules
export function resolveTraitConflicts(detectedTraits: { [key: string]: any }): { [key: string]: any } {
  const resolved = { ...detectedTraits };
  
  console.log('🔧 Starting enhanced conflict resolution...');
  console.log('🔍 Input traits:', Object.keys(resolved));
  
  // Define strict mutual exclusion groups
  const mutuallyExclusiveGroups = [
    {
      name: 'lower_body',
      traits: ['shorts', 'pants', 'skirt', 'dress'],
      description: 'Only one lower body garment allowed'
    },
    {
      name: 'upper_body',
      traits: ['shirt', 'tank_top', 'hoodie', 'jacket'],
      description: 'Only one primary upper body garment allowed'
    },
    {
      name: 'headwear',
      traits: ['hat', 'cap', 'beanie', 'helmet'],
      description: 'Only one headwear item allowed'
    }
  ];
  
  // Process each mutual exclusion group
  for (const group of mutuallyExclusiveGroups) {
    const conflictingTraits: Array<{key: string, confidence: number, trait: string}> = [];
    
    // Find all traits in this group that were detected
    for (const [traitKey, traitValue] of Object.entries(resolved)) {
      for (const groupTrait of group.traits) {
        if (traitKey.toLowerCase().includes(groupTrait) || 
            (typeof traitValue === 'string' && traitValue.toLowerCase().includes(groupTrait))) {
          
          // Get confidence from confidenceScores if available, otherwise estimate
          const confidence = resolved.confidenceScores?.[traitKey] || 0.5;
          conflictingTraits.push({
            key: traitKey,
            confidence: confidence,
            trait: groupTrait
          });
        }
      }
    }
    
    // If we have conflicts in this group, resolve them
    if (conflictingTraits.length > 1) {
      console.log(`⚠️ CONFLICT in ${group.name}: Found ${conflictingTraits.length} conflicting traits`);
      conflictingTraits.forEach(item => {
        console.log(`   - ${item.key}: ${item.trait} (confidence: ${item.confidence.toFixed(3)})`);
      });
      
      // Sort by confidence and keep only the highest confidence trait
      conflictingTraits.sort((a, b) => b.confidence - a.confidence);
      const winner = conflictingTraits[0];
      const losers = conflictingTraits.slice(1);
      
      // Remove the losing traits
      losers.forEach(loser => {
        console.log(`❌ REMOVING conflicting trait: ${loser.key} (${loser.confidence.toFixed(3)}) - lost to ${winner.key} (${winner.confidence.toFixed(3)})`);
        delete resolved[loser.key];
      });
      
      console.log(`✅ CONFLICT RESOLVED: Kept ${winner.key} as winner in ${group.name} group`);
    }
  }
  
  // Additional specific conflict rules
  const specificConflicts = [
    // Shorts vs Pants - most common conflict
    {
      check: () => {
        const shortsKeys = Object.keys(resolved).filter(key => 
          key.toLowerCase().includes('shorts') || 
          (typeof resolved[key] === 'string' && resolved[key].toLowerCase().includes('shorts'))
        );
        const pantsKeys = Object.keys(resolved).filter(key => 
          key.toLowerCase().includes('pants') || 
          (typeof resolved[key] === 'string' && resolved[key].toLowerCase().includes('pants'))
        );
        return { shortsKeys, pantsKeys };
      },
      resolve: () => {
        const { shortsKeys, pantsKeys } = specificConflicts[0].check();
        if (shortsKeys.length > 0 && pantsKeys.length > 0) {
          const shortsConf = Math.max(...shortsKeys.map(key => resolved.confidenceScores?.[key] || 0.5));
          const pantsConf = Math.max(...pantsKeys.map(key => resolved.confidenceScores?.[key] || 0.5));
          
          console.log(`⚠️ SPECIFIC CONFLICT: Shorts vs Pants - shorts: ${shortsConf.toFixed(3)}, pants: ${pantsConf.toFixed(3)}`);
          
          if (Math.abs(shortsConf - pantsConf) > 0.1) {
            if (shortsConf > pantsConf) {
              pantsKeys.forEach(key => {
                console.log(`❌ REMOVING pants trait: ${key} (lost to shorts)`);
                delete resolved[key];
              });
            } else {
              shortsKeys.forEach(key => {
                console.log(`❌ REMOVING shorts trait: ${key} (lost to pants)`);
                delete resolved[key];
              });
            }
          } else {
            // If confidence is too close, remove both to avoid false positives
            console.log(`❌ REMOVING BOTH shorts and pants (confidence too close - likely false positive)`);
            [...shortsKeys, ...pantsKeys].forEach(key => delete resolved[key]);
          }
        }
      }
    }
  ];
  
  // Apply specific conflict resolution
  specificConflicts.forEach(conflict => conflict.resolve());
  
  console.log('✅ Conflict resolution complete');
  console.log('🔍 Final traits:', Object.keys(resolved));
  
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

// Smart feedback processing - distinguish between corrections and instructions
export function processFeedbackInput(input: string, detectedValue: string, category: string): {
  isInstruction: boolean;
  cleanedValue: string;
  shouldApplyToMetadata: boolean;
} {
  const inputLower = input.toLowerCase().trim();
  const detectedLower = detectedValue.toLowerCase();
  
  // Instruction patterns that should NOT appear in metadata
  const instructionPatterns = [
    /^no\s+\w+\s+in\s+(this\s+)?image/,
    /^not\s+detected/,
    /^none\s+present/,
    /^incorrect\s+detection/,
    /^wrong\s+detection/,
    /^should\s+not\s+be/,
    /^remove\s+this/,
    /^delete\s+this/,
    /^false\s+positive/,
    /^ai\s+detected.*wrong/,
    /^both.*detected.*wrong/,
    /contains.*sentence/,
    /^this\s+is\s+wrong/
  ];
  
  // Check if input is an instruction rather than a trait value
  const isInstruction = instructionPatterns.some(pattern => pattern.test(inputLower));
  
  // If it's an instruction, don't put it in metadata
  if (isInstruction) {
    console.log(`📝 INSTRUCTION DETECTED: "${input}" - will not appear in metadata`);
    return {
      isInstruction: true,
      cleanedValue: input, // Keep original for AI learning
      shouldApplyToMetadata: false
    };
  }
  
  // For simple color/trait corrections, clean and apply to metadata
  const colorWords = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 'orange', 'pink', 'brown', 'gray', 'grey'];
  const isSimpleCorrection = colorWords.some(color => inputLower.includes(color)) && inputLower.split(' ').length <= 3;
  
  if (isSimpleCorrection) {
    console.log(`🎨 COLOR CORRECTION: "${input}" - will appear in metadata`);
    return {
      isInstruction: false,
      cleanedValue: input.trim(),
      shouldApplyToMetadata: true
    };
  }
  
  // For other short corrections (likely trait values)
  if (input.length < 20 && !inputLower.includes('image') && !inputLower.includes('detected')) {
    console.log(`✏️ TRAIT CORRECTION: "${input}" - will appear in metadata`);
    return {
      isInstruction: false,
      cleanedValue: input.trim(),
      shouldApplyToMetadata: true
    };
  }
  
  // Default to instruction for longer or complex inputs
  console.log(`📝 COMPLEX INPUT TREATED AS INSTRUCTION: "${input}" - will not appear in metadata`);
  return {
    isInstruction: true,
    cleanedValue: input,
    shouldApplyToMetadata: false
  };
}

// Enhanced validation with unified detection metrics
export function validateDetectionResults(results: any[]): { 
  accuracy: number; 
  lowConfidenceCount: number; 
  recommendations: string[];
  detectionRate: number;
  consistencyScore: number;
  conflictRate: number;
} {
  const recommendations: string[] = [];
  let lowConfidenceCount = 0;
  let totalConfidence = 0;
  let totalPredictions = 0;
  let detectedTraits = 0;
  let totalPossibleTraits = 0;
  let conflicts = 0;
  
  const confidenceScores: number[] = [];
  
  results.forEach(result => {
    // Check for conflicts in this result
    const traits = Object.keys(result.detectedTraits || {});
    const hasConflict = (
      traits.some(t => t.toLowerCase().includes('shorts')) && 
      traits.some(t => t.toLowerCase().includes('pants'))
    );
    if (hasConflict) conflicts++;
    
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
  const conflictRate = results.length > 0 ? conflicts / results.length : 0;
  
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
  
  if (conflictRate > 0.1) {
    recommendations.push('High conflict rate detected. Improve training data separation between mutually exclusive traits.');
  }
  
  if (lowConfidenceCount > totalPredictions * 0.6) {
    recommendations.push('Many low-confidence predictions. Add clear training examples and use feedback system.');
  }
  
  return {
    accuracy,
    lowConfidenceCount,
    recommendations,
    detectionRate,
    consistencyScore,
    conflictRate
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
