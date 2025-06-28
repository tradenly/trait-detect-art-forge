import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, Eye, BarChart3, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { loadAdvancedModels, getEnhancedEmbedding } from '@/utils/advancedEmbeddingUtils';
import { findBestTraitMatch, analyzeTrainingQuality } from '@/utils/enhancedTraitUtils';
import { calculateTraitRarity } from '@/utils/traitUtils';
import EditableMetadataCard from './EditableMetadataCard';

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
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState({
    minConsensus: 0.7,
    evidenceThreshold: 0.75,
    useEnsemble: true
  });

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
      // Load advanced models
      await loadAdvancedModels();
      
      // Enhanced pre-analysis
      const qualityAnalysis = analyzeTrainingQuality(trainedTraits);
      
      toast({
        title: "🚀 Advanced AI Analysis Starting",
        description: `Processing ${uploadedImages.length} images with ensemble detection (Quality: ${Math.round(qualityAnalysis.overallQuality * 100)}%)`
      });

      console.log('🧠 Advanced AI classification starting');
      console.log('📊 Training quality:', qualityAnalysis.overallQuality.toFixed(2));

      for (let i = 0; i < uploadedImages.length; i++) {
        const file = uploadedImages[i];
        console.log(`🔍 Processing image ${i + 1}/${uploadedImages.length}: ${file.name}`);
        
        const img = await loadImageFromFile(file);
        const embedding = await getEnhancedEmbedding(img);
        
        const detectedTraits: any = {};
        const confidenceScores: any = {};
        const detectionStatus: any = {};
        
        // Advanced detection with ensemble methods
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          console.log(`🎯 Analyzing ${traitCategory} for ${file.name}`);
          const result = findBestTraitMatch(embedding, traitValues as any, advancedSettings);
          
          if (result && result.label !== 'Not Detected') {
            detectedTraits[traitCategory] = result.label;
            confidenceScores[traitCategory] = result.confidence;
            detectionStatus[traitCategory] = 'detected';
            console.log(`✅ ${traitCategory}: ${result.label} (${Math.round(result.confidence * 100)}% confidence)`);
          } else {
            detectedTraits[traitCategory] = 'Not Detected';
            confidenceScores[traitCategory] = result?.confidence || 0;
            detectionStatus[traitCategory] = 'not_detected';
            console.log(`❌ ${traitCategory}: Not detected (${Math.round((result?.confidence || 0) * 100)}% confidence)`);
          }
        }

        // Clean up tensor
        embedding.dispose();

        // Enhanced metadata generation
        const metadata = {
          name: `NFT #${String(i + 1).padStart(4, '0')}`,
          description: "AI-generated NFT with advanced ensemble detection",
          image: `ipfs://YOUR-HASH/${file.name}`,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          collectionName: "Advanced AI Trait Collection",
          collectionDescription: "Generated with Advanced Ensemble AI Detection",
          processingInfo: {
            ensembleMethod: "Multi-metric consensus with evidence weighting",
            qualityScore: qualityAnalysis.overallQuality,
            detectionSettings: advancedSettings
          },
          attributes: Object.entries(detectedTraits)
            .filter(([_, value]) => value !== 'Not Detected')
            .map(([trait_type, value]) => ({
              trait_type,
              value,
              confidence: confidenceScores[trait_type],
              rarity: "0%"
            })),
          allTraitAnalysis: Object.entries(detectedTraits).map(([trait_type, value]) => ({
            trait_type,
            value: value === 'Not Detected' ? 'Not Detected' : value,
            confidence: confidenceScores[trait_type],
            status: detectionStatus[trait_type],
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
      const avgConfidence = metadataArray.reduce((sum, item) => {
        const confidences = item.attributes.map((attr: any) => attr.confidence || 0);
        return sum + (confidences.reduce((a, b) => a + b, 0) / confidences.length || 0);
      }, 0) / metadataArray.length;
      
      toast({
        title: "🎉 Advanced Analysis Complete!",
        description: `${uploadedImages.length} images analyzed with ensemble AI. ${detectedCount} traits detected (avg: ${Math.round(avgConfidence * 100)}% confidence)`
      });
    } catch (error) {
      console.error('Advanced classification failed:', error);
      toast({
        title: "Classification failed",
        description: "Error during advanced trait detection",
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

  const getTraitStats = () => {
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
  };

  const getPhaseDescription = () => {
    switch (currentPhase) {
      case 'analyzing':
        return 'Running advanced ensemble AI analysis...';
      case 'calculating':
        return 'Computing trait frequencies and rarity percentages...';
      case 'complete':
        return 'Advanced analysis complete!';
      default:
        return 'Ready to start advanced analysis';
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced AI Notice */}
      <Card className="bg-purple-900/20 border-purple-600">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="text-purple-200 font-medium">🚀 Advanced Ensemble AI Detection</h4>
              <div className="text-sm text-purple-200 space-y-1">
                <p><strong>Multi-Metric Analysis:</strong> Uses cosine, euclidean, and manhattan distance</p>
                <p><strong>Consensus Scoring:</strong> Multiple algorithms vote on each detection</p>
                <p><strong>Evidence Weighting:</strong> Quality and quantity of training data considered</p>
                <p><strong>Adaptive Thresholds:</strong> Dynamic confidence requirements based on training quality</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              Advanced Detection Settings
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            >
              {showAdvancedSettings ? 'Hide' : 'Show'} Settings
            </Button>
          </div>
        </CardHeader>
        {showAdvancedSettings && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Min Consensus ({advancedSettings.minConsensus})</label>
                <input
                  type="range"
                  min="0.5"
                  max="0.9"
                  step="0.05"
                  value={advancedSettings.minConsensus}
                  onChange={(e) => setAdvancedSettings({...advancedSettings, minConsensus: parseFloat(e.target.value)})}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Evidence Threshold ({advancedSettings.evidenceThreshold})</label>
                <input
                  type="range"
                  min="0.5"
                  max="0.9"
                  step="0.05"
                  value={advancedSettings.evidenceThreshold}
                  onChange={(e) => setAdvancedSettings({...advancedSettings, evidenceThreshold: parseFloat(e.target.value)})}
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={advancedSettings.useEnsemble}
                  onChange={(e) => setAdvancedSettings({...advancedSettings, useEnsemble: e.target.checked})}
                  className="rounded"
                />
                <label className="text-sm text-slate-400">Use Ensemble Detection</label>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            🚀 Advanced Ensemble AI Detection
          </CardTitle>
          <CardDescription className="text-slate-400">
            Multi-algorithm consensus with evidence weighting for maximum accuracy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{uploadedImages.length}</div>
              <div className="text-sm text-slate-400">Images to Analyze</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{Object.keys(trainedTraits).length}</div>
              <div className="text-sm text-slate-400">Trait Categories</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{results.length}</div>
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
            {classifying ? 'Running Advanced Analysis...' : '🚀 Start Advanced Ensemble Detection'}
          </Button>
        </CardContent>
      </Card>

      {/* Enhanced Results with Editable Metadata */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-400" />
              Detection Results with Editable Metadata
            </CardTitle>
            <CardDescription className="text-slate-400">
              Review and edit AI predictions. Click "Edit" to modify any metadata manually.
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

            {/* Editable Metadata Card */}
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

      {/* Trait Statistics */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Collection Statistics
            </CardTitle>
            <CardDescription className="text-slate-400">
              Trait distribution and confidence analysis from advanced ensemble detection
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
                            {stats.avgConfidence >= 0.7 ? 
                              <CheckCircle className="w-3 h-3 text-green-400" /> : 
                              <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            }
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 space-y-1">
                          <div>Count: {stats.count} ({((stats.count / results.length) * 100).toFixed(1)}%)</div>
                          <div>Avg Confidence: {Math.round(stats.avgConfidence * 100)}%</div>
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
