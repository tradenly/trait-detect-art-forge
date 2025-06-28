import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TestTube, Upload, CheckCircle, AlertCircle, AlertTriangle, RefreshCw, ThumbsUp, ThumbsDown, X, Brain } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { getImageEmbedding, preprocessImage, validateTrainingQuality } from '@/utils/embeddingUtils';
import { findClosestLabel, validateDetectionResults, analyzeTrainingData } from '@/utils/traitUtils';

interface TraitResult {
  label: string;
  confidence: number;
  avgSimilarity: number;
}

interface TestResult {
  fileName: string;
  imageUrl: string;
  results: { [category: string]: TraitResult };
  userFeedback?: { [category: string]: { correct: boolean; correctValue?: string } };
}

interface ModelTesterProps {
  trainedTraits: any;
  onTestCompleted: () => void;
}

const ModelTester = ({ trainedTraits, onTestCompleted }: ModelTesterProps) => {
  const [testImages, setTestImages] = useState<File[]>([]);
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTestIndex, setCurrentTestIndex] = useState(0);
  const [testingCompleted, setTestingCompleted] = useState(false);
  const [feedbackData, setFeedbackData] = useState<{ [key: string]: { correct: boolean; correctValue?: string } }>({});

  const handleTestImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setTestImages(files);
    setTestResults([]);
    setCurrentTestIndex(0);
    setTestingCompleted(false);
    
    if (files.length > 0) {
      toast({
        title: "Test Images Loaded",
        description: `Ready to test ${files.length} images with enhanced AI model`
      });
    }
  };

  const runTests = async () => {
    if (testImages.length === 0) {
      toast({
        title: "No test images",
        description: "Please upload test images first",
        variant: "destructive"
      });
      return;
    }

    if (Object.keys(trainedTraits).length === 0) {
      toast({
        title: "No trained traits",
        description: "Please train some traits first",
        variant: "destructive"
      });
      return;
    }

    // Pre-flight training data analysis
    const trainingAnalysis = analyzeTrainingData(trainedTraits);
    if (trainingAnalysis.qualityScore < 0.3) {
      toast({
        title: "Training Data Quality Warning",
        description: "Low training quality detected. Results may be inaccurate.",
        variant: "destructive"
      });
    }

    setTesting(true);
    setProgress(0);
    const results: TestResult[] = [];

    console.log('Starting enhanced model testing with trained traits:', Object.keys(trainedTraits));
    console.log('Training quality score:', trainingAnalysis.qualityScore.toFixed(2));

    try {
      for (let i = 0; i < testImages.length; i++) {
        const file = testImages[i];
        console.log(`Testing image ${i + 1}/${testImages.length}: ${file.name}`);
        
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);
        
        const imageResults: { [category: string]: TraitResult } = {};
        
        // Enhanced testing with adaptive thresholds
        for (const [category, categoryTraits] of Object.entries(trainedTraits)) {
          console.log(`Testing category: ${category}`);
          const result = findClosestLabel(embedding, categoryTraits as any);
          
          // Use adaptive threshold based on training quality
          const baseThreshold = 0.75;
          const qualityAdjustment = trainingAnalysis.qualityScore > 0.7 ? 0.05 : -0.05;
          const adaptiveThreshold = baseThreshold + qualityAdjustment;
          
          if (result && result.confidence >= adaptiveThreshold) {
            imageResults[category] = {
              label: result.label,
              confidence: result.confidence,
              avgSimilarity: result.avgSimilarity
            };
            console.log(`${category}: ${result.label} (confidence: ${result.confidence.toFixed(3)})`);
          } else {
            imageResults[category] = {
              label: 'Not Detected',
              confidence: result?.confidence || 0,
              avgSimilarity: result?.avgSimilarity || 0
            };
            console.log(`${category}: No confident detection (${result?.confidence.toFixed(3) || 0} < ${adaptiveThreshold.toFixed(3)})`);
          }
        }
        
        // Clean up tensor
        embedding.dispose();
        
        results.push({
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          results: imageResults
        });
        
        setProgress(Math.round(((i + 1) / testImages.length) * 100));
      }
      
      setTestResults(results);
      setCurrentTestIndex(0);
      setTestingCompleted(true);
      
      // Enhanced completion analysis
      const detectionAnalysis = validateDetectionResults(results);
      
      toast({
        title: "Enhanced Testing Complete! 🧪",
        description: `Tested ${testImages.length} images. Accuracy: ${Math.round(detectionAnalysis.accuracy * 100)}%`
      });
    } catch (error) {
      console.error('Testing failed:', error);
      toast({
        title: "Testing failed",
        description: "Error during model testing",
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

  const handleFeedbackToggle = (category: string, field: 'correct', value: boolean) => {
    setFeedbackData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const submitFeedback = () => {
    if (testResults[currentTestIndex]) {
      const updatedResults = [...testResults];
      updatedResults[currentTestIndex].userFeedback = { ...feedbackData };
      setTestResults(updatedResults);
      
      toast({
        title: "Feedback recorded ✅",
        description: "Your corrections have been saved for analysis"
      });
    }
    
    setFeedbackData({});
  };

  const completeTestingPhase = () => {
    onTestCompleted();
    toast({
      title: "Testing phase completed! ✅",
      description: "You can now proceed to upload your NFT collection"
    });
  };

  const getEnhancedStats = () => {
    if (Object.keys(trainedTraits).length === 0) return null;
    
    const analysis = analyzeTrainingData(trainedTraits);
    return {
      totalExamples: analysis.totalExamples,
      qualityScore: analysis.qualityScore,
      categories: Object.keys(trainedTraits).length,
      recommendations: analysis.recommendations
    };
  };

  const getConfidenceColor = (confidence: number, isDetected: boolean) => {
    if (!isDetected || confidence < 0.8) return 'text-yellow-400';
    if (confidence >= 0.9) return 'text-green-400';
    return 'text-blue-400';
  };

  const getConfidenceBadgeVariant = (confidence: number, isDetected: boolean) => {
    if (!isDetected || confidence < 0.8) return 'secondary';
    return 'default';
  };

  const currentResult = testResults[currentTestIndex];
  const enhancedStats = getEnhancedStats();

  return (
    <div className="space-y-6">
      {/* Enhanced Training Quality Indicator */}
      {enhancedStats && (
        <Card className={`${enhancedStats.qualityScore >= 0.7 ? 'bg-green-900/20 border-green-600' : enhancedStats.qualityScore >= 0.4 ? 'bg-yellow-900/20 border-yellow-600' : 'bg-red-900/20 border-red-600'}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Brain className={`w-5 h-5 ${enhancedStats.qualityScore >= 0.7 ? 'text-green-400' : enhancedStats.qualityScore >= 0.4 ? 'text-yellow-400' : 'text-red-400'} mt-0.5 flex-shrink-0`} />
              <div className="space-y-2">
                <h4 className={`font-medium ${enhancedStats.qualityScore >= 0.7 ? 'text-green-200' : enhancedStats.qualityScore >= 0.4 ? 'text-yellow-200' : 'text-red-200'}`}>
                  Training Quality: {Math.round(enhancedStats.qualityScore * 100)}%
                </h4>
                <div className="text-sm space-y-1">
                  <p>{enhancedStats.totalExamples} total examples across {enhancedStats.categories} categories</p>
                  {enhancedStats.recommendations.length > 0 && (
                    <p className="text-xs opacity-90">{enhancedStats.recommendations[0]}</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important Detection Guide */}
      <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-200">
            <strong>Detection Guide:</strong> Yellow percentages indicate traits that were <strong>NOT DETECTED</strong> (confidence below 80%). Green percentages show <strong>DETECTED</strong> traits with high confidence. This ensures more accurate results.
          </div>
        </div>
      </div>

      {/* Enhanced Test Controls */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TestTube className="w-5 h-5 text-blue-400" />
            Enhanced AI Model Testing
          </CardTitle>
          <CardDescription className="text-slate-400">
            Test with adaptive thresholds and comprehensive analysis for maximum accuracy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{testImages.length}</div>
              <div className="text-sm text-slate-400">Test Images</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{Object.keys(trainedTraits).length}</div>
              <div className="text-sm text-slate-400">Trait Categories</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{testResults.length}</div>
              <div className="text-sm text-slate-400">Tests Complete</div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-white">Upload Test Images</Label>
            <div className="relative">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleTestImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={testing}
              />
              <Button disabled={testing} className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                Select Test Images
              </Button>
            </div>
          </div>

          {testing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Testing AI model...</span>
                <span className="text-slate-400">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          <div>
            <Button 
              onClick={runTests}
              disabled={testImages.length === 0 || Object.keys(trainedTraits).length === 0 || testing}
              className="w-full"
            >
              <TestTube className="w-4 h-4 mr-2" />
              {testing ? 'Testing...' : 'Run AI Test'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Test Results Review
            </CardTitle>
            <CardDescription className="text-slate-400">
              Review AI predictions with full trait details. Yellow = Not Detected, Green = Detected with high confidence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Navigation */}
            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentTestIndex(Math.max(0, currentTestIndex - 1))}
                disabled={currentTestIndex === 0}
              >
                Previous
              </Button>
              <span className="text-white">
                {currentTestIndex + 1} of {testResults.length}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentTestIndex(Math.min(testResults.length - 1, currentTestIndex + 1))}
                disabled={currentTestIndex === testResults.length - 1}
              >
                Next
              </Button>
            </div>

            {/* Current Test Result */}
            {currentResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="aspect-square bg-slate-800 rounded-lg overflow-hidden">
                  <img
                    src={currentResult.imageUrl}
                    alt={currentResult.fileName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-white mb-1">
                      {currentResult.fileName}
                    </h4>
                    <p className="text-sm text-slate-400">AI Detection Results</p>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.entries(currentResult.results).map(([category, result]) => {
                      const isDetected = result.confidence >= 0.8 && result.label !== 'Not Detected';
                      const displayText = isDetected ? `${category}: ${result.label}` : `${category}: Not Detected`;
                      
                      return (
                        <div key={category} className="bg-slate-800/50 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-white font-medium">{category}</span>
                            <div className="flex items-center gap-2">
                              {isDetected ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Badge 
                                variant={getConfidenceBadgeVariant(result.confidence, isDetected)}
                                className={`${isDetected ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}
                              >
                                {displayText}
                              </Badge>
                              <span className={`text-sm font-mono ${getConfidenceColor(result.confidence, isDetected)}`}>
                                {Math.round(result.confidence * 100)}%
                              </span>
                            </div>
                            
                            {isDetected && (
                              <div className="text-xs text-slate-400 mt-1">
                                Detected Value: <span className="text-white font-medium">{result.label}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 pt-2">
                              <span className="text-xs text-slate-400">Is this correct?</span>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant={feedbackData[category]?.correct === true ? "default" : "outline"}
                                  onClick={() => handleFeedbackToggle(category, 'correct', true)}
                                  className="h-6 px-2"
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={feedbackData[category]?.correct === false ? "destructive" : "outline"}
                                  onClick={() => handleFeedbackToggle(category, 'correct', false)}
                                  className="h-6 px-2"
                                >
                                  <ThumbsDown className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {Object.keys(feedbackData).length > 0 && (
                    <Button onClick={submitFeedback} className="w-full">
                      Save Feedback for This Image
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Complete Testing Button */}
            {testingCompleted && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <Button 
                  onClick={completeTestingPhase}
                  className="w-full"
                  size="lg"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete Testing & Continue to Collection Upload
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModelTester;
