
import { calculateAdvancedSimilarity } from './advancedEmbeddingUtils';
import * as tf from '@tensorflow/tfjs';

interface AdvancedDetectionResult {
  label: string;
  confidence: number;
  similarityScores: {
    cosine: number;
    euclidean: number;
    manhattan: number;
    composite: number;
  };
  consensusScore: number;
  evidenceStrength: number;
}

// Advanced ensemble detection with multiple algorithms
export function findBestTraitMatch(
  targetEmbedding: tf.Tensor,
  labelEmbeddings: { [key: string]: any[] },
  options: {
    minConsensus: number;
    evidenceThreshold: number;
    useEnsemble: boolean;
  } = {
    minConsensus: 0.7,
    evidenceThreshold: 0.75,
    useEnsemble: true
  }
): AdvancedDetectionResult | null {
  
  if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
    return null;
  }
  
  console.log('🔬 Running advanced trait detection with ensemble methods');
  
  let bestMatch: AdvancedDetectionResult | null = null;
  let bestScore = -1;
  
  for (const [label, examples] of Object.entries(labelEmbeddings)) {
    if (examples.length === 0) continue;
    
    const allSimilarities: any[] = [];
    
    // Calculate advanced similarities with all examples
    for (const example of examples) {
      const similarities = calculateAdvancedSimilarity(targetEmbedding, example.embedding);
      allSimilarities.push(similarities);
    }
    
    // Ensemble scoring with multiple strategies
    const scores = {
      cosine: allSimilarities.map(s => s.cosine),
      euclidean: allSimilarities.map(s => s.euclidean),
      manhattan: allSimilarities.map(s => s.manhattan),
      composite: allSimilarities.map(s => s.composite)
    };
    
    // Calculate consensus across different similarity metrics
    const consensusScores = Object.values(scores).map(metricScores => {
      const sorted = metricScores.sort((a, b) => b - a);
      // Weighted average favoring top matches
      const weights = sorted.map((_, i) => Math.pow(0.8, i));
      const weightSum = weights.reduce((sum, w) => sum + w, 0);
      return sorted.reduce((sum, score, i) => sum + score * weights[i], 0) / weightSum;
    });
    
    const avgConsensus = consensusScores.reduce((sum, score) => sum + score, 0) / consensusScores.length;
    const consensusVariance = consensusScores.reduce((sum, score) => sum + Math.pow(score - avgConsensus, 2), 0) / consensusScores.length;
    const consensusScore = avgConsensus * (1 - Math.sqrt(consensusVariance)); // Penalize high variance
    
    // Evidence strength based on consistency and number of examples
    const evidenceStrength = Math.min(1, (examples.length / 5) * consensusScore);
    
    const avgSimilarities = {
      cosine: scores.cosine.reduce((sum, s) => sum + s, 0) / scores.cosine.length,
      euclidean: scores.euclidean.reduce((sum, s) => sum + s, 0) / scores.euclidean.length,
      manhattan: scores.manhattan.reduce((sum, s) => sum + s, 0) / scores.manhattan.length,
      composite: scores.composite.reduce((sum, s) => sum + s, 0) / scores.composite.length
    };
    
    console.log(`📊 ${label}: consensus=${consensusScore.toFixed(3)}, evidence=${evidenceStrength.toFixed(3)}, examples=${examples.length}`);
    
    if (consensusScore > bestScore) {
      bestScore = consensusScore;
      bestMatch = {
        label,
        confidence: consensusScore,
        similarityScores: avgSimilarities,
        consensusScore,
        evidenceStrength
      };
    }
  }
  
  if (!bestMatch) return null;
  
  // Dynamic thresholding based on evidence quality
  const dynamicThreshold = Math.max(
    options.minConsensus,
    0.8 - (bestMatch.evidenceStrength * 0.1) // Lower threshold for high evidence
  );
  
  console.log(`🎯 Best match: ${bestMatch.label} (${bestMatch.consensusScore.toFixed(3)}) vs threshold (${dynamicThreshold.toFixed(3)})`);
  
  if (bestMatch.consensusScore >= dynamicThreshold && bestMatch.evidenceStrength >= options.evidenceThreshold) {
    console.log(`✅ DETECTED: ${bestMatch.label} with high confidence`);
    return bestMatch;
  } else {
    console.log(`❌ NOT DETECTED: Score too low or insufficient evidence`);
    return {
      ...bestMatch,
      label: 'Not Detected',
      confidence: bestMatch.consensusScore
    };
  }
}

// Quality-based training data analysis
export function analyzeTrainingQuality(trainedTraits: { [category: string]: { [value: string]: any[] } }): {
  overallQuality: number;
  categoryAnalysis: { [key: string]: { quality: number; recommendations: string[] } };
  recommendations: string[];
} {
  const categoryAnalysis: any = {};
  const overallRecommendations: string[] = [];
  let totalQuality = 0;
  let categoryCount = 0;
  
  for (const [category, values] of Object.entries(trainedTraits)) {
    const valueAnalysis: any = {};
    let categoryQuality = 0;
    let valueCount = 0;
    const categoryRecommendations: string[] = [];
    
    for (const [value, examples] of Object.entries(values)) {
      const exampleCount = examples.length;
      
      // Quality scoring based on research best practices
      let valueQuality = 0;
      if (exampleCount >= 8) valueQuality = 1.0;        // Excellent
      else if (exampleCount >= 5) valueQuality = 0.8;   // Good
      else if (exampleCount >= 3) valueQuality = 0.6;   // Acceptable
      else valueQuality = 0.3;                          // Poor
      
      valueAnalysis[value] = { quality: valueQuality, count: exampleCount };
      categoryQuality += valueQuality;
      valueCount++;
      
      if (exampleCount < 5) {
        categoryRecommendations.push(`${value}: Add ${5 - exampleCount} more examples`);
      }
    }
    
    categoryQuality /= valueCount;
    categoryAnalysis[category] = {
      quality: categoryQuality,
      recommendations: categoryRecommendations
    };
    
    totalQuality += categoryQuality;
    categoryCount++;
    
    if (categoryQuality < 0.7) {
      overallRecommendations.push(`${category}: Needs more diverse, high-quality examples`);
    }
  }
  
  const overallQuality = totalQuality / categoryCount;
  
  if (overallQuality < 0.7) {
    overallRecommendations.push('Overall training quality is below optimal. Focus on adding 5-8 high-quality examples per trait value.');
  }
  
  return {
    overallQuality,
    categoryAnalysis,
    recommendations: overallRecommendations
  };
}
