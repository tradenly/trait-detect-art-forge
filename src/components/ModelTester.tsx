
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TestTube, Upload, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { getImageEmbedding } from '@/utils/embeddingUtils';
import { findClosestLabel } from '@/utils/traitUtils';

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
    setTestResults([]); // Clear previous results
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

    setTesting(true);
    setTestProgress(0);
    const results: any[] = [];

    try {
      for (let i = 0; i < testImages.length; i++) {
        const file = testImages[i];
        const img = await loadImageFromFile(file);
        const embedding = await getImageEmbedding(img);
        
        const detectedTraits: any = {};
        const confidenceScores: any = {};
        
        // Test each trained trait category
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          const result = findClosestLabel(embedding, traitValues as any);
          if (result) {
            detectedTraits[traitCategory] = result.label;
            confidenceScores[traitCategory] = result.confidence;
          }
        }

        results.push({
          fileName: file.name,
          imageUrl: URL.createObjectURL(file),
          detectedTraits,
          confidenceScores
        });

        setTestProgress(Math.round(((i + 1) / testImages.length) * 100));
      }

      setTestResults(results);
      
      // Check if results look reasonable (at least some confidence > 0.5)
      const hasGoodResults = results.some(result => 
        Object.values(result.confidenceScores).some((conf: any) => conf > 0.5)
      );

      if (hasGoodResults) {
        onTestCompleted();
        toast({
          title: "Model test successful! ✅",
          description: "Your AI model is working well. You can proceed to the next step."
        });
      } else {
        toast({
          title: "Model needs more training",
          description: "Low confidence scores detected. Consider adding more training examples.",
          variant: "destructive"
        });
      }
    } catch (error) {
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.6) return CheckCircle;
    return AlertCircle;
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <TestTube className="w-5 h-5 text-blue-400" />
          <h4 className="font-medium text-white">Model Testing Instructions</h4>
        </div>
        <p className="text-slate-300 text-sm">
          Upload 2-10 test images to verify your AI model can detect traits correctly. 
          These should be images that weren't used in training but contain the traits you want to detect.
        </p>
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

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {modelTested ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-400" />
              )}
              Test Results
            </CardTitle>
            <CardDescription className="text-slate-400">
              AI model predictions with confidence scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                  <div className="aspect-square bg-slate-600 rounded overflow-hidden">
                    <img
                      src={result.imageUrl}
                      alt={result.fileName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium text-white">{result.fileName}</h4>
                    <div className="space-y-2">
                      {Object.entries(result.detectedTraits).map(([trait, value]: [string, any]) => {
                        const confidence = result.confidenceScores[trait] || 0;
                        const ConfidenceIcon = getConfidenceIcon(confidence);
                        
                        return (
                          <div key={trait} className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                            <span className="text-slate-300 text-sm">{trait}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{value}</Badge>
                              <div className="flex items-center gap-1">
                                <ConfidenceIcon className={`w-3 h-3 ${getConfidenceColor(confidence)}`} />
                                <span className={`text-xs ${getConfidenceColor(confidence)}`}>
                                  {Math.round(confidence * 100)}%
                                </span>
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
              <h4 className="font-medium text-white mb-2">Assessment</h4>
              {modelTested ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Model is ready for full collection analysis!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Consider adding more training examples for better accuracy.</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModelTester;
