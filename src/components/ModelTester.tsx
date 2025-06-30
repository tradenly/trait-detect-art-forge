
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
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [imageEmbeddings, setImageEmbeddings] = useState<tf.Tensor[]>([]);
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
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setImageFiles(files);
    const urls = files.map(file => URL.createObjectURL(file));
    setImageUrls(urls);
    setResults([]);
    setFeedback({});

    try {
      const embeddings: tf.Tensor[] = [];
      
      for (const file of files) {
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);
        embeddings.push(embedding);
      }
      
      setImageEmbeddings(embeddings);
      
      toast({
        title: "Images processed",
        description: `${files.length} images ready for testing`
      });
    } catch (error) {
      console.error('Error processing images:', error);
      toast({
        title: "Error Processing Images",
        description: "Could not create embeddings",
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

    if (imageEmbeddings.length === 0) {
      toast({
        title: "No image embeddings",
        description: "Please upload images first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setResults([]);
    setFeedback({});

    try {
      const detectionResults: any[] = [];

      for (let i = 0; i < imageEmbeddings.length; i++) {
        const embedding = imageEmbeddings[i];
        const detectedTraits: any = {};
        const confidenceScores: any = {};
        const detectionStatus: any = {};

        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          const result = findClosestLabel(embedding, traitValues as any, traitCategory);

          if (result && result.label !== 'Not Detected') {
            detectedTraits[traitCategory] = result.label;
            confidenceScores[traitCategory] = result.confidence;
            detectionStatus[traitCategory] = 'detected';
          } else {
            detectionStatus[traitCategory] = 'not_detected';
            confidenceScores[traitCategory] = result?.confidence || 0;
          }
        }

        detectionResults.push({
          imageUrl: imageUrls[i],
          fileName: imageFiles[i]?.name,
          detectedTraits: detectedTraits,
          confidenceScores: confidenceScores,
          detectionStatus: detectionStatus,
          imageEmbedding: embedding // Store the embedding for feedback
        });
      }

      setResults(detectionResults);

      toast({
        title: "Detection Complete ✅",
        description: `Detected traits in ${detectionResults.length} images`
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
            Upload multiple images to test the trained AI model
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <Label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {imageUrls.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-w-sm">
                    {imageUrls.slice(0, 6).map((url, index) => (
                      <img key={index} src={url} alt={`Uploaded ${index + 1}`} className="h-16 w-16 object-cover rounded-md" />
                    ))}
                    {imageUrls.length > 6 && (
                      <div className="h-16 w-16 bg-slate-700 rounded-md flex items-center justify-center text-xs text-slate-400">
                        +{imageUrls.length - 6}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <ImagePlus className="w-8 h-8 text-slate-500 mb-4" />
                    <p className="text-sm text-slate-500">
                      Click to upload or drag and drop multiple images
                    </p>
                    <p className="text-xs text-slate-500">
                      SVG, PNG, JPG, or GIF (max. 800x400px each)
                    </p>
                  </>
                )}
              </div>
              <input id="dropzone-file" type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
            </Label>
          </div>

          {imageUrls.length > 0 && (
            <p className="text-sm text-slate-400 text-center">
              {imageUrls.length} images uploaded and ready for testing
            </p>
          )}

          <Button onClick={runDetection} disabled={imageUrls.length === 0 || loading} className="w-full">
            {loading ? 'Running Detection...' : `Run Detection on ${imageUrls.length} Images`}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white">Detection Results</CardTitle>
            <CardDescription className="text-slate-400">
              Review the detected traits and provide feedback for each image
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {results.map((result, index) => (
              <div key={index} className="space-y-3 p-4 bg-slate-800/30 rounded-lg">
                <div className="flex items-start gap-4">
                  <img src={result.imageUrl} alt="Detected" className="w-24 h-24 rounded-md object-cover" />
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-2">{result.fileName}</h4>
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
