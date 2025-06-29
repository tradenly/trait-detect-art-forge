
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, Eye, BarChart3, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { loadModel, getImageEmbedding, preprocessImage } from '@/utils/embeddingUtils';
import { findClosestLabel, calculateTraitRarity } from '@/utils/traitUtils';
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
  const [useAdvancedMode, setUseAdvancedMode] = useState(false);

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
      // Load standard model (faster and more reliable)
      await loadModel();
      
      toast({
        title: "🚀 AI Analysis Starting",
        description: `Processing ${uploadedImages.length} images with enhanced detection`
      });

      console.log('🧠 AI classification starting');

      for (let i = 0; i < uploadedImages.length; i++) {
        const file = uploadedImages[i];
        console.log(`🔍 Processing image ${i + 1}/${uploadedImages.length}: ${file.name}`);
        
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);
        
        const detectedTraits: any = {};
        const confidenceScores: any = {};
        const detectionStatus: any = {};
        
        // Standard detection with proven reliability
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          console.log(`🎯 Analyzing ${traitCategory} for ${file.name}`);
          const result = findClosestLabel(embedding, traitValues as any);
          
          if (result && result.label !== 'Not Detected' && result.confidence >= 0.7) {
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

        // Create properly formatted attributes array
        const attributes = Object.entries(detectedTraits)
          .filter(([_, value]) => value !== 'Not Detected')
          .map(([trait_type, value]) => ({
            trait_type,
            value: value as string,
            confidence: confidenceScores[trait_type],
            rarity: "0%" // Will be calculated later
          }));

        // Enhanced metadata generation with proper structure
        const metadata = {
          name: `NFT #${String(i + 1).padStart(4, '0')}`,
          description: "AI-generated NFT with enhanced trait detection",
          image: `ipfs://YOUR-HASH/${file.name}`,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          collectionName: "AI Detected Trait Collection",
          collectionDescription: "Generated with Enhanced AI Detection",
          attributes, // This is the key fix - proper attributes array
          allTraitAnalysis: Object.entries(detectedTraits).map(([trait_type, value]) => ({
            trait_type,
            value: value === 'Not Detected' ? 'Not Detected' : value as string,
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
        title: "🎉 Analysis Complete!",
        description: `${uploadedImages.length} images analyzed. ${detectedCount} traits detected (avg: ${Math.round(avgConfidence * 100)}% confidence)`
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
        return 'Running enhanced AI analysis...';
      case 'calculating':
        return 'Computing trait frequencies and rarity percentages...';
      case 'complete':
        return 'Analysis complete!';
      default:
        return 'Ready to start analysis';
    }
  };

  return (
    <div className="space-y-6">
      {/* Simplified AI Notice */}
      <Card className="bg-blue-900/20 border-blue-600">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="text-blue-200 font-medium">🚀 Enhanced AI Detection</h4>
              <div className="text-sm text-blue-200 space-y-1">
                <p><strong>Reliable Detection:</strong> Uses proven AI models for consistent results</p>
                <p><strong>Quality Focused:</strong> Balanced accuracy and performance</p>
                <p><strong>Fast Processing:</strong> Optimized for speed and reliability</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            🚀 Enhanced AI Detection
          </CardTitle>
          <CardDescription className="text-slate-400">
            Reliable trait detection with proven AI models for consistent results
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
            {classifying ? 'Running Analysis...' : '🚀 Start Enhanced Detection'}
          </Button>
        </CardContent>
      </Card>

      {/* Results with Editable Metadata */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" />
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
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Collection Statistics
            </CardTitle>
            <CardDescription className="text-slate-400">
              Trait distribution and confidence analysis from enhanced detection
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
