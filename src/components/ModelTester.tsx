import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ImagePlus, AlertTriangle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { loadModel, getImageEmbedding, preprocessImage } from '@/utils/embeddingUtils';
import { findClosestLabel } from '@/utils/traitUtils';
import { enhancedDetector } from '@/utils/enhancedDetection';
import * as tf from '@tensorflow/tfjs';

interface TrainingExample {
  embedding: tf.Tensor;
  fileName: string;
  imageUrl: string;
}

interface TrainedTraits {
  [category: string]: {
    [value: string]: TrainingExample[];
  };
}

interface ModelTesterProps {
  trainedTraits: TrainedTraits;
}

interface DetectionResult {
  label: string;
  confidence: number;
  avgSimilarity: number;
  individualScores: number[];
}

const ModelTester = ({ trainedTraits }: ModelTesterProps) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [imageEmbedding, setImageEmbedding] = useState<tf.Tensor | null>(null);
  const [feedback, setFeedback] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadModel().then(() => {
      setModelLoaded(true);
      toast({
        title: "Enhanced AI Model Loaded ✅",
        description: "MobileNet v2 ready with improved accuracy"
      });
    }).catch((error) => {
      console.error('Model loading failed:', error);
      toast({
        title: "Model Loading Failed",
        description: "Please refresh and try again",
        variant: "destructive"
      });
    });
  }, []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setResults([]);
    setFeedback({});

    try {
      const img = await loadImageFromFile(file);
      const processedImg = await preprocessImage(img);
      const embedding = await getImageEmbedding(processedImg);
      setImageEmbedding(embedding);
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Error Processing Image",
        description: "Could not create embedding",
        variant: "destructive"
      });
    }
  };

  const runDetection = async () => {
    if (!modelLoaded) {
      toast({
        title: "Model not ready",
        description: "Please wait for the AI model to load",
        variant: "destructive"
      });
      return;
    }

    if (!imageEmbedding) {
      toast({
        title: "No image embedding",
        description: "Please upload an image first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setResults([]);
    setFeedback({});

    try {
      const detectedTraits: any = {};
      const confidenceScores: any = {};
      const detectionStatus: any = {};

      for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
        const result = findClosestLabel(imageEmbedding, traitValues as any, traitCategory);

        if (result && result.label !== 'Not Detected') {
          detectedTraits[traitCategory] = result.label;
          confidenceScores[traitCategory] = result.confidence;
          detectionStatus[traitCategory] = 'detected';
        } else {
          detectionStatus[traitCategory] = 'not_detected';
          confidenceScores[traitCategory] = result?.confidence || 0;
        }
      }

      setResults([{
        imageUrl: imageUrl,
        fileName: imageFile?.name,
        detectedTraits: detectedTraits,
        confidenceScores: confidenceScores,
        detectionStatus: detectionStatus,
        imageEmbedding: imageEmbedding // Store the embedding for feedback
      }]);

      toast({
        title: "Detection Complete ✅",
        description: `Detected traits in ${imageFile?.name}`
      });
    } catch (error) {
      console.error('Detection failed:', error);
      toast({
        title: "Detection failed",
        description: "Error during trait detection",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (imageIndex: number, category: string, isCorrect: boolean, correctValue?: string) => {
    const result = results[imageIndex];
    if (!result) return;

    const detectedValue = result.detectedTraits[category];
    const actualCorrectValue = correctValue || detectedValue;

    // Store the feedback correction in the enhanced detector
    if (!isCorrect && correctValue && result.imageEmbedding) {
      enhancedDetector.addFeedbackCorrection(
        result.imageEmbedding,
        detectedValue || 'Not Detected',
        correctValue,
        category,
        result.fileName
      );

      toast({
        title: "Feedback Recorded ✅",
        description: `AI will remember: ${category} should be "${correctValue}" for similar images`
      });
    } else if (isCorrect) {
      toast({
        title: "Feedback Recorded ✅", 
        description: `AI confirmed: ${category} detection was correct`
      });
    }

    setFeedback(prevFeedback => ({
      ...prevFeedback,
      [`${imageIndex}-${category}`]: isCorrect
    }));
  };

  const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">Test AI Model</CardTitle>
          <CardDescription className="text-slate-400">
            Upload an image to test the trained AI model
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <Label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {imageUrl ? (
                  <img src={imageUrl} alt="Uploaded" className="max-h-56 max-w-full rounded-md" />
                ) : (
                  <>
                    <ImagePlus className="w-8 h-8 text-slate-500 mb-4" />
                    <p className="text-sm text-slate-500">
                      Click to upload or drag and drop an image
                    </p>
                    <p className="text-xs text-slate-500">
                      SVG, PNG, JPG, or GIF (max. 800x400px)
                    </p>
                  </>
                )}
              </div>
              <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </Label>
          </div>

          <Button onClick={runDetection} disabled={!imageUrl || loading} className="w-full">
            {loading ? 'Running Detection...' : 'Run Detection'}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white">Detection Results</CardTitle>
            <CardDescription className="text-slate-400">
              Review the detected traits and provide feedback
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="space-y-3">
                <div className="aspect-w-4 aspect-h-3">
                  <img src={result.imageUrl} alt="Detected" className="rounded-md object-cover" />
                </div>
                <div className="space-y-2">
                  {Object.entries(trainedTraits).map(([category, values]) => (
                    <div key={category} className="space-y-1">
                      <Label className="text-white">{category}</Label>
                      <div className="flex items-center justify-between">
                        <div className="text-slate-400">
                          Detected: {result.detectedTraits[category] || 'Not Detected'}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeedback(index, category, true)}
                            disabled={feedback[`${index}-${category}`] === true}
                          >
                            <CheckCircle className={`w-4 h-4 ${feedback[`${index}-${category}`] === true ? 'text-green-500' : 'text-slate-500'}`} />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Label htmlFor={`correct-${index}-${category}`} className="cursor-pointer">
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Label>
                            <Input
                              type="text"
                              id={`correct-${index}-${category}`}
                              placeholder="Correct Value"
                              className="hidden"
                              onBlur={(e) => {
                                const correctValue = e.target.value.trim();
                                if (correctValue) {
                                  handleFeedback(index, category, false, correctValue);
                                }
                              }}
                            />
                          </Button>
                        </div>
                      </div>
                      {result.detectionStatus[category] === 'not_detected' && result.confidenceScores[category] > 0.6 && (
                        <div className="text-yellow-400 text-sm flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Low confidence ({Math.round(result.confidenceScores[category] * 100)}%)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModelTester;
