import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, Eye, BarChart3, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { getImageEmbedding, preprocessImage } from '@/utils/embeddingUtils';
import { findClosestLabel, calculateTraitRarity, analyzeTrainingData } from '@/utils/traitUtils';

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
      // Enhanced pre-analysis
      const trainingAnalysis = analyzeTrainingData(trainedTraits);
      const adaptiveThreshold = trainingAnalysis.qualityScore > 0.7 ? 0.7 : 0.75;
      
      toast({
        title: "Starting Enhanced Analysis",
        description: `Processing ${uploadedImages.length} images with adaptive threshold (${Math.round(adaptiveThreshold * 100)}%)`
      });

      console.log('Enhanced classification starting with adaptive threshold:', adaptiveThreshold);
      console.log('Training quality score:', trainingAnalysis.qualityScore.toFixed(2));

      for (let i = 0; i < uploadedImages.length; i++) {
        const file = uploadedImages[i];
        console.log(`Processing image ${i + 1}/${uploadedImages.length}: ${file.name}`);
        
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);
        
        const detectedTraits: any = {};
        const confidenceScores: any = {};
        const detectionStatus: any = {};
        
        // Enhanced detection with adaptive thresholds
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          console.log(`Analyzing ${traitCategory} for ${file.name}`);
          const result = findClosestLabel(embedding, traitValues as any);
          
          if (result) {
            const isDetected = result.confidence >= adaptiveThreshold;
            
            if (isDetected) {
              detectedTraits[traitCategory] = result.label;
              confidenceScores[traitCategory] = result.confidence;
              detectionStatus[traitCategory] = 'detected';
              console.log(`✅ ${traitCategory}: ${result.label} (${Math.round(result.confidence * 100)}%)`);
            } else {
              detectedTraits[traitCategory] = 'Not Detected';
              confidenceScores[traitCategory] = result.confidence;
              detectionStatus[traitCategory] = 'not_detected';
              console.log(`❌ ${traitCategory}: Not detected (${Math.round(result.confidence * 100)}% - below ${Math.round(adaptiveThreshold * 100)}%)`);
            }
          } else {
            detectedTraits[traitCategory] = 'Not Detected';
            confidenceScores[traitCategory] = 0;
            detectionStatus[traitCategory] = 'not_detected';
            console.log(`❌ ${traitCategory}: No detection result`);
          }
        }

        // Clean up tensor
        embedding.dispose();

        // Enhanced metadata generation
        const metadata = {
          name: `NFT #${String(i + 1).padStart(4, '0')}`,
          description: "AI-generated NFT with enhanced trait detection",
          image: `ipfs://YOUR-HASH/${file.name}`,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          collectionName: "Enhanced AI Trait Collection",
          collectionDescription: "Generated with Enhanced AI Trait Forge",
          processingInfo: {
            adaptiveThreshold: adaptiveThreshold,
            trainingQuality: trainingAnalysis.qualityScore,
            detectionMethod: "Enhanced MobileNet v2"
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
            isDetected: detectionStatus[trait_type] === 'detected',
            threshold: adaptiveThreshold
          }))
        };

        metadataArray.push(metadata);
        setProgress(Math.round(((i + 1) / uploadedImages.length) * 50));
        
        if (i % 10 === 0 || i === uploadedImages.length - 1) {
          setResults([...metadataArray]);
        }
      }

      // Phase 2: Calculate rarities for detected traits only
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
        
        // Update allTraitAnalysis with rarities too
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
        title: "Enhanced Analysis Complete! 🎉",
        description: `${uploadedImages.length} images analyzed, ${detectedCount} traits detected (avg: ${Math.round(avgConfidence * 100)}% confidence)`
      });
    } catch (error) {
      console.error('Classification failed:', error);
      toast({
        title: "Classification failed",
        description: "Error during enhanced trait detection",
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
      {/* Important Detection Notice */}
      <Card className="bg-yellow-900/20 border-yellow-600">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="text-yellow-200 font-medium">Detection Guide</h4>
              <div className="text-sm text-yellow-200 space-y-1">
                <p><strong>🟢 Green:</strong> Trait detected with high confidence (70%+)</p>
                <p><strong>🟡 Yellow:</strong> Trait NOT DETECTED (confidence below 70%)</p>
                <p>Only green (detected) traits will be included in your final metadata.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classification Controls */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Trait Detection (Enhanced)
          </CardTitle>
          <CardDescription className="text-slate-400">
            Analyze your collection using consistent detection thresholds with ModelTester
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Grid */}
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
            {classifying ? 'Analyzing Collection...' : 'Start Improved AI Analysis'}
          </Button>
        </CardContent>
      </Card>

      {/* Results Preview with enhanced status display */}
      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-400" />
              Detection Results (Enhanced with Clear Status)
            </CardTitle>
            <CardDescription className="text-slate-400">
              Clear detection status with confidence scores and explanations
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

            {/* Current Item Preview with enhanced display */}
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
                    {results[previewIndex].allTraitAnalysis.map((analysis: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-slate-800/50 rounded">
                        <span className="text-slate-300 text-sm font-medium">{analysis.trait_type}</span>
                        <div className="flex items-center gap-2">
                          {analysis.isDetected ? (
                            <>
                              <Badge variant="secondary" className="bg-green-900 text-green-300">
                                {analysis.value}
                              </Badge>
                              <div className="text-xs text-slate-300 text-right">
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-green-400" />
                                  {Math.round(analysis.confidence * 100)}% confident
                                </div>
                                <div>{analysis.rarity}</div>
                              </div>
                            </>
                          ) : (
                            <>
                              <Badge variant="outline" className="bg-yellow-900/50 text-yellow-300 border-yellow-600">
                                Not Detected
                              </Badge>
                              <div className="text-xs text-yellow-400 text-right">
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-yellow-400" />
                                  {Math.round(analysis.confidence * 100)}% (too low)
                                </div>
                                <div className="text-yellow-400">Below 70% threshold</div>
                              </div>
                            </>
                          )}
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
