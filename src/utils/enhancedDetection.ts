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
    // Initialize with unified balanced thresholds
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

      // Unified quality scoring optimized for feedback integration
      const consistencyScore = Math.max(0, 1 - Math.sqrt(variance * 1.2));
      const sampleScore = Math.min(1, examples.length / 5);
      const quality = (consistencyScore * 0.6 + sampleScore * 0.4);

      categoryQuality.set(category, quality);
      this.categoryStats.set(category, { avgSimilarity: avgSim, variance: variance });
      
      totalQuality += quality;
      categoryCount++;

      // Unified recommendations
      if (examples.length < 3) {
        recommendations.push(`${category}: Add more examples (${examples.length}/3 minimum)`);
      } else if (examples.length < 5) {
        recommendations.push(`${category}: Add more examples for better accuracy (${examples.length}/5 recommended)`);
      }

      if (variance > 0.15) {
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

    // Unified adaptive threshold system
    let threshold = 0.75; // Unified base threshold

    // Quality-based adjustment
    if (stats.variance < 0.06) {
      threshold -= 0.04; // Larger reduction for very consistent data
    } else if (stats.variance < 0.12) {
      threshold -= 0.02; // Small reduction for good consistency
    } else if (stats.variance > 0.18) {
      threshold += 0.06; // Increase for inconsistent data
    }

    // Sample size adjustment
    if (examples.length >= 8) {
      threshold -= 0.03; // Well-trained categories get lower thresholds
    } else if (examples.length >= 5) {
      threshold -= 0.01; // Moderately trained categories
    } else if (examples.length < 3) {
      threshold += 0.08; // Very high threshold for poorly trained categories
    }

    // Feedback integration bonus
    const corrections = this.feedbackCorrections.get(category);
    if (corrections && corrections.length > 0) {
      // More aggressive threshold reduction for categories with feedback
      const feedbackBonus = Math.min(0.05, corrections.length * 0.005);
      threshold -= feedbackBonus;
      console.log(`🎯 Feedback bonus applied: ${category} gets -${feedbackBonus.toFixed(3)} threshold reduction`);
    }

    // Clamp to unified reasonable range
    threshold = Math.max(0.65, Math.min(0.85, threshold));
    
    this.adaptiveThresholds.set(category, threshold);
    console.log(`🔧 UNIFIED threshold for ${category}: ${threshold.toFixed(3)} (${examples.length} examples, variance: ${stats.variance.toFixed(3)}, feedback: ${corrections?.length || 0})`);
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

    console.log(`📝 UNIFIED FEEDBACK STORED: ${category}: ${wrongLabel} → ${correctLabel} (${fileName})`);
    console.log(`📊 Total unified corrections for ${category}: ${corrections.length}`);
    
    // Keep only the last 50 corrections per category for optimal memory management
    if (corrections.length > 50) {
      const removed = corrections.shift();
      if (removed?.imageEmbedding) {
        removed.imageEmbedding.dispose();
      }
    }

    // Immediate threshold optimization when feedback is added
    const currentThreshold = this.adaptiveThresholds.get(category) || 0.75;
    const optimizedThreshold = Math.max(0.65, currentThreshold - 0.015); // Stronger immediate improvement
    this.adaptiveThresholds.set(category, optimizedThreshold);
    console.log(`🚀 UNIFIED threshold optimized for ${category} after feedback: ${optimizedThreshold.toFixed(3)}`);
  }

  public enhancedDetection(
    targetEmbedding: tf.Tensor,
    labelEmbeddings: { [key: string]: TrainingExample[] },
    category: string
  ): EnhancedDetectionResult | null {
    if (!targetEmbedding || !labelEmbeddings || Object.keys(labelEmbeddings).length === 0) {
      console.log('❌ Invalid inputs for unified enhanced detection');
      return null;
    }

    console.log(`🎯 UNIFIED enhanced detection for ${category} with ${Object.keys(labelEmbeddings).length} labels`);

    // PRIORITY 1: Check feedback corrections first (unified approach)
    const correctionResult = this.applyUnifiedFeedbackCorrections(targetEmbedding, category);
    if (correctionResult) {
      console.log(`✅ UNIFIED FEEDBACK CORRECTION: "${correctionResult.label}" for ${category} (confidence: ${correctionResult.confidence.toFixed(3)})`);
      return correctionResult;
    }

    // PRIORITY 2: Unified enhanced detection
    let bestMatch: string | null = null;
    let bestScore = -1;
    let bestSimilarity = -1;
    let bestConsistency = 0;

    for (const [label, examples] of Object.entries(labelEmbeddings)) {
      if (examples.length === 0) continue;

      const similarities: number[] = [];
      
      for (const example of examples) {
        const similarity = this.unifiedCosineSimilarity(targetEmbedding, example.embedding);
        similarities.push(similarity);
      }

      const maxSim = Math.max(...similarities);
      const avgSim = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
      
      // Unified consistency scoring
      const variance = similarities.reduce((sum, sim) => sum + Math.pow(sim - avgSim, 2), 0) / similarities.length;
      const consistencyScore = Math.max(0, 1 - Math.sqrt(variance * 1.5));

      // Unified composite score optimized for feedback integration
      const compositeScore = (
        maxSim * 0.5 +         // Best match importance
        avgSim * 0.35 +        // Average consistency
        consistencyScore * 0.15 // Consistency bonus
      );

      console.log(`Label "${label}": max=${maxSim.toFixed(3)}, avg=${avgSim.toFixed(3)}, consistency=${consistencyScore.toFixed(3)}, unified=${compositeScore.toFixed(3)}`);

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestMatch = label;
        bestSimilarity = maxSim;
        bestConsistency = consistencyScore;
      }
    }

    if (!bestMatch) {
      console.log('❌ No match found in unified enhanced detection');
      return null;
    }

    // Use unified adaptive threshold
    const threshold = this.adaptiveThresholds.get(category) || this.adaptiveThresholds.get('default') || 0.75;
    
    // Unified acceptance criteria
    const minConsistency = 0.55; // More lenient for feedback integration
    const minSimilarity = 0.68;  // More lenient for feedback integration

    console.log(`🎯 UNIFIED result: ${bestMatch}, score: ${bestScore.toFixed(3)}, similarity: ${bestSimilarity.toFixed(3)}, consistency: ${bestConsistency.toFixed(3)}, threshold: ${threshold.toFixed(3)}`);

    if (bestScore >= threshold && bestConsistency >= minConsistency && bestSimilarity >= minSimilarity) {
      console.log(`✅ UNIFIED ACCEPTED: "${bestMatch}"`);
      return {
        label: bestMatch,
        confidence: bestScore,
        similarity: bestSimilarity,
        consistencyScore: bestConsistency,
        qualityScore: bestScore
      };
    }

    console.log(`❌ UNIFIED REJECTED: score ${bestScore.toFixed(3)} < ${threshold.toFixed(3)} OR consistency ${bestConsistency.toFixed(3)} < ${minConsistency} OR similarity ${bestSimilarity.toFixed(3)} < ${minSimilarity}`);
    return {
      label: 'Not Detected',
      confidence: bestScore,
      similarity: bestSimilarity,
      consistencyScore: bestConsistency,
      qualityScore: bestScore
    };
  }

  private applyUnifiedFeedbackCorrections(
    targetEmbedding: tf.Tensor,
    category: string
  ): EnhancedDetectionResult | null {
    const corrections = this.feedbackCorrections.get(category);
    if (!corrections || corrections.length === 0) {
      return null;
    }

    console.log(`🔍 Checking ${corrections.length} unified feedback corrections for ${category}`);

    let bestMatch: string | null = null;
    let bestSimilarity = -1;
    let bestFileName = '';

    for (const correction of corrections) {
      const similarity = this.unifiedCosineSimilarity(targetEmbedding, correction.imageEmbedding);
      
      // Unified threshold for feedback corrections - more aggressive
      if (similarity > 0.78 && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = correction.correctLabel;
        bestFileName = correction.fileName;
        console.log(`🎯 UNIFIED feedback match: ${correction.fileName} → ${correction.correctLabel} (similarity: ${similarity.toFixed(3)})`);
      }
    }

    if (bestMatch && bestSimilarity > 0.78) {
      console.log(`✅ APPLYING UNIFIED FEEDBACK CORRECTION: ${bestMatch} (similarity: ${bestSimilarity.toFixed(3)}, source: ${bestFileName})`);
      return {
        label: bestMatch,
        confidence: Math.min(0.98, bestSimilarity + 0.12), // Higher confidence boost for unified corrections
        similarity: bestSimilarity,
        consistencyScore: 1.0, // Perfect consistency for corrections
        qualityScore: bestSimilarity + 0.15
      };
    }

    return null;
  }

  private unifiedCosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
    // Unified cosine similarity with optimized numerical stability
    const aFlat = a.flatten();
    const bFlat = b.flatten();
    
    if (aFlat.shape[0] !== bFlat.shape[0]) {
      console.warn('Tensor shape mismatch in unified similarity');
      aFlat.dispose();
      bFlat.dispose();
      return 0;
    }
    
    // Enhanced L2 normalization for better accuracy
    const aNorm = tf.norm(aFlat);
    const bNorm = tf.norm(bFlat);
    
    const aUnit = tf.div(aFlat, tf.maximum(aNorm, 1e-7)); // Improved epsilon
    const bUnit = tf.div(bFlat, tf.maximum(bNorm, 1e-7));
    
    const dotProduct = tf.sum(tf.mul(aUnit, bUnit));
    const similarity = dotProduct.dataSync()[0];
    
    // Optimized cleanup
    aFlat.dispose();
    bFlat.dispose();
    aNorm.dispose();
    bNorm.dispose();
    aUnit.dispose();
    bUnit.dispose();
    dotProduct.dispose();
    
    // Enhanced clamping with better precision
    return Math.max(-1, Math.min(1, similarity || 0));
  }

  public clearFeedbackCorrections(category?: string) {
    if (category) {
      const corrections = this.feedbackCorrections.get(category);
      if (corrections) {
        corrections.forEach(correction => correction.imageEmbedding.dispose());
        this.feedbackCorrections.delete(category);
        console.log(`🗑️ Cleared ${corrections.length} unified feedback corrections for ${category}`);
      }
    } else {
      // Clear all corrections
      let totalCleared = 0;
      this.feedbackCorrections.forEach((corrections, category) => {
        corrections.forEach(correction => correction.imageEmbedding.dispose());
        totalCleared += corrections.length;
      });
      this.feedbackCorrections.clear();
      console.log(`🗑️ Cleared all ${totalCleared} unified feedback corrections`);
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
    console.log('📊 UNIFIED FEEDBACK SYSTEM STATUS:');
    const stats = this.getFeedbackStats();
    const totalCorrections = Object.values(stats).reduce((sum, count) => sum + count, 0);
    console.log(`📝 Total unified corrections stored: ${totalCorrections}`);
    Object.entries(stats).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} corrections`);
    });
    console.log('🎯 Current unified adaptive thresholds:');
    this.adaptiveThresholds.forEach((threshold, category) => {
      console.log(`   ${category}: ${threshold.toFixed(3)}`);
    });
  }
}

export const enhancedDetector = new EnhancedDetector();
