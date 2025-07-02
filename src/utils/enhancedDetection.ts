import * as tf from '@tensorflow/tfjs';
import { cosineSimilarity } from './embeddingUtils';
import { processFeedbackInput } from './traitUtils';

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
  isInstruction: boolean; // New field to track instruction vs correction
  shouldApplyToMetadata: boolean; // New field to control metadata inclusion
}

export class EnhancedDetector {
  private adaptiveThresholds: Map<string, number> = new Map();
  private categoryStats: Map<string, { avgSimilarity: number; variance: number }> = new Map();
  private feedbackCorrections: Map<string, FeedbackCorrection[]> = new Map();

  constructor() {
    this.initializeAdaptiveThresholds();
  }

  private initializeAdaptiveThresholds() {
    // Initialize with stricter thresholds to reduce false positives
    this.adaptiveThresholds.set('default', 0.78); // Increased from 0.75
    this.adaptiveThresholds.set('shorts', 0.80); // Higher for conflict-prone categories
    this.adaptiveThresholds.set('pants', 0.80);
    this.adaptiveThresholds.set('shirt', 0.77);
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

    // Stricter base thresholds for conflict-prone categories
    let threshold = category === 'shorts' || category === 'pants' ? 0.82 : 0.78;

    // Quality-based adjustment
    if (stats.variance < 0.06) {
      threshold -= 0.03; // Smaller reduction to maintain quality
    } else if (stats.variance < 0.12) {
      threshold -= 0.01; // Minimal reduction
    } else if (stats.variance > 0.18) {
      threshold += 0.08; // Increase for inconsistent data
    }

    // Sample size adjustment - more conservative
    if (examples.length >= 8) {
      threshold -= 0.02; // Smaller reduction
    } else if (examples.length >= 5) {
      threshold -= 0.005; // Very small reduction
    } else if (examples.length < 3) {
      threshold += 0.12; // Higher penalty for poor training
    }

    // Feedback integration bonus - more conservative
    const corrections = this.feedbackCorrections.get(category);
    if (corrections && corrections.length > 0) {
      const feedbackBonus = Math.min(0.03, corrections.length * 0.003); // Smaller bonus
      threshold -= feedbackBonus;
      console.log(`🎯 Feedback bonus applied: ${category} gets -${feedbackBonus.toFixed(3)} threshold reduction`);
    }

    // Stricter clamping to prevent false positives
    threshold = Math.max(0.70, Math.min(0.88, threshold));
    
    this.adaptiveThresholds.set(category, threshold);
    console.log(`🔧 ENHANCED threshold for ${category}: ${threshold.toFixed(3)} (${examples.length} examples, variance: ${stats.variance.toFixed(3)}, feedback: ${corrections?.length || 0})`);
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
    
    // Process the feedback to determine if it's an instruction or correction
    const feedbackInfo = processFeedbackInput(correctLabel, wrongLabel, category);
    
    // Clone the embedding to avoid disposal issues
    const clonedEmbedding = imageEmbedding.clone();
    
    corrections.push({
      imageEmbedding: clonedEmbedding,
      wrongLabel,
      correctLabel: feedbackInfo.cleanedValue,
      category,
      fileName,
      timestamp: Date.now(),
      isInstruction: feedbackInfo.isInstruction,
      shouldApplyToMetadata: feedbackInfo.shouldApplyToMetadata
    });

    console.log(`📝 SMART FEEDBACK STORED: ${category}: ${wrongLabel} → ${correctLabel} (${fileName})`);
    console.log(`📊 Feedback type: ${feedbackInfo.isInstruction ? 'INSTRUCTION' : 'CORRECTION'}, Apply to metadata: ${feedbackInfo.shouldApplyToMetadata}`);
    console.log(`📊 Total corrections for ${category}: ${corrections.length}`);
    
    // Keep only the last 50 corrections per category for optimal memory management
    if (corrections.length > 50) {
      const removed = corrections.shift();
      if (removed?.imageEmbedding) {
        removed.imageEmbedding.dispose();
      }
    }

    // More conservative threshold optimization
    const currentThreshold = this.adaptiveThresholds.get(category) || 0.78;
    const optimizedThreshold = Math.max(0.70, currentThreshold - 0.008); // Smaller immediate improvement
    this.adaptiveThresholds.set(category, optimizedThreshold);
    console.log(`🚀 Threshold optimized for ${category} after feedback: ${optimizedThreshold.toFixed(3)}`);
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

    console.log(`🎯 ENHANCED detection for ${category} with ${Object.keys(labelEmbeddings).length} labels`);

    // PRIORITY 1: Check feedback corrections first
    const correctionResult = this.applyFeedbackCorrections(targetEmbedding, category);
    if (correctionResult) {
      console.log(`✅ FEEDBACK CORRECTION: "${correctionResult.label}" for ${category} (confidence: ${correctionResult.confidence.toFixed(3)})`);
      return correctionResult;
    }

    // PRIORITY 2: Enhanced detection with stricter thresholds
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
      
      // Enhanced consistency scoring
      const variance = similarities.reduce((sum, sim) => sum + Math.pow(sim - avgSim, 2), 0) / similarities.length;
      const consistencyScore = Math.max(0, 1 - Math.sqrt(variance * 1.8)); // Stricter consistency

      // Enhanced composite score with stricter weighting
      const compositeScore = (
        maxSim * 0.45 +         // Reduced max importance
        avgSim * 0.40 +         // Increased average importance
        consistencyScore * 0.15 // Consistency bonus
      );

      console.log(`Label "${label}": max=${maxSim.toFixed(3)}, avg=${avgSim.toFixed(3)}, consistency=${consistencyScore.toFixed(3)}, score=${compositeScore.toFixed(3)}`);

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

    // Use adaptive threshold with category-specific adjustments
    const threshold = this.adaptiveThresholds.get(category) || this.adaptiveThresholds.get('default') || 0.78;
    
    // Stricter acceptance criteria
    const minConsistency = 0.60; // Increased from 0.55
    const minSimilarity = 0.72;  // Increased from 0.68

    console.log(`🎯 ENHANCED result: ${bestMatch}, score: ${bestScore.toFixed(3)}, similarity: ${bestSimilarity.toFixed(3)}, consistency: ${bestConsistency.toFixed(3)}, threshold: ${threshold.toFixed(3)}`);

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
    let bestCorrection: FeedbackCorrection | null = null;

    for (const correction of corrections) {
      const similarity = this.enhancedCosineSimilarity(targetEmbedding, correction.imageEmbedding);
      
      // Stricter threshold for feedback corrections
      if (similarity > 0.82 && similarity > bestSimilarity) { // Increased from 0.78
        bestSimilarity = similarity;
        bestMatch = correction.correctLabel;
        bestFileName = correction.fileName;
        bestCorrection = correction;
        console.log(`🎯 Feedback match: ${correction.fileName} → ${correction.correctLabel} (similarity: ${similarity.toFixed(3)})`);
      }
    }

    if (bestMatch && bestSimilarity > 0.82 && bestCorrection) {
      // Only apply corrections that should appear in metadata for collection processing
      if (bestCorrection.shouldApplyToMetadata) {
        console.log(`✅ APPLYING FEEDBACK CORRECTION: ${bestMatch} (similarity: ${bestSimilarity.toFixed(3)}, source: ${bestFileName})`);
        return {
          label: bestMatch,
          confidence: Math.min(0.95, bestSimilarity + 0.08), // Smaller confidence boost
          similarity: bestSimilarity,
          consistencyScore: 1.0, // Perfect consistency for corrections
          qualityScore: bestSimilarity + 0.12
        };
      } else {
        // For instructions, return "Not Detected" since the user said it shouldn't be there
        console.log(`✅ APPLYING INSTRUCTION FEEDBACK: Not Detected (instruction: ${bestMatch}, source: ${bestFileName})`);
        return {
          label: 'Not Detected',
          confidence: 0.95, // High confidence that it's not detected
          similarity: bestSimilarity,
          consistencyScore: 1.0,
          qualityScore: 0.95
        };
      }
    }

    return null;
  }

  private enhancedCosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
    // Enhanced cosine similarity with improved numerical stability
    const aFlat = a.flatten();
    const bFlat = b.flatten();
    
    if (aFlat.shape[0] !== bFlat.shape[0]) {
      console.warn('Tensor shape mismatch in enhanced similarity');
      aFlat.dispose();
      bFlat.dispose();
      return 0;
    }
    
    // Enhanced L2 normalization for better accuracy
    const aNorm = tf.norm(aFlat);
    const bNorm = tf.norm(bFlat);
    
    const aUnit = tf.div(aFlat, tf.maximum(aNorm, 1e-8)); // Improved epsilon
    const bUnit = tf.div(bFlat, tf.maximum(bNorm, 1e-8));
    
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
    console.log('📊 ENHANCED FEEDBACK SYSTEM STATUS:');
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
