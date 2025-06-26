
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, Eye, BarChart3, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { getImageEmbedding } from '@/utils/embeddingUtils';
import { findClosestLabel, calculateTraitRarity } from '@/utils/traitUtils';

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
      // Phase 1: Analyze each image
      toast({
        title: "Starting analysis",
        description: `Processing ${uploadedImages.length} images...`
      });

      for (let i = 0; i < uploadedImages.length; i++) {
        const file = uploadedImages[i];
        const img = await loadImageFromFile(file);
        const embedding = await getImageEmbedding(img);
        
        const detectedTraits: any = {};
        const confidenceScores: any = {};
        
        // Classify each trained trait category
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          const result = findClosestLabel(embedding, traitValues as any);
          if (result) {
            detectedTraits[traitCategory] = result.label;
            confidenceScores[traitCategory] = result.confidence;
          }
        }

        // Generate initial metadata
        const metadata = {
          name: `NFT #${String(i + 1).padStart(4, '0')}`,
          description: "AI-generated NFT with automatically detected traits",
          image: `ipfs://YOUR-HASH/${file.name}`,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          collectionName: "AI Trait Collection",
          collectionDescription: "Generated with AI Trait Forge",
          attributes: Object.entries(detectedTraits).map(([trait_type, value]) => ({
            trait_type,
            value,
            confidence: confidenceScores[trait_type],
            rarity: "0%" // Will be calculated in phase 2
          }))
        };

        metadataArray.push(metadata);
        setProgress(Math.round(((i + 1) / uploadedImages.length) * 50)); // First 50% for analysis
        
        // Update results incrementally for preview
        if (i % 10 === 0 || i === uploadedImages.length - 1) {
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
        
        setProgress(50 + Math.round(((i + 1) / metadataArray.length) * 50)); // Second 50% for rarity calculation
      }

      onMetadataGenerated(metadataArray);
      setResults(metadataArray);
      setCurrentPhase('complete');
      
      toast({
        title: "Analysis complete! 🎉",
        description: `Successfully analyzed ${uploadedImages.length} images with trait detection and rarity calculation`
      });
    } catch (error) {
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
    
    // Calculate average confidences
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
        return 'Running AI analysis on each image...';
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
      {/* Classification Controls */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Trait Detection
          </CardTitle>
          <CardDescription className="text-slate-400">
            Analyze your collection using trained trait models
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
              {currentPhase === 'analyzing' && (
                <p className="text-xs text-slate-500">
                  Phase 1/2: AI analyzing each image for trait detection
                </p>
              )}
              {currentPhase === 'calculating' && (
                <p className="text-xs text-slate-500">
                  Phase 2/2: Computing rarity percentages across collection
                </p>
              )}
            </div>
          )}

          <Button 
            onClick={startClassification}
            disabled={!canClassify || classifying}
            className="w-full"
            size="lg"
          >
            <Play className="w-5 h-5 mr-2" />
            {classifying ? 'Analyzing Collection...' : 'Start AI Analysis'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Preview */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-400" />
              Detection Results
            </CardTitle>
            <CardDescription className="text-slate-400">
              Preview of AI-detected traits with confidence scores
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

            {/* Current Item Preview */}
            {results[previewIndex] && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="aspect-square bg-slate-800 rounded-lg overflow-hidden">
                  <img
                    src={results[previewIndex].imageUrl}
                    alt={results[previewIndex].name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-3">
                  <h4 className="text-lg font-medium text-white">
                    {results[previewIndex].name}
                  </h4>
                  <div className="text-sm text-slate-400">
                    File: {results[previewIndex].fileName}
                  </div>
                  <div className="space-y-2">
                    {results[previewIndex].attributes.map((attr: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-slate-800/50 rounded">
                        <span className="text-slate-300 text-sm font-medium">{attr.trait_type}</span>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="secondary" 
                            className={attr.confidence >= 0.7 ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}
                          >
                            {attr.value}
                          </Badge>
                          <div className="text-xs text-slate-400 text-right">
                            <div>{attr.rarity}</div>
                            <div className="flex items-center gap-1">
                              {attr.confidence >= 0.7 ? 
                                <CheckCircle className="w-3 h-3 text-green-400" /> : 
                                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                              }
                              {Math.round((attr.confidence || 0) * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
              Trait distribution and confidence analysis
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
