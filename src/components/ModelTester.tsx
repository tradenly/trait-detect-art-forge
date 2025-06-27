
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TestTube, Upload, CheckCircle, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { getImageEmbedding, preprocessImage, validateTrainingQuality } from '@/utils/embeddingUtils';
import { findClosestLabel, validateDetectionResults } from '@/utils/traitUtils';

interface ModelTesterProps {
  trainedTraits: any;
  onTestCompleted: () => void;
  modelTested: boolean;
}

const ModelTester = ({ trainedTraits, onTestCompleted, modelTested }: ModelTesterProps) => {
  const [testImages, setTestImages] = useState<File[]>([]);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [corrections, setCorrections] = useState<any>({});
  const [correctionsMade, setCorrectionsMade] = useState(false);

  const handleTestImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 10) {
      toast({
        title: "Too many test images",
        description: "Please upload 2-10 test images only",
        variant: "destructive"
      });
      return;
    }
    
    setTestImages(imageFiles);
    setTestResults([]);
    setCorrections({});
    setCorrectionsMade(false);
  };

  const runModelTest = async () => {
    if (testImages.length === 0) {
      toast({
        title: "No test images",
        description: "Please upload test images first",
        variant: "destructive"
      });
      return;
    }

    // Validate training quality first
    const validationIssues: string[] = [];
    Object.entries(trainedTraits).forEach(([category, traits]: [string, any]) => {
      Object.entries(traits).forEach(([value, examples]: [string, any]) => {
        const validation = validateTrainingQuality(examples);
        if (!validation.isValid) {
          validationIssues.push(`${category} → ${value}: ${validation.issues.join(', ')}`);
        }
      });
    });

    if (validationIssues.length > 0) {
      toast({
        title: "Training Quality Issues Detected",
        description: "Some traits may have insufficient training data",
        variant: "destructive"
      });
      console.warn('Training issues:', validationIssues);
    }

    setTesting(true);
    setTestProgress(0);
    setCorrectionsMade(false);
    const results: any[] = [];

    try {
      for (let i = 0; i < testImages.length; i++) {
        const file = testImages[i];
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);
        
        const detectedTraits: any = {};
        const confidenceScores: any = {};
        
        // Test each trained trait category - ENSURE ALL categories are tested
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          const result = findClosestLabel(embedding, traitValues as any);
          if (result) {
            detectedTraits[traitCategory] = result.label;
            confidenceScores[traitCategory] = result.confidence;
          } else {
            detectedTraits[traitCategory] = 'Unknown';
            confidenceScores[traitCategory] = 0;
          }
        }

        // Clean up tensor
        embedding.dispose();

        results.push({
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          detectedTraits,
          confidenceScores,
          needsReview: Object.values(confidenceScores).some((conf: any) => conf < 0.7)
        });

        setTestProgress(Math.round(((i + 1) / testImages.length) * 100));
      }

      setTestResults(results);
      
      // Validate overall results
      const validation = validateDetectionResults(results);
      
      if (validation.accuracy > 0.7) {
        toast({
          title: "Model test successful! ✅",
          description: `Average accuracy: ${Math.round(validation.accuracy * 100)}%. Your AI model is ready!`
        });
      } else {
        toast({
          title: "Model performance review needed",
          description: `Accuracy: ${Math.round(validation.accuracy * 100)}%. Please review and correct the results below.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Test failed:', error);
      toast({
        title: "Test failed",
        description: "Error testing the model. Please try again.",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
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

  const handleCorrectionToggle = (resultIndex: number, traitType: string, isCorrect: boolean) => {
    const newCorrections = { ...corrections };
    if (!newCorrections[resultIndex]) {
      newCorrections[resultIndex] = {};
    }
    
    // Store whether the AI prediction was correct or not
    newCorrections[resultIndex][traitType] = {
      aiPrediction: testResults[resultIndex].detectedTraits[traitType],
      isCorrect: isCorrect,
      confidence: testResults[resultIndex].confidenceScores[traitType]
    };
    
    setCorrections(newCorrections);
    setCorrectionsMade(true);
    
    toast({
      title: isCorrect ? "Marked as correct ✅" : "Marked as incorrect ❌",
      description: `${traitType}: "${testResults[resultIndex].detectedTraits[traitType]}" - feedback recorded`
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.7) return CheckCircle;
    return AlertCircle;
  };

  const getOverallAccuracy = () => {
    if (testResults.length === 0) return 0;
    const validation = validateDetectionResults(testResults);
    return validation.accuracy;
  };

  const getCorrectionFeedback = () => {
    let correctCount = 0;
    let totalCount = 0;
    
    Object.values(corrections).forEach((imageCorrections: any) => {
      Object.values(imageCorrections).forEach((correction: any) => {
        totalCount++;
        if (correction.isCorrect) correctCount++;
      });
    });
    
    return totalCount > 0 ? correctCount / totalCount : 0;
  };

  return (
    <div className="space-y-6">
      {/* Training Quality Check */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <TestTube className="w-5 h-5 text-blue-400" />
          <h4 className="font-medium text-white">Model Testing Instructions</h4>
        </div>
        <div className="text-slate-300 text-sm space-y-2">
          <p>Upload 2-10 test images to verify your AI model can detect traits correctly.</p>
          <p><strong>Important:</strong> Use images that clearly show the traits you trained for, but weren't used in training.</p>
          <p>Review each result and toggle whether the AI got it right or wrong.</p>
        </div>
      </div>

      {/* Upload Test Images */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white text-lg">Upload Test Images</CardTitle>
          <CardDescription className="text-slate-400">
            Select images to test your trained model
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleTestImageUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-lg p-6 text-center transition-colors">
              <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="text-white font-medium">Upload Test Images</p>
              <p className="text-slate-400 text-sm">2-10 images recommended</p>
            </div>
          </div>

          {testImages.length > 0 && (
            <div className="space-y-3">
              <p className="text-white font-medium">{testImages.length} test images uploaded</p>
              <div className="grid grid-cols-6 gap-2">
                {testImages.map((file, index) => (
                  <div key={index} className="aspect-square bg-slate-600 rounded overflow-hidden">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Test ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={runModelTest}
                disabled={testing}
                className="w-full"
                size="lg"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Testing Model...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-2" />
                    Test AI Model
                  </>
                )}
              </Button>
            </div>
          )}

          {testing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Testing images...</span>
                <span className="text-slate-400">{testProgress}%</span>
              </div>
              <Progress value={testProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results with Simple Yes/No Interface */}
      {testResults.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {modelTested ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              )}
              Review AI Predictions
            </CardTitle>
            <CardDescription className="text-slate-400">
              For each image, check if the AI detected the traits correctly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {testResults.map((result, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                  <div className="aspect-square bg-slate-600 rounded overflow-hidden">
                    <img
                      src={result.imageUrl}
                      alt={result.fileName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-white">{result.fileName}</h4>
                    
                    <div className="space-y-4">
                      {Object.entries(result.detectedTraits).map(([trait, value]: [string, any]) => {
                        const confidence = result.confidenceScores[trait] || 0;
                        const ConfidenceIcon = getConfidenceIcon(confidence);
                        const correction = corrections[index]?.[trait];
                        
                        return (
                          <div key={trait} className="space-y-3 p-3 bg-slate-700/50 rounded">
                            {/* AI Prediction */}
                            <div className="flex justify-between items-center">
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-slate-300">{trait}</div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    AI detected: {value}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <ConfidenceIcon className={`w-3 h-3 ${getConfidenceColor(confidence)}`} />
                                    <span className={`text-xs ${getConfidenceColor(confidence)}`}>
                                      {Math.round(confidence * 100)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Correction Interface */}
                            <div className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                              <Label className="text-sm text-slate-300">
                                Is this detection correct?
                              </Label>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">No</span>
                                  <Switch
                                    checked={correction?.isCorrect || false}
                                    onCheckedChange={(checked) => handleCorrectionToggle(index, trait, checked)}
                                  />
                                  <span className="text-xs text-slate-400">Yes</span>
                                </div>
                                {correction && (
                                  <Badge variant={correction.isCorrect ? "default" : "destructive"} className="text-xs">
                                    {correction.isCorrect ? "✓ Correct" : "✗ Wrong"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Overall Assessment */}
            <div className="mt-6 p-4 bg-slate-800/30 rounded-lg">
              <h4 className="font-medium text-white mb-3">Assessment Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300">
                      AI Confidence: {Math.round(getOverallAccuracy() * 100)}%
                    </span>
                  </div>
                  {correctionsMade && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-slate-300">
                        Your Feedback: {Math.round(getCorrectionFeedback() * 100)}% correct
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {correctionsMade && (
                    <Button
                      onClick={() => {
                        setTestResults([]);
                        setCorrections({});
                        setCorrectionsMade(false);
                        toast({
                          title: "Ready to test again",
                          description: "Upload new test images or retest with the same ones"
                        });
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Test AI Again
                    </Button>
                  )}
                  {getOverallAccuracy() > 0.7 && (
                    <Button
                      onClick={onTestCompleted}
                      size="sm"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Continue to Collection
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModelTester;
