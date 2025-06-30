
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, Eye, BarChart3, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { loadModel, getImageEmbedding, preprocessImage } from '@/utils/embeddingUtils';
import { findClosestLabel, calculateTraitRarity, analyzeTrainingData } from '@/utils/traitUtils';
import EditableMetadataCard from './EditableMetadataCard';
import { enhancedDetector } from '@/utils/enhancedDetection';

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
      
      // Analyze training quality
      const trainingAnalysis = analyzeTrainingData(trainedTraits);
      
      // Get feedback stats to show user what corrections are being applied
      const feedbackStats = enhancedDetector.getFeedbackStats();
      const totalFeedback = Object.values(feedbackStats).reduce((sum: number, count: number) => sum + count, 0);
      
      toast({
        title: "🔍 Starting Enhanced AI Analysis",
        description: `Processing ${uploadedImages.length} images with ${Math.round(trainingAnalysis.qualityScore * 100)}% training quality. ${totalFeedback} feedback corrections active.`
      });

      console.log('🧠 Starting classification with enhanced feedback system');
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
        
        // PRIORITY 1: Use enhanced detection with feedback corrections
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          console.log(`🎯 Analyzing ${traitCategory} for ${file.name}`);
          
          // Try enhanced detection first (includes feedback corrections)
          const enhancedResult = enhancedDetector.enhancedDetection(embedding, traitValues as any, traitCategory);
          
          if (enhancedResult && enhancedResult.label !== 'Not Detected') {
            detectedTraits[traitCategory] = enhancedResult.label;
            confidenceScores[traitCategory] = enhancedResult.confidence;
            detectionStatus[traitCategory] = 'detected';
            
            // Check if this was a feedback-enhanced result
            if (enhancedResult.confidence > 0.90) {
              feedbackApplied[traitCategory] = true;
              console.log(`✅ ${traitCategory}: ${enhancedResult.label} (${Math.round(enhancedResult.confidence * 100)}% confidence) [FEEDBACK ENHANCED]`);
            } else {
              console.log(`✅ ${traitCategory}: ${enhancedResult.label} (${Math.round(enhancedResult.confidence * 100)}% confidence)`);
            }
          } else {
            // Fallback to basic detection if enhanced detection fails
            const basicResult = findClosestLabel(embedding, traitValues as any, traitCategory);
            
            if (basicResult && basicResult.label !== 'Not Detected' && basicResult.confidence >= 0.75) {
              detectedTraits[traitCategory] = basicResult.label;
              confidenceScores[traitCategory] = basicResult.confidence;
              detectionStatus[traitCategory] = 'detected';
              console.log(`✅ ${traitCategory}: ${basicResult.label} (${Math.round(basicResult.confidence * 100)}% confidence) [BASIC]`);
            } else {
              detectionStatus[traitCategory] = 'not_detected';
              confidenceScores[traitCategory] = enhancedResult?.confidence || basicResult?.confidence || 0;
              console.log(`❌ ${traitCategory}: Not detected (${Math.round((enhancedResult?.confidence || basicResult?.confidence || 0) * 100)}% confidence)`);
            }
          }
        }

        embedding.dispose();

        // Create attributes array only from detected traits
        const attributes = Object.entries(detectedTraits).map(([trait_type, value]) => ({
          trait_type,
          value: value as string,
          confidence: confidenceScores[trait_type],
          rarity: "0%", // Will be calculated later
          feedbackEnhanced: feedbackApplied[trait_type] || false
        }));

        // Enhanced metadata generation
        const metadata = {
          name: `NFT #${String(i + 1).padStart(4, '0')}`,
          description: "AI-generated NFT with feedback-enhanced trait detection",
          image: `ipfs://YOUR-HASH/${file.name}`,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          collectionName: "Feedback-Enhanced AI Collection",
          collectionDescription: "Generated with Enhanced AI Detection + User Feedback",
          attributes,
          confidenceScores,
          feedbackApplied, // Track which traits used feedback
          allTraitAnalysis: Object.entries(trainedTraits).map(([trait_type, values]: [string, any]) => ({
            trait_type,
            value: detectedTraits[trait_type] || 'Not Detected',
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
      
      const detectedCount = metadataArray.reduce((sum, item) => sum + item.attributes.length, 0);
      const totalAnalyzed = metadataArray.length * Object.keys(trainedTraits).length;
      const detectionRate = ((detectedCount / totalAnalyzed) * 100).toFixed(1);
      const feedbackEnhancedCount = metadataArray.reduce((sum, item) => 
        sum + item.attributes.filter((attr: any) => attr.feedbackEnhanced).length, 0
      );
      
      toast({
        title: "🎉 Enhanced Analysis Complete!",
        description: `${uploadedImages.length} images analyzed. ${detectedCount} traits detected (${detectionRate}% rate). ${feedbackEnhancedCount} feedback-enhanced results.`
      });
    } catch (error) {
      console.error('Classification failed:', error);
      toast({
        title: "Classification failed",
        description: "Error during trait detection",
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
        return 'Running enhanced AI analysis with feedback corrections...';
      case 'calculating':
        return 'Computing trait frequencies and rarity percentages...';
      case 'complete':
        return 'Feedback-enhanced analysis complete!';
      default:
        return 'Ready to start enhanced analysis';
    }
  }

  // Get feedback statistics for display
  const feedbackStats = enhancedDetector.getFeedbackStats();
  const totalFeedback = Object.values(feedbackStats).reduce((sum: number, count: number) => sum + count, 0);

  return (
    <div className="space-y-6">
      {/* Enhanced Analysis Notice */}
      <Card className="bg-blue-900/20 border-blue-600">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="text-blue-200 font-medium">🎯 Feedback-Enhanced AI Detection</h4>
              <div className="text-sm text-blue-200 space-y-1">
                <p><strong>Smart Learning:</strong> Applies your previous feedback corrections automatically</p>
                <p><strong>High Accuracy:</strong> Uses strict thresholds (75%+ confidence required)</p>
                <p><strong>Active Corrections:</strong> {totalFeedback} feedback corrections loaded</p>
              </div>
              {totalFeedback > 0 && (
                <div className="text-xs text-blue-300 mt-2">
                  Corrections by category: {Object.entries(feedbackStats).map(([cat, count]) => `${cat}: ${count}`).join(', ')}
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
            🎯 Enhanced AI Detection
          </CardTitle>
          <CardDescription className="text-slate-400">
            High-accuracy trait detection with user feedback integration
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
              <div className="text-sm text-slate-400">Feedback Corrections</div>
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
            {classifying ? 'Running Enhanced Analysis...' : '🎯 Start Enhanced Detection'}
          </Button>
        </CardContent>
      </Card>

      {/* Results with Editable Metadata */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" />
              Enhanced Detection Results
            </CardTitle>
            <CardDescription className="text-slate-400">
              Review feedback-enhanced AI predictions with quality metrics
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

      {/* Enhanced Statistics */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Enhanced Collection Statistics
            </CardTitle>
            <CardDescription className="text-slate-400">
              Trait distribution with feedback enhancement tracking
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
                              <Badge variant="outline" className="text-xs bg-green-900 text-green-300 border-green-600">
                                Enhanced
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
                            <div className="text-green-400">Feedback Enhanced: {stats.feedbackEnhanced}</div>
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
