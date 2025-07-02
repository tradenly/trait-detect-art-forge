import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, Eye, BarChart3, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { loadModel, getImageEmbedding, preprocessImage } from '@/utils/embeddingUtils';
import { findClosestLabel, resolveTraitConflicts, calculateTraitRarity, analyzeTrainingData } from '@/utils/traitUtils';
import EditableMetadataCard from './EditableMetadataCard';
import { enhancedDetector } from '@/utils/enhancedDetection';

interface TrainingExample {
  embedding: any;
  fileName: string;
  imageUrl: string;
}

interface TraitClassifierProps {
  uploadedImages: File[];
  trainedTraits: any;
  onMetadataGenerated: (metadata: any[]) => void;
}

const TraitClassifier = ({ uploadedImages, trainedTraits, onMetadataGenerated }: TraitClassifierProps) => {
  const [classifying, setClassifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'analyzing' | 'calculating' | 'complete'>('idle');

  const canClassify = uploadedImages.length > 0 && Object.keys(trainedTraits).length > 0;

  const startClassification = async () => {
    if (!canClassify) {
      toast({
        title: "Cannot classify",
        description: "Please upload images and train traits first",
        variant: "destructive"
      });
      return;
    }

    setClassifying(true);
    setProgress(0);
    setCurrentPhase('analyzing');
    const metadataArray: any[] = [];

    try {
      await loadModel();
      
      // Update adaptive thresholds based on training data - fix TypeScript error
      console.log('🔧 Updating adaptive thresholds for all categories...');
      for (const [category, values] of Object.entries(trainedTraits)) {
        const allExamples = Object.values(values as { [key: string]: TrainingExample[] }).flat();
        enhancedDetector.updateAdaptiveThresholds(category, allExamples);
      }
      
      // Analyze training quality and show feedback status
      const trainingAnalysis = analyzeTrainingData(trainedTraits);
      const feedbackStats = enhancedDetector.getFeedbackStats();
      const totalFeedback = Object.values(feedbackStats).reduce((sum: number, count: number) => sum + count, 0);
      
      // Log current system status
      enhancedDetector.logFeedbackStatus();
      
      toast({
        title: "🎯 Enhanced AI Analysis Starting",
        description: `Processing ${uploadedImages.length} images with ${Math.round(trainingAnalysis.qualityScore * 100)}% training quality. ${totalFeedback} feedback corrections active.`
      });

      console.log('🚀 Starting UNIFIED detection pipeline with feedback integration');
      console.log('📊 Training quality:', trainingAnalysis.qualityScore.toFixed(2));
      console.log('🎯 Active feedback corrections:', feedbackStats);

      for (let i = 0; i < uploadedImages.length; i++) {
        const file = uploadedImages[i];
        console.log(`🔍 Processing image ${i + 1}/${uploadedImages.length}: ${file.name}`);
        
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);
        
        const detectedTraits: any = {};
        const confidenceScores: any = {};
        const detectionStatus: any = {};
        const feedbackApplied: any = {};
        
        // UNIFIED DETECTION: Use enhanced detector with feedback integration
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          console.log(`🎯 UNIFIED enhanced detection for ${traitCategory} on ${file.name}`);
          
          const result = findClosestLabel(embedding, traitValues as any, traitCategory);
          
          if (result && result.label !== 'Not Detected') {
            detectedTraits[traitCategory] = result.label;
            confidenceScores[traitCategory] = result.confidence;
            detectionStatus[traitCategory] = 'detected';
            
            // Track if this detection was feedback-enhanced
            if (result.confidence > 0.90) {
              feedbackApplied[traitCategory] = true;
              console.log(`✅ ${traitCategory}: ${result.label} (${Math.round(result.confidence * 100)}% confidence) [FEEDBACK ENHANCED]`);
            } else {
              console.log(`✅ ${traitCategory}: ${result.label} (${Math.round(result.confidence * 100)}% confidence)`);
            }
          } else {
            detectionStatus[traitCategory] = 'not_detected';
            confidenceScores[traitCategory] = result?.confidence || 0;
            console.log(`❌ ${traitCategory}: Not detected (${Math.round((result?.confidence || 0) * 100)}% confidence)`);
          }
        }

        // Apply conflict resolution
        const resolvedTraits = resolveTraitConflicts(detectedTraits);

        embedding.dispose();

        // Create attributes array from resolved traits
        const attributes = Object.entries(resolvedTraits).map(([trait_type, value]) => ({
          trait_type,
          value: value as string,
          confidence: confidenceScores[trait_type],
          rarity: "0%", // Will be calculated later
          feedbackEnhanced: feedbackApplied[trait_type] || false
        }));

        // Enhanced metadata generation with unified detection tracking
        const metadata = {
          name: `NFT #${String(i + 1).padStart(4, '0')}`,
          description: "AI-generated NFT with unified feedback-enhanced detection",
          image: `ipfs://YOUR-HASH/${file.name}`,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          collectionName: "Unified Enhanced AI Collection",
          collectionDescription: "Generated with Unified Feedback-Enhanced Detection Pipeline",
          attributes,
          confidenceScores,
          feedbackApplied,
          allTraitAnalysis: Object.entries(trainedTraits).map(([trait_type, values]: [string, any]) => ({
            trait_type,
            value: resolvedTraits[trait_type] || 'Not Detected',
            confidence: confidenceScores[trait_type] || 0,
            status: detectionStatus[trait_type] || 'not_detected',
            rarity: "0%",
            isDetected: detectionStatus[trait_type] === 'detected',
            feedbackEnhanced: feedbackApplied[trait_type] || false
          }))
        };

        metadataArray.push(metadata);
        setProgress(Math.round(((i + 1) / uploadedImages.length) * 50));
        
        if (i % 5 === 0 || i === uploadedImages.length - 1) {
          setResults([...metadataArray]);
        }
      }

      // Phase 2: Calculate rarities
      setCurrentPhase('calculating');
      toast({
        title: "Calculating rarities",
        description: "Computing trait frequencies and rarity percentages..."
      });

      for (let i = 0; i < metadataArray.length; i++) {
        const item = metadataArray[i];
        item.attributes = item.attributes.map((attr: any) => ({
          ...attr,
          rarity: calculateTraitRarity(attr.trait_type, attr.value, metadataArray)
        }));
        
        item.allTraitAnalysis = item.allTraitAnalysis.map((analysis: any) => ({
          ...analysis,
          rarity: analysis.status === 'detected' 
            ? calculateTraitRarity(analysis.trait_type, analysis.value, metadataArray)
            : "N/A"
        }));
        
        setProgress(50 + Math.round(((i + 1) / metadataArray.length) * 50));
      }

      onMetadataGenerated(metadataArray);
      setResults(metadataArray);
      setCurrentPhase('complete');
      
      // Enhanced completion metrics
      const detectedCount = metadataArray.reduce((sum, item) => sum + item.attributes.length, 0);
      const totalAnalyzed = metadataArray.length * Object.keys(trainedTraits).length;
      const detectionRate = ((detectedCount / totalAnalyzed) * 100).toFixed(1);
      const feedbackEnhancedCount = metadataArray.reduce((sum, item) => 
        sum + item.attributes.filter((attr: any) => attr.feedbackEnhanced).length, 0
      );
      
      console.log('📊 UNIFIED DETECTION COMPLETE:');
      console.log(`   Detection Rate: ${detectionRate}%`);
      console.log(`   Feedback Enhanced: ${feedbackEnhancedCount} detections`);
      console.log(`   Total Processed: ${uploadedImages.length} images`);
      
      toast({
        title: "🎉 Unified Analysis Complete!",
        description: `${uploadedImages.length} images analyzed. ${detectedCount} traits detected (${detectionRate}% rate). ${feedbackEnhancedCount} feedback-enhanced results.`
      });
    } catch (error) {
      console.error('Unified classification failed:', error);
      toast({
        title: "Classification failed",
        description: "Error during unified trait detection",
        variant: "destructive"
      });
      setCurrentPhase('idle');
    } finally {
      setClassifying(false);
    }
  };

  const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleMetadataUpdate = (index: number, updatedMetadata: any) => {
    const updatedResults = [...results];
    updatedResults[index] = updatedMetadata;
    setResults(updatedResults);
    onMetadataGenerated(updatedResults);
  };

  function getTraitStats() {
    if (results.length === 0) return {};
    
    const stats: any = {};
    results.forEach(item => {
      item.attributes.forEach((attr: any) => {
        if (!stats[attr.trait_type]) {
          stats[attr.trait_type] = {};
        }
        if (!stats[attr.trait_type][attr.value]) {
          stats[attr.trait_type][attr.value] = { 
            count: 0, 
            avgConfidence: 0, 
            confidences: [],
            feedbackEnhanced: 0
          };
        }
        stats[attr.trait_type][attr.value].count++;
        stats[attr.trait_type][attr.value].confidences.push(attr.confidence || 0);
        if (attr.feedbackEnhanced) {
          stats[attr.trait_type][attr.value].feedbackEnhanced++;
        }
      });
    });
    
    Object.values(stats).forEach((category: any) => {
      Object.values(category).forEach((value: any) => {
        const confidences = value.confidences;
        value.avgConfidence = confidences.reduce((sum: number, conf: number) => sum + conf, 0) / confidences.length;
      });
    });
    
    return stats;
  }

  function getPhaseDescription() {
    switch (currentPhase) {
      case 'analyzing':
        return 'Running unified feedback-enhanced AI analysis...';
      case 'calculating':
        return 'Computing trait frequencies and rarity percentages...';
      case 'complete':
        return 'Unified feedback-enhanced analysis complete!';
      default:
        return 'Ready to start unified enhanced analysis';
    }
  }

  // Get feedback statistics for display
  const feedbackStats = enhancedDetector.getFeedbackStats();
  const totalFeedback = Object.values(feedbackStats).reduce((sum: number, count: number) => sum + count, 0);

  return (
    <div className="space-y-6">
      {/* Unified Enhanced Analysis Notice */}
      <Card className="bg-gradient-to-r from-blue-900/20 to-green-900/20 border-blue-600">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="text-blue-200 font-medium">🎯 Unified Feedback-Enhanced Detection</h4>
              <div className="text-sm text-blue-200 space-y-1">
                <p><strong>Unified Pipeline:</strong> Single detection system with integrated feedback</p>
                <p><strong>Adaptive Thresholds:</strong> AI adjusts detection sensitivity based on training quality</p>
                <p><strong>Active Memory:</strong> {totalFeedback} user corrections applied automatically</p>
                <p><strong>Real-time Learning:</strong> Each feedback immediately improves future detections</p>
              </div>
              {totalFeedback > 0 && (
                <div className="text-xs text-green-300 mt-2 p-2 bg-green-900/20 rounded">
                  🧠 Active corrections: {Object.entries(feedbackStats).map(([cat, count]) => `${cat}: ${count}`).join(', ')}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            🎯 Unified Enhanced Detection
          </CardTitle>
          <CardDescription className="text-slate-400">
            Single pipeline with integrated feedback learning and adaptive thresholds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{uploadedImages.length}</div>
              <div className="text-sm text-slate-400">Images to Analyze</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{Object.keys(trainedTraits).length}</div>
              <div className="text-sm text-slate-400">Trait Categories</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{totalFeedback}</div>
              <div className="text-sm text-slate-400">Active Corrections</div>
            </div>
          </div>

          {classifying && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">{getPhaseDescription()}</span>
                <span className="text-slate-400">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <Button 
            onClick={startClassification}
            disabled={!canClassify || classifying}
            className="w-full"
            size="lg"
          >
            <Play className="w-5 h-5 mr-2" />
            {classifying ? 'Running Unified Analysis...' : '🎯 Start Unified Enhanced Detection'}
          </Button>
        </CardContent>
      </Card>

      {/* Results with Editable Metadata */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" />
              Unified Detection Results
            </CardTitle>
            <CardDescription className="text-slate-400">
              Review unified feedback-enhanced AI predictions with integrated learning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                disabled={previewIndex === 0}
              >
                Previous
              </Button>
              <span className="text-white">
                {previewIndex + 1} of {results.length}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPreviewIndex(Math.min(results.length - 1, previewIndex + 1))}
                disabled={previewIndex === results.length - 1}
              >
                Next
              </Button>
            </div>

            {/* Metadata Card */}
            {results[previewIndex] && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="aspect-square bg-slate-800 rounded-lg overflow-hidden">
                  <img
                    src={results[previewIndex].imageUrl}
                    alt={results[previewIndex].name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <EditableMetadataCard
                  metadata={results[previewIndex]}
                  onMetadataUpdate={(updatedMetadata) => handleMetadataUpdate(previewIndex, updatedMetadata)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enhanced Statistics with Unified Tracking */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Unified Collection Statistics
            </CardTitle>
            <CardDescription className="text-slate-400">
              Trait distribution with unified feedback enhancement tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(getTraitStats()).map(([category, values]: [string, any]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium text-white">{category}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Object.entries(values).map(([value, stats]: [string, any]) => (
                      <div key={value} className="bg-slate-800/50 rounded p-3">
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-sm font-medium text-white">{value}</div>
                          <div className="flex items-center gap-1">
                            {stats.feedbackEnhanced > 0 && 
                              <Badge variant="outline" className="text-xs bg-gradient-to-r from-green-900 to-blue-900 text-green-300 border-green-600">
                                🧠 Enhanced
                              </Badge>
                            }
                            {stats.avgConfidence >= 0.85 ? 
                              <CheckCircle className="w-3 h-3 text-green-400" /> : 
                              stats.avgConfidence >= 0.75 ?
                              <CheckCircle className="w-3 h-3 text-blue-400" /> :
                              <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            }
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 space-y-1">
                          <div>Count: {stats.count} ({((stats.count / results.length) * 100).toFixed(1)}%)</div>
                          <div>Avg Confidence: {Math.round(stats.avgConfidence * 100)}%</div>
                          {stats.feedbackEnhanced > 0 && (
                            <div className="text-green-400">🎯 Unified Enhanced: {stats.feedbackEnhanced}</div>
                          )}
                          <div className="text-xs text-slate-500">
                            Quality: {stats.avgConfidence >= 0.85 ? 'Excellent' : stats.avgConfidence >= 0.75 ? 'Good' : 'Fair'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TraitClassifier;
