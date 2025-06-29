
import * as tf from '@tensorflow/tfjs';
import { cosineSimilarity } from './embeddingUtils';

interface TrainingExample {
  embedding: tf.Tensor;
  fileName: string;
  imageUrl: string;
}

interface EnhancedDetectionResult {
  label: string;
  confidence: number;
  similarity: number;
  consistencyScore: number;
  qualityScore: number;
}

export class EnhancedDetector {
  private adaptiveThresholds: Map<string, number> = new Map();
  private categoryStats: Map<string, { avgSimilarity: number; variance: number }> = new Map();

  constructor() {
    this.initializeAdaptiveThresholds();
  }

  private initializeAdaptiveThresholds() {
    // Initialize with much stricter thresholds
    this.adaptiveThresholds.set('default', 0.80);
  }

  public analyzeTrainingQuality(labelEmbeddings: { [key: string]: TrainingExample[] }): {
    categoryQuality: Map<string, number>;
    overallQuality: number;
    recommendations: string[];
  } {
    const categoryQuality = new Map<string, number>();
    const recommendations: string[] = [];
    let totalQuality = 0;
    let categoryCount = 0;

    for (const [category, examples] of Object.entries(labelEmbeddings)) {
      if (examples.length === 0) {
        categoryQuality.set(category, 0);
        recommendations.push(`${category}: No training examples found`);
        continue;
      }

      // Calculate intra-category similarity variance
      const similarities: number[] = [];
      for (let i = 0; i < examples.length; i++) {
        for (let j = i + 1; j < examples.length; j++) {
          const sim = cosineSimilarity(examples[i].embedding, examples[j].embedding);
          similarities.push(sim);
        }
      }

      const avgSim = similarities.length > 0 ? 
        similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length : 0;
      
      const variance = similarities.length > 1 ? 
        similarities.reduce((sum, sim) => sum + Math.pow(sim - avgSim, 2), 0) / similarities.length : 0;

      // Stricter quality requirements
      const consistencyScore = Math.max(0, 1 - Math.sqrt(variance * 2));
      const sampleScore = Math.min(1, examples.length / 8);
      const quality = (consistencyScore * 0.8 + sampleScore * 0.2); // Prioritize consistency more

      categoryQuality.set(category, quality);
      this.categoryStats.set(category, { avgSimilarity: avgSim, variance: variance });
      
      totalQuality += quality;
      categoryCount++;

      // More specific recommendations
      if (examples.length < 3) {
        recommendations.push(`${category}: Critical - Add more examples (${examples.length}/3 minimum)`);
      } else if (examples.length < 5) {
        recommendations.push(`${category}: Add more examples for better accuracy (${examples.length}/5 recommended)`);
      }

      if (variance > 0.15) { // Stricter variance threshold
        recommendations.push(`${category}: Training examples are too inconsistent - review image quality`);
      }
      
      if (avgSim > 0.95) {
        recommendations.push(`${category}: Training examples may be too similar - add more variety`);
      }
    }

    const overallQuality = categoryCount > 0 ? totalQuality / categoryCount : 0;

    return {
      categoryQuality,
      overallQuality,
      recommendations
    };
  }

  public updateAdaptiveThresholds(category: string, examples: TrainingExample[]) {
    if (examples.length < 2) return;

    const stats = this.categoryStats.get(category);
    if (!stats) return;

    // Much more conservative threshold adjustment
    let threshold = 0.80; // Higher base threshold

    // Adjust based on consistency
    if (stats.variance < 0.05) {
      threshold -= 0.02; // Small reduction for very consistent data
    } else if (stats.variance > 0.15) {
      threshold += 0.05; // Significant increase for inconsistent data
    }

    // Adjust based on sample size
    if (examples.length >= 8) {
      threshold -= 0.01; // Minimal reduction for well-trained categories
    } else if (examples.length < 4) {
      threshold += 0.05; // Significant increase for poorly trained categories
    }

    // Clamp threshold to strict range
    threshold = Math.max(0.75, Math.min(0.88, threshold));
    
    this.adaptiveThresholds.set(category, threshold);
    console.log(`🎯 Updated adaptive threshold for ${category}: ${threshold.toFixed(3)} (${examples.length} examples, variance: ${stats.variance.toFixed(3)})`);
  }

  public enhancedDetection(
    targetEmbedding: tf.Tensor,
    labelEmbeddings: { [key: string]: TrainingExample[] },
    category: string
  ): EnhancedDetectionResult | null {
    if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
      console.log('❌ Invalid inputs for enhanced detection');
      return null;
    }

    let bestMatch: string | null = null;
    let bestScore = -1;
    let bestSimilarity = -1;
    let bestConsistency = 0;

    console.log(`🔍 Enhanced detection for ${category} with ${Object.keys(labelEmbeddings).length} labels`);

    // More conservative similarity calculation
    for (const [label, examples] of Object.entries(labelEmbeddings)) {
      if (examples.length === 0) continue;

      const similarities: number[] = [];
      
      for (const example of examples) {
        const similarity = this.enhancedCosineSimilarity(targetEmbedding, example.embedding);
        similarities.push(similarity);
      }

      const maxSim = Math.max(...similarities);
      const avgSim = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
      const minSim = Math.min(...similarities);
      
      // Stricter consistency scoring
      const variance = similarities.reduce((sum, sim) => sum + Math.pow(sim - avgSim, 2), 0) / similarities.length;
      const consistencyScore = Math.max(0, 1 - Math.sqrt(variance * 3)); // More penalty for variance

      // Conservative composite score - require high max similarity AND good consistency
      const compositeScore = (
        maxSim * 0.6 +         // Higher weight on best match
        avgSim * 0.2 +         // Lower weight on average
        consistencyScore * 0.2  // Consistency requirement
      );

      console.log(`Label "${label}": max=${maxSim.toFixed(3)}, avg=${avgSim.toFixed(3)}, min=${minSim.toFixed(3)}, consistency=${consistencyScore.toFixed(3)}, composite=${compositeScore.toFixed(3)}`);

      // Only update best match if significantly better
      if (compositeScore > bestScore + 0.01) { // Require meaningful improvement
        bestScore = compositeScore;
        bestMatch = label;
        bestSimilarity = maxSim;
        bestConsistency = consistencyScore;
      }
    }

    if (!bestMatch) {
      console.log('❌ No match found in enhanced detection');
      return null;
    }

    // Use much stricter adaptive threshold
    const threshold = this.adaptiveThresholds.get(category) || this.adaptiveThresholds.get('default') || 0.80;
    
    // Additional requirements for acceptance
    const minConsistency = 0.7; // Require good consistency
    const minSimilarity = 0.75; // Require high similarity

    console.log(`🎯 Enhanced result: ${bestMatch}, score: ${bestScore.toFixed(3)}, similarity: ${bestSimilarity.toFixed(3)}, consistency: ${bestConsistency.toFixed(3)}, threshold: ${threshold.toFixed(3)}`);

    if (bestScore >= threshold && bestConsistency >= minConsistency && bestSimilarity >= minSimilarity) {
      console.log(`✅ ENHANCED ACCEPTED: "${bestMatch}"`);
      return {
        label: bestMatch,
        confidence: bestScore,
        similarity: bestSimilarity,
        consistencyScore: bestConsistency,
        qualityScore: bestScore
      };
    }

    console.log(`❌ ENHANCED REJECTED: score ${bestScore.toFixed(3)} < ${threshold.toFixed(3)} OR consistency ${bestConsistency.toFixed(3)} < ${minConsistency} OR similarity ${bestSimilarity.toFixed(3)} < ${minSimilarity}`);
    return {
      label: 'Not Detected',
      confidence: bestScore,
      similarity: bestSimilarity,
      consistencyScore: bestConsistency,
      qualityScore: bestScore
    };
  }

  private enhancedCosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
    // More robust cosine similarity with better numerical stability
    const aFlat = a.flatten();
    const bFlat = b.flatten();
    
    if (aFlat.shape[0] !== bFlat.shape[0]) {
      console.warn('Tensor shape mismatch in enhanced similarity');
      aFlat.dispose();
      bFlat.dispose();
      return 0;
    }
    
    // L2 normalization with larger epsilon for stability
    const aNorm = tf.norm(aFlat);
    const bNorm = tf.norm(bFlat);
    
    const aUnit = tf.div(aFlat, tf.maximum(aNorm, 1e-6));
    const bUnit = tf.div(bFlat, tf.maximum(bNorm, 1e-6));
    
    const dotProduct = tf.sum(tf.mul(aUnit, bUnit));
    const similarity = dotProduct.dataSync()[0];
    
    // Cleanup
    aFlat.dispose();
    bFlat.dispose();
    aNorm.dispose();
    bNorm.dispose();
    aUnit.dispose();
    bUnit.dispose();
    dotProduct.dispose();
    
    // Clamp to valid range with better bounds checking
    return Math.max(-1, Math.min(1, similarity || 0));
  }
}

export const enhancedDetector = new EnhancedDetector();
