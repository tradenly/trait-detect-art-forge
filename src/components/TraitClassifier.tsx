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
      
      toast({
        title: "🔍 Starting Strict AI Analysis",
        description: `Processing ${uploadedImages.length} images with ${Math.round(trainingAnalysis.qualityScore * 100)}% training quality`
      });

      console.log('🧠 Starting classification with strict thresholds');
      console.log('📊 Training quality:', trainingAnalysis.qualityScore.toFixed(2));

      for (let i = 0; i < uploadedImages.length; i++) {
        const file = uploadedImages[i];
        console.log(`🔍 Processing image ${i + 1}/${uploadedImages.length}: ${file.name}`);
        
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);
        
        const detectedTraits: any = {};
        const confidenceScores: any = {};
        const detectionStatus: any = {};
        
        // Use enhanced detection with feedback corrections
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          console.log(`🎯 Analyzing ${traitCategory} for ${file.name}`);
          
          // First try enhanced detection (includes feedback corrections)
          const enhancedResult = enhancedDetector.enhancedDetection(embedding, traitValues as any, traitCategory);
          
          if (enhancedResult && enhancedResult.label !== 'Not Detected' && enhancedResult.confidence >= 0.78) {
            detectedTraits[traitCategory] = enhancedResult.label;
            confidenceScores[traitCategory] = enhancedResult.confidence;
            detectionStatus[traitCategory] = 'detected';
            console.log(`✅ ${traitCategory}: ${enhancedResult.label} (${Math.round(enhancedResult.confidence * 100)}% confidence) ${enhancedResult.confidence > 0.85 ? '[FEEDBACK ENHANCED]' : ''}`);
          } else {
            // Fallback to basic detection
            const result = findClosestLabel(embedding, traitValues as any, traitCategory);
            
            if (result && result.label !== 'Not Detected' && result.confidence >= 0.78) {
              detectedTraits[traitCategory] = result.label;
              confidenceScores[traitCategory] = result.confidence;
              detectionStatus[traitCategory] = 'detected';
              console.log(`✅ ${traitCategory}: ${result.label} (${Math.round(result.confidence * 100)}% confidence)`);
            } else {
              detectionStatus[traitCategory] = 'not_detected';
              confidenceScores[traitCategory] = result?.confidence || 0;
              console.log(`❌ ${traitCategory}: Not detected (${Math.round((result?.confidence || 0) * 100)}% confidence, threshold: 78%)`);
            }
          }
        }

        embedding.dispose();

        // Create attributes array only from detected traits
        const attributes = Object.entries(detectedTraits).map(([trait_type, value]) => ({
          trait_type,
          value: value as string,
          confidence: confidenceScores[trait_type],
          rarity: "0%" // Will be calculated later
        }));

        // Enhanced metadata generation
        const metadata = {
          name: `NFT #${String(i + 1).padStart(4, '0')}`,
          description: "AI-generated NFT with strict trait detection",
          image: `ipfs://YOUR-HASH/${file.name}`,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          collectionName: "AI Detected Trait Collection",
          collectionDescription: "Generated with Strict AI Detection",
          attributes,
          confidenceScores, // Keep confidence scores for analysis
          allTraitAnalysis: Object.entries(trainedTraits).map(([trait_type, values]: [string, any]) => ({
            trait_type,
            value: detectedTraits[trait_type] || 'Not Detected',
            confidence: confidenceScores[trait_type] || 0,
            status: detectionStatus[trait_type] || 'not_detected',
            rarity: "0%",
            isDetected: detectionStatus[trait_type] === 'detected'
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
      
      toast({
        title: "🎉 Strict Analysis Complete!",
        description: `${uploadedImages.length} images analyzed. ${detectedCount} traits detected (${detectionRate}% detection rate)`
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
          stats[attr.trait_type][attr.value] = { count: 0, avgConfidence: 0, confidences: [] };
        }
        stats[attr.trait_type][attr.value].count++;
        stats[attr.trait_type][attr.value].confidences.push(attr.confidence || 0);
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
        return 'Running strict AI analysis with high accuracy thresholds...';
      case 'calculating':
        return 'Computing trait frequencies and rarity percentages...';
      case 'complete':
        return 'Strict analysis complete!';
      default:
        return 'Ready to start strict analysis';
    }
  }

  return (
    <div className="space-y-6">
      {/* Analysis Notice */}
      <Card className="bg-blue-900/20 border-blue-600">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="text-blue-200 font-medium">🔍 Strict AI Detection System</h4>
              <div className="text-sm text-blue-200 space-y-1">
                <p><strong>High Accuracy:</strong> Uses strict thresholds (78%+ confidence required)</p>
                <p><strong>Quality Focus:</strong> Only accepts clear, unambiguous detections</p>
                <p><strong>Conservative Approach:</strong> Prefers accuracy over detection rate</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            🔍 Strict AI Detection
          </CardTitle>
          <CardDescription className="text-slate-400">
            High-accuracy trait detection with conservative thresholds
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
              <div className="text-2xl font-bold text-blue-400">{results.length}</div>
              <div className="text-sm text-slate-400">Analyzed</div>
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
            {classifying ? 'Running Strict Analysis...' : '🔍 Start Strict Detection'}
          </Button>
        </CardContent>
      </Card>

      {/* Results with Editable Metadata */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" />
              Strict Detection Results
            </CardTitle>
            <CardDescription className="text-slate-400">
              Review high-confidence AI predictions with quality metrics
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

      {/* Statistics */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Collection Statistics
            </CardTitle>
            <CardDescription className="text-slate-400">
              Trait distribution analysis with confidence metrics
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
                            {stats.avgConfidence >= 0.85 ? 
                              <CheckCircle className="w-3 h-3 text-green-400" /> : 
                              stats.avgConfidence >= 0.78 ?
                              <CheckCircle className="w-3 h-3 text-blue-400" /> :
                              <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            }
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 space-y-1">
                          <div>Count: {stats.count} ({((stats.count / results.length) * 100).toFixed(1)}%)</div>
                          <div>Avg Confidence: {Math.round(stats.avgConfidence * 100)}%</div>
                          <div className="text-xs text-slate-500">
                            Quality: {stats.avgConfidence >= 0.85 ? 'Excellent' : stats.avgConfidence >= 0.78 ? 'Good' : 'Fair'}
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
