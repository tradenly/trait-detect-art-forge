
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

const ModelTester = ({ trainedTraits }: ModelTesterProps) => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [imageEmbeddings, setImageEmbeddings] = useState<tf.Tensor[]>([]);
  const [feedback, setFeedback] = useState<{ [key: string]: boolean | string }>({});
  const [correctionInputs, setCorrectionInputs] = useState<{ [key: string]: string }>({});

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
    setCorrectionInputs({});

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
    setCorrectionInputs({});

    try {
      const detectionResults: any[] = [];

      for (let i = 0; i < imageEmbeddings.length; i++) {
        const embedding = imageEmbeddings[i];
        const detectedTraits: any = {};
        const confidenceScores: any = {};

        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          const result = findClosestLabel(embedding, traitValues as any, traitCategory);

          if (result && result.label !== 'Not Detected') {
            detectedTraits[traitCategory] = result.label;
            confidenceScores[traitCategory] = result.confidence;
          } else {
            detectedTraits[traitCategory] = 'Not Detected';
            confidenceScores[traitCategory] = result?.confidence || 0;
          }
        }

        detectionResults.push({
          imageUrl: imageUrls[i],
          fileName: imageFiles[i]?.name,
          detectedTraits: detectedTraits,
          confidenceScores: confidenceScores,
          imageEmbedding: embedding
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

  const handleFeedback = async (imageIndex: number, category: string, isCorrect: boolean) => {
    const result = results[imageIndex];
    if (!result) return;

    const feedbackKey = `${imageIndex}-${category}`;

    if (isCorrect) {
      // Positive feedback
      setFeedback(prev => ({
        ...prev,
        [feedbackKey]: true
      }));

      toast({
        title: "Feedback Recorded ✅",
        description: `Confirmed: ${category} detection was correct`
      });
    } else {
      // Negative feedback - show correction input
      setFeedback(prev => ({
        ...prev,
        [feedbackKey]: false
      }));

      toast({
        title: "Correction Needed",
        description: `Please enter the correct ${category} value below`,
        variant: "destructive"
      });
    }
  };

  const handleCorrectionSubmit = async (imageIndex: number, category: string) => {
    const result = results[imageIndex];
    const feedbackKey = `${imageIndex}-${category}`;
    const correctValue = correctionInputs[feedbackKey];

    if (!result || !correctValue?.trim()) {
      toast({
        title: "Error",
        description: "Please enter a correction value",
        variant: "destructive"
      });
      return;
    }

    const detectedValue = result.detectedTraits[category] || 'Not Detected';

    // Store the feedback correction in the enhanced detector
    if (result.imageEmbedding) {
      enhancedDetector.addFeedbackCorrection(
        result.imageEmbedding,
        detectedValue,
        correctValue.trim(),
        category,
        result.fileName
      );

      toast({
        title: "Correction Recorded ✅",
        description: `AI will learn: ${category} should be "${correctValue}" for similar images`
      });

      // Clear the input and mark as submitted
      setCorrectionInputs(prev => ({
        ...prev,
        [feedbackKey]: ''
      }));

      // Mark as corrected
      setFeedback(prev => ({
        ...prev,
        [feedbackKey]: 'corrected'
      }));
    }
  };

  const handleCorrectionInputChange = (imageIndex: number, category: string, value: string) => {
    const feedbackKey = `${imageIndex}-${category}`;
    setCorrectionInputs(prev => ({
      ...prev,
      [feedbackKey]: value
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
            Upload multiple images to test the trained AI model and provide feedback
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
            <CardTitle className="text-white">Detection Results & Feedback</CardTitle>
            <CardDescription className="text-slate-400">
              Review detected traits and provide feedback to improve AI accuracy. 
              <br />
              <span className="text-green-400">✓ = Correct detection</span> | <span className="text-red-400">✗ = Wrong detection (provide correction)</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {results.map((result, index) => (
              <div key={index} className="space-y-4 p-4 bg-slate-800/30 rounded-lg border border-slate-600">
                <div className="flex items-start gap-4">
                  <img src={result.imageUrl} alt="Test" className="w-24 h-24 rounded-md object-cover" />
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-3">{result.fileName}</h4>
                    <div className="space-y-3">
                      {Object.entries(trainedTraits).map(([category, values]) => {
                        const feedbackKey = `${index}-${category}`;
                        const detectedValue = result.detectedTraits[category];
                        const confidence = result.confidenceScores[category] || 0;
                        const feedbackValue = feedback[feedbackKey];
                        
                        return (
                          <div key={category} className="p-3 bg-slate-700/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex-1">
                                <Label className="text-white font-medium text-sm">{category}:</Label>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant={detectedValue === 'Not Detected' ? "destructive" : "secondary"}
                                    className={detectedValue === 'Not Detected' ? "bg-red-600 text-white" : "bg-blue-600 text-white"}
                                  >
                                    {detectedValue === 'Not Detected' ? `${category} - Not Detected` : `${category} - ${detectedValue}`}
                                  </Badge>
                                  {confidence > 0 && (
                                    <span className="text-slate-400 text-xs">
                                      {Math.round(confidence * 100)}% confidence
                                    </span>
                                  )}
                                  {detectedValue === 'Not Detected' && confidence > 0.5 && (
                                    <div className="text-yellow-400 text-xs flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      Uncertain
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleFeedback(index, category, true)}
                                  disabled={feedbackValue === true || feedbackValue === 'corrected'}
                                  className="h-8 w-8 p-0 group"
                                  title="Mark as correct detection"
                                >
                                  <CheckCircle className={`w-4 h-4 ${
                                    feedbackValue === true ? 'text-green-500' : 
                                    'text-slate-500 group-hover:text-green-400'
                                  }`} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleFeedback(index, category, false)}
                                  disabled={feedbackValue === false || feedbackValue === 'corrected'}
                                  className="h-8 w-8 p-0 group"
                                  title="Mark as wrong detection and provide correction"
                                >
                                  <XCircle className={`w-4 h-4 ${
                                    feedbackValue === false ? 'text-red-500' : 
                                    'text-slate-500 group-hover:text-red-400'
                                  }`} />
                                </Button>
                              </div>
                            </div>
                            
                            {feedbackValue === false && (
                              <div className="flex gap-2 mt-2">
                                <Input
                                  type="text"
                                  placeholder={`Enter correct ${category} value`}
                                  value={correctionInputs[feedbackKey] || ''}
                                  onChange={(e) => handleCorrectionInputChange(index, category, e.target.value)}
                                  className="bg-slate-600 border-slate-500 text-white text-sm"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleCorrectionSubmit(index, category)}
                                  disabled={!correctionInputs[feedbackKey]?.trim()}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  Submit
                                </Button>
                              </div>
                            )}

                            {feedbackValue === 'corrected' && (
                              <div className="text-green-400 text-sm mt-2">
                                ✅ Correction submitted - AI will learn from this feedback
                              </div>
                            )}
                          </div>
                        );
                      })}
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
