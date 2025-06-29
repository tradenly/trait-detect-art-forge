
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
    // Initialize with conservative thresholds
    this.adaptiveThresholds.set('default', 0.75);
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
      if (examples.length === 0) continue;

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

      // Quality score based on consistency and sample size
      const consistencyScore = Math.max(0, 1 - Math.sqrt(variance));
      const sampleScore = Math.min(1, examples.length / 8); // Optimal around 8 samples
      const quality = (consistencyScore * 0.7 + sampleScore * 0.3);

      categoryQuality.set(category, quality);
      this.categoryStats.set(category, { avgSimilarity: avgSim, variance: variance });
      
      totalQuality += quality;
      categoryCount++;

      // Generate specific recommendations
      if (examples.length < 3) {
        recommendations.push(`${category}: Add more examples (${examples.length}/3 minimum)`);
      } else if (examples.length < 5) {
        recommendations.push(`${category}: Consider adding more diverse examples for better accuracy`);
      }

      if (variance > 0.2) {
        recommendations.push(`${category}: Training examples are inconsistent - review for quality`);
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

    // Adaptive threshold based on training data quality
    let threshold = 0.75; // Base threshold

    // Adjust based on consistency
    if (stats.variance < 0.1) {
      threshold -= 0.05; // Lower threshold for consistent data
    } else if (stats.variance > 0.2) {
      threshold += 0.05; // Higher threshold for inconsistent data
    }

    // Adjust based on sample size
    if (examples.length >= 8) {
      threshold -= 0.02; // Slightly lower for well-trained categories
    } else if (examples.length < 4) {
      threshold += 0.03; // Higher for poorly trained categories
    }

    // Clamp threshold to reasonable range
    threshold = Math.max(0.65, Math.min(0.85, threshold));
    
    this.adaptiveThresholds.set(category, threshold);
    console.log(`Updated adaptive threshold for ${category}: ${threshold.toFixed(3)}`);
  }

  public enhancedDetection(
    targetEmbedding: tf.Tensor,
    labelEmbeddings: { [key: string]: TrainingExample[] },
    category: string
  ): EnhancedDetectionResult | null {
    if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
      return null;
    }

    let bestMatch: string | null = null;
    let bestScore = -1;
    let bestSimilarity = -1;
    let bestConsistency = 0;
    const allScores: { [key: string]: number[] } = {};

    // Enhanced similarity calculation with multiple techniques
    for (const [label, examples] of Object.entries(labelEmbeddings)) {
      if (examples.length === 0) continue;

      const similarities: number[] = [];
      
      // Calculate similarities with all examples
      for (const example of examples) {
        const similarity = this.enhancedCosineSimilarity(targetEmbedding, example.embedding);
        similarities.push(similarity);
      }

      // Multiple scoring approaches
      const maxSim = Math.max(...similarities);
      const avgSim = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
      const medianSim = this.calculateMedian(similarities);
      
      // Consistency score
      const variance = similarities.reduce((sum, sim) => sum + Math.pow(sim - avgSim, 2), 0) / similarities.length;
      const consistencyScore = Math.max(0, 1 - Math.sqrt(variance));

      // Weighted composite score
      const compositeScore = (
        maxSim * 0.4 +         // Best match weight
        avgSim * 0.3 +         // Average performance
        medianSim * 0.2 +      // Robust central tendency
        consistencyScore * 0.1  // Consistency bonus
      );

      allScores[label] = similarities;

      console.log(`Enhanced detection for ${label}: max=${maxSim.toFixed(3)}, avg=${avgSim.toFixed(3)}, median=${medianSim.toFixed(3)}, consistency=${consistencyScore.toFixed(3)}, composite=${compositeScore.toFixed(3)}`);

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestMatch = label;
        bestSimilarity = maxSim;
        bestConsistency = consistencyScore;
      }
    }

    if (!bestMatch) return null;

    // Use adaptive threshold
    const threshold = this.adaptiveThresholds.get(category) || this.adaptiveThresholds.get('default') || 0.75;
    
    // Enhanced confidence calculation
    const sortedScores = Object.entries(allScores)
      .map(([label, scores]) => ({
        label,
        score: scores.reduce((sum, sim) => sum + sim, 0) / scores.length
      }))
      .sort((a, b) => b.score - a.score);

    let confidence = bestScore;
    
    // Margin-based confidence boost
    if (sortedScores.length > 1) {
      const margin = sortedScores[0].score - sortedScores[1].score;
      confidence = Math.min(1, bestScore + margin * 0.3);
    }

    // Quality-based confidence adjustment
    const qualityScore = bestConsistency * 0.3 + (bestSimilarity > 0.8 ? 0.2 : 0);
    confidence = Math.min(1, confidence + qualityScore);

    console.log(`Final detection: ${bestMatch}, confidence: ${confidence.toFixed(3)}, threshold: ${threshold.toFixed(3)}`);

    if (confidence >= threshold) {
      return {
        label: bestMatch,
        confidence,
        similarity: bestSimilarity,
        consistencyScore: bestConsistency,
        qualityScore: bestScore
      };
    }

    return {
      label: 'Not Detected',
      confidence: bestScore,
      similarity: bestSimilarity,
      consistencyScore: bestConsistency,
      qualityScore: bestScore
    };
  }

  private enhancedCosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
    // Enhanced cosine similarity with numerical stability
    const aFlat = a.flatten();
    const bFlat = b.flatten();
    
    // L2 normalization
    const aNorm = tf.norm(aFlat);
    const bNorm = tf.norm(bFlat);
    
    const aUnit = tf.div(aFlat, tf.maximum(aNorm, 1e-8));
    const bUnit = tf.div(bFlat, tf.maximum(bNorm, 1e-8));
    
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
    
    return Math.max(0, Math.min(1, similarity));
  }

  private calculateMedian(numbers: number[]): number {
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }
}

export const enhancedDetector = new EnhancedDetector();
