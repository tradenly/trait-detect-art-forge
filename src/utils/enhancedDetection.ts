
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

interface FeedbackCorrection {
  imageEmbedding: tf.Tensor;
  wrongLabel: string;
  correctLabel: string;
  category: string;
  fileName: string;
  timestamp: number;
}

export class EnhancedDetector {
  private adaptiveThresholds: Map<string, number> = new Map();
  private categoryStats: Map<string, { avgSimilarity: number; variance: number }> = new Map();
  private feedbackCorrections: Map<string, FeedbackCorrection[]> = new Map();

  constructor() {
    this.initializeAdaptiveThresholds();
  }

  private initializeAdaptiveThresholds() {
    // Initialize with balanced thresholds for better feedback integration
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

      // Balanced quality scoring that works well with feedback
      const consistencyScore = Math.max(0, 1 - Math.sqrt(variance * 1.5));
      const sampleScore = Math.min(1, examples.length / 6);
      const quality = (consistencyScore * 0.7 + sampleScore * 0.3);

      categoryQuality.set(category, quality);
      this.categoryStats.set(category, { avgSimilarity: avgSim, variance: variance });
      
      totalQuality += quality;
      categoryCount++;

      // Practical recommendations
      if (examples.length < 3) {
        recommendations.push(`${category}: Add more examples (${examples.length}/3 minimum)`);
      } else if (examples.length < 5) {
        recommendations.push(`${category}: Add more examples for better accuracy (${examples.length}/5 recommended)`);
      }

      if (variance > 0.2) {
        recommendations.push(`${category}: Training examples are inconsistent - review image quality`);
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

    // Balanced threshold adjustment that works with feedback
    let threshold = 0.75; // Balanced base threshold

    // Adjust based on consistency
    if (stats.variance < 0.08) {
      threshold -= 0.03; // Small reduction for consistent data
    } else if (stats.variance > 0.2) {
      threshold += 0.05; // Increase for inconsistent data
    }

    // Adjust based on sample size
    if (examples.length >= 6) {
      threshold -= 0.02; // Small reduction for well-trained categories
    } else if (examples.length < 3) {
      threshold += 0.05; // Increase for poorly trained categories
    }

    // Consider feedback corrections for this category
    const corrections = this.feedbackCorrections.get(category);
    if (corrections && corrections.length > 0) {
      // Lower threshold slightly if we have feedback data
      threshold -= 0.02;
      console.log(`🔄 Threshold adjusted for feedback: ${category} has ${corrections.length} corrections`);
    }

    // Clamp threshold to reasonable range
    threshold = Math.max(0.65, Math.min(0.85, threshold));
    
    this.adaptiveThresholds.set(category, threshold);
    console.log(`🎯 Updated adaptive threshold for ${category}: ${threshold.toFixed(3)} (${examples.length} examples, variance: ${stats.variance.toFixed(3)})`);
  }

  public addFeedbackCorrection(
    imageEmbedding: tf.Tensor,
    wrongLabel: string,
    correctLabel: string,
    category: string,
    fileName: string
  ) {
    if (!this.feedbackCorrections.has(category)) {
      this.feedbackCorrections.set(category, []);
    }

    const corrections = this.feedbackCorrections.get(category)!;
    
    // Clone the embedding to avoid disposal issues
    const clonedEmbedding = imageEmbedding.clone();
    
    corrections.push({
      imageEmbedding: clonedEmbedding,
      wrongLabel,
      correctLabel,
      category,
      fileName,
      timestamp: Date.now()
    });

    console.log(`📝 FEEDBACK STORED: ${category}: ${wrongLabel} → ${correctLabel} (${fileName})`);
    console.log(`📊 Total corrections for ${category}: ${corrections.length}`);
    
    // Keep only the last 100 corrections per category to manage memory
    if (corrections.length > 100) {
      const removed = corrections.shift();
      if (removed?.imageEmbedding) {
        removed.imageEmbedding.dispose();
      }
    }

    // Update threshold immediately when feedback is added
    const currentThreshold = this.adaptiveThresholds.get(category) || 0.75;
    const adjustedThreshold = Math.max(0.65, currentThreshold - 0.01); // Small improvement from feedback
    this.adaptiveThresholds.set(category, adjustedThreshold);
    console.log(`🔄 Threshold auto-adjusted for ${category} after feedback: ${adjustedThreshold.toFixed(3)}`);
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

    console.log(`🔍 Enhanced detection for ${category} with ${Object.keys(labelEmbeddings).length} labels`);

    // PRIORITY 1: Check for feedback corrections first
    const correctionResult = this.applyFeedbackCorrections(targetEmbedding, category);
    if (correctionResult) {
      console.log(`✅ FEEDBACK CORRECTION APPLIED: "${correctionResult.label}" for ${category} (confidence: ${correctionResult.confidence.toFixed(3)})`);
      return correctionResult;
    }

    // PRIORITY 2: Standard enhanced detection
    let bestMatch: string | null = null;
    let bestScore = -1;
    let bestSimilarity = -1;
    let bestConsistency = 0;

    for (const [label, examples] of Object.entries(labelEmbeddings)) {
      if (examples.length === 0) continue;

      const similarities: number[] = [];
      
      for (const example of examples) {
        const similarity = this.enhancedCosineSimilarity(targetEmbedding, example.embedding);
        similarities.push(similarity);
      }

      const maxSim = Math.max(...similarities);
      const avgSim = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
      
      // Balanced consistency scoring
      const variance = similarities.reduce((sum, sim) => sum + Math.pow(sim - avgSim, 2), 0) / similarities.length;
      const consistencyScore = Math.max(0, 1 - Math.sqrt(variance * 2));

      // Balanced composite score that works well with feedback
      const compositeScore = (
        maxSim * 0.5 +         // Best match importance
        avgSim * 0.3 +         // Average consistency
        consistencyScore * 0.2  // Consistency bonus
      );

      console.log(`Label "${label}": max=${maxSim.toFixed(3)}, avg=${avgSim.toFixed(3)}, consistency=${consistencyScore.toFixed(3)}, composite=${compositeScore.toFixed(3)}`);

      if (compositeScore > bestScore) {
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

    // Use adaptive threshold with feedback consideration
    const threshold = this.adaptiveThresholds.get(category) || this.adaptiveThresholds.get('default') || 0.75;
    
    // Additional requirements for acceptance (balanced for feedback integration)
    const minConsistency = 0.6; 
    const minSimilarity = 0.70; 

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

  private applyFeedbackCorrections(
    targetEmbedding: tf.Tensor,
    category: string
  ): EnhancedDetectionResult | null {
    const corrections = this.feedbackCorrections.get(category);
    if (!corrections || corrections.length === 0) {
      return null;
    }

    console.log(`🔍 Checking ${corrections.length} feedback corrections for ${category}`);

    let bestMatch: string | null = null;
    let bestSimilarity = -1;
    let bestFileName = '';

    for (const correction of corrections) {
      const similarity = this.enhancedCosineSimilarity(targetEmbedding, correction.imageEmbedding);
      
      // Use balanced threshold for feedback corrections - not too strict, not too loose
      if (similarity > 0.80 && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = correction.correctLabel;
        bestFileName = correction.fileName;
        console.log(`🎯 Strong feedback match found: ${correction.fileName} → ${correction.correctLabel} (similarity: ${similarity.toFixed(3)})`);
      }
    }

    if (bestMatch && bestSimilarity > 0.80) {
      console.log(`✅ APPLYING FEEDBACK CORRECTION: ${bestMatch} (similarity: ${bestSimilarity.toFixed(3)}, source: ${bestFileName})`);
      return {
        label: bestMatch,
        confidence: Math.min(0.95, bestSimilarity + 0.1), // Boost confidence for feedback matches
        similarity: bestSimilarity,
        consistencyScore: 1.0, // High consistency for corrections
        qualityScore: bestSimilarity + 0.1
      };
    }

    return null;
  }

  private enhancedCosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
    // Robust cosine similarity with good numerical stability
    const aFlat = a.flatten();
    const bFlat = b.flatten();
    
    if (aFlat.shape[0] !== bFlat.shape[0]) {
      console.warn('Tensor shape mismatch in enhanced similarity');
      aFlat.dispose();
      bFlat.dispose();
      return 0;
    }
    
    // L2 normalization with stability
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
    
    // Clamp to valid range
    return Math.max(-1, Math.min(1, similarity || 0));
  }

  public clearFeedbackCorrections(category?: string) {
    if (category) {
      const corrections = this.feedbackCorrections.get(category);
      if (corrections) {
        corrections.forEach(correction => correction.imageEmbedding.dispose());
        this.feedbackCorrections.delete(category);
        console.log(`🗑️ Cleared ${corrections.length} feedback corrections for ${category}`);
      }
    } else {
      // Clear all corrections
      let totalCleared = 0;
      this.feedbackCorrections.forEach((corrections, category) => {
        corrections.forEach(correction => correction.imageEmbedding.dispose());
        totalCleared += corrections.length;
      });
      this.feedbackCorrections.clear();
      console.log(`🗑️ Cleared all ${totalCleared} feedback corrections`);
    }
  }

  public getFeedbackStats(): { [category: string]: number } {
    const stats: { [category: string]: number } = {};
    this.feedbackCorrections.forEach((corrections, category) => {
      stats[category] = corrections.length;
    });
    return stats;
  }

  public logFeedbackStatus() {
    console.log('📊 FEEDBACK SYSTEM STATUS:');
    const stats = this.getFeedbackStats();
    const totalCorrections = Object.values(stats).reduce((sum, count) => sum + count, 0);
    console.log(`📝 Total corrections stored: ${totalCorrections}`);
    Object.entries(stats).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} corrections`);
    });
    console.log('🎯 Current adaptive thresholds:');
    this.adaptiveThresholds.forEach((threshold, category) => {
      console.log(`   ${category}: ${threshold.toFixed(3)}`);
    });
  }
}

export const enhancedDetector = new EnhancedDetector();
