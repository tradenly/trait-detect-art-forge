import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, ImagePlus, AlertTriangle, Sparkles, Clock } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { loadModel, getImageEmbedding, preprocessImage } from '@/utils/embeddingUtils';
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

interface RareTrait {
  category: string;
  value: string;
  rarity: 'rare' | 'epic' | 'legendary';
  description?: string;
  imageUrls?: string[];
  fileNames?: string[];
}

interface ModelTesterProps {
  trainedTraits: TrainedTraits;
  rareTraits?: RareTrait[];
}

const ModelTester = ({ trainedTraits, rareTraits = [] }: ModelTesterProps) => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [imageEmbeddings, setImageEmbeddings] = useState<tf.Tensor[]>([]);
  const [feedback, setFeedback] = useState<{ [key: string]: boolean | string }>({});
  const [correctionInputs, setCorrectionInputs] = useState<{ [key: string]: string }>({});
  const [buttonClicked, setButtonClicked] = useState(false);
  
  // New states for image processing feedback
  const [processingImages, setProcessingImages] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);

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
    setImagesReady(false);
    setProcessingImages(true);
    setProcessingProgress(0);

    try {
      const embeddings: tf.Tensor[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);
        embeddings.push(embedding);
        
        // Update progress
        const progress = ((i + 1) / files.length) * 100;
        setProcessingProgress(progress);
      }
      
      setImageEmbeddings(embeddings);
      setProcessingImages(false);
      setImagesReady(true);
      
      toast({
        title: "Images Processed Successfully ✅",
        description: `${files.length} images are now ready for AI detection`
      });
    } catch (error) {
      console.error('Error processing images:', error);
      setProcessingImages(false);
      setImagesReady(false);
      toast({
        title: "Error Processing Images",
        description: "Could not create embeddings",
        variant: "destructive"
      });
    }
  };

  const detectRareTraits = (embedding: tf.Tensor): { detectedRareTraits: string[], confidence: number } => {
    const detectedRareTraits: string[] = [];
    let maxConfidence = 0;

    console.log(`🔍 Checking ${rareTraits.length} rare traits...`);

    for (const rareTrait of rareTraits) {
      console.log(`🎯 Checking rare trait: ${rareTrait.category} - ${rareTrait.value} (${rareTrait.rarity})`);
      
      // Check if we have training data for this rare trait
      const categoryTraits = trainedTraits[rareTrait.category];
      if (!categoryTraits || !categoryTraits[rareTrait.value]) {
        console.log(`❌ No training data found for rare trait: ${rareTrait.category} - ${rareTrait.value}`);
        continue;
      }

      // Use enhanced detector for rare trait detection
      const regularTraitResult = enhancedDetector.enhancedDetection(
        embedding, 
        categoryTraits, 
        rareTrait.category
      );
      
      console.log(`🔬 Rare trait detection result:`, regularTraitResult);
      
      if (regularTraitResult && regularTraitResult.label === rareTrait.value && regularTraitResult.confidence > 0.6) {
        const rareTraitLabel = `${rareTrait.category}: ${rareTrait.value} (${rareTrait.rarity})`;
        detectedRareTraits.push(rareTraitLabel);
        maxConfidence = Math.max(maxConfidence, regularTraitResult.confidence);
        console.log(`✅ Detected rare trait: ${rareTraitLabel} with confidence ${regularTraitResult.confidence}`);
      }
    }

    console.log(`🎉 Final rare traits detected: ${detectedRareTraits.length}`);
    return { detectedRareTraits, confidence: maxConfidence };
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

    if (!imagesReady || imageEmbeddings.length === 0) {
      toast({
        title: "Images not ready",
        description: "Please wait for images to finish processing",
        variant: "destructive"
      });
      return;
    }

    // Set button clicked state for visual feedback
    setButtonClicked(true);
    setTimeout(() => setButtonClicked(false), 2000); // Reset after 2 seconds

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
        const specificTraitResults: any = {};

        console.log(`🔍 Processing image ${i + 1}/${imageEmbeddings.length}`);

        // Use enhanced detector for ALL trait detection - TEST EACH VALUE SEPARATELY
        for (const [traitCategory, traitValues] of Object.entries(trainedTraits)) {
          console.log(`🎯 Detecting ${traitCategory} using enhanced detector`);
          
          // Test each possible value for this category separately
          const categoryResults: any = {};
          let bestResult: any = null;
          let bestConfidence = 0;
          
          for (const [traitValue, examples] of Object.entries(traitValues as any)) {
            if (Array.isArray(examples) && examples.length > 0) {
              // Test this specific trait value
              const singleTraitData = { [traitValue]: examples };
              const result = enhancedDetector.enhancedDetection(embedding, singleTraitData, traitCategory);
              
              categoryResults[traitValue] = {
                result: result,
                confidence: result?.confidence || 0,
                detected: result && result.label !== 'Not Detected'
              };
              
              console.log(`🔍 Testing ${traitCategory}:${traitValue} - ${result?.label || 'Not Detected'} (confidence: ${(result?.confidence || 0).toFixed(3)})`);
              
              // Track the best result for main detection
              if (result && result.label !== 'Not Detected' && (result.confidence || 0) > bestConfidence) {
                bestResult = result;
                bestConfidence = result.confidence || 0;
              }
            }
          }
          
          // Store all individual results for display
          specificTraitResults[traitCategory] = categoryResults;
          
          // Set main detection result
          if (bestResult) {
            detectedTraits[traitCategory] = bestResult.label;
            confidenceScores[traitCategory] = bestResult.confidence;
            console.log(`✅ ${traitCategory}: ${bestResult.label} (confidence: ${bestResult.confidence.toFixed(3)})`);
          } else {
            detectedTraits[traitCategory] = 'Not Detected';
            confidenceScores[traitCategory] = 0;
            console.log(`❌ ${traitCategory}: Not Detected`);
          }
        }

        // Note: Rare trait detection moved to collection analysis phase for better accuracy
        detectionResults.push({
          imageUrl: imageUrls[i],
          fileName: imageFiles[i]?.name,
          detectedTraits: detectedTraits,
          confidenceScores: confidenceScores,
          specificTraitResults: specificTraitResults,
          rareTraits: [], // Rare traits detected in collection analysis phase
          rareTraitConfidence: 0,
          imageEmbedding: embedding
        });
      }

      setResults(detectionResults);

      toast({
        title: "Detection Complete ✅",
        description: `Detected traits in ${detectionResults.length} images using enhanced AI`
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
      setFeedback(prev => ({
        ...prev,
        [feedbackKey]: true
      }));

      toast({
        title: "Feedback Recorded ✅",
        description: `Confirmed: ${category} detection was correct`
      });
    } else {
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

  const handleRareTraitFeedback = async (imageIndex: number, isCorrect: boolean) => {
    const result = results[imageIndex];
    if (!result) return;

    const feedbackKey = `${imageIndex}-rare-traits`;

    if (isCorrect) {
      setFeedback(prev => ({
        ...prev,
        [feedbackKey]: true
      }));

      toast({
        title: "Rare Trait Feedback Recorded ✅",
        description: "Confirmed: Rare trait detection was correct"
      });
    } else {
      setFeedback(prev => ({
        ...prev,
        [feedbackKey]: false
      }));

      toast({
        title: "Rare Trait Correction Needed",
        description: "Please specify the actual rare traits below",
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

    if (result.imageEmbedding) {
      console.log(`📝 SUBMITTING FEEDBACK: ${category}: "${detectedValue}" → "${correctValue.trim()}"`);
      
      enhancedDetector.addFeedbackCorrection(
        result.imageEmbedding,
        detectedValue,
        correctValue.trim(),
        category,
        result.fileName
      );

      // Log feedback system status
      enhancedDetector.logFeedbackStatus();

      toast({
        title: "Correction Recorded ✅",
        description: `AI will learn: ${category} should be "${correctValue}" for similar images`
      });

      setCorrectionInputs(prev => ({
        ...prev,
        [feedbackKey]: ''
      }));

      setFeedback(prev => ({
        ...prev,
        [feedbackKey]: 'corrected'
      }));
    }
  };

  const handleRareTraitCorrectionSubmit = async (imageIndex: number) => {
    const result = results[imageIndex];
    const feedbackKey = `${imageIndex}-rare-traits`;
    const correctValue = correctionInputs[feedbackKey];

    if (!result || !correctValue?.trim()) {
      toast({
        title: "Error",
        description: "Please enter the correct rare traits",
        variant: "destructive"
      });
      return;
    }

    if (result.imageEmbedding) {
      console.log(`📝 SUBMITTING RARE TRAIT FEEDBACK: "${result.rareTraits.length > 0 ? result.rareTraits.join(', ') : 'No rare traits'}" → "${correctValue.trim()}"`);
      
      enhancedDetector.addFeedbackCorrection(
        result.imageEmbedding,
        result.rareTraits.length > 0 ? result.rareTraits.join(', ') : 'No rare traits',
        correctValue.trim(),
        'rare-traits',
        result.fileName
      );

      // Log feedback system status
      enhancedDetector.logFeedbackStatus();

      toast({
        title: "Rare Trait Correction Recorded ✅",
        description: `AI will learn rare traits: "${correctValue}" for similar images`
      });

      setCorrectionInputs(prev => ({
        ...prev,
        [feedbackKey]: ''
      }));

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

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'rare': return 'bg-blue-600 text-white';
      case 'epic': return 'bg-purple-600 text-white';
      case 'legendary': return 'bg-yellow-600 text-white';
      default: return 'bg-gray-600 text-white';
    }
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

          {/* Processing Status */}
          {processingImages && (
            <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg border border-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-white font-medium">Processing Images...</span>
                <span className="text-slate-400 text-sm">({Math.round(processingProgress)}%)</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
              <p className="text-sm text-slate-400">
                Creating AI embeddings for {imageFiles.length} images. Please wait before running detection.
              </p>
            </div>
          )}

          {/* Ready Status */}
          {imagesReady && !processingImages && imageUrls.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-900/20 rounded-lg border border-green-600/30">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-400 font-medium">
                {imageUrls.length} images processed and ready for AI detection
              </span>
            </div>
          )}

          {/* Not Ready Status */}
          {imageUrls.length > 0 && !imagesReady && !processingImages && (
            <div className="flex items-center gap-2 p-3 bg-red-900/20 rounded-lg border border-red-600/30">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 font-medium">
                Image processing failed. Please try uploading again.
              </span>
            </div>
          )}

          {/* Run Detection Button */}
          <Button 
            onClick={runDetection} 
            disabled={!imagesReady || loading || processingImages} 
            className={`w-full transition-all duration-300 ${
              buttonClicked 
                ? 'bg-purple-400 hover:bg-purple-500 transform scale-105' 
                : imagesReady 
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-slate-600 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                Running Enhanced Detection...
              </div>
            ) : processingImages ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                Processing Images... Please Wait
              </div>
            ) : !imagesReady && imageUrls.length > 0 ? (
              'Images Not Ready - Upload Failed'
            ) : imagesReady ? (
              `Run Detection on ${imageUrls.length} Images`
            ) : (
              'Upload Images First'
            )}
          </Button>

          {/* Help Text */}
          {!imagesReady && imageUrls.length > 0 && (
            <p className="text-xs text-slate-500 text-center">
              ⏳ Images must be processed before detection can begin
            </p>
          )}
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
                      {/* Regular Traits - Show ALL possible values */}
                      {Object.entries(trainedTraits).map(([category, values]) => {
                        const detectedValue = result.detectedTraits[category];
                        const specificTraitResults = result.specificTraitResults[category];
                        const confidence = result.confidenceScores[category] || 0;
                        
                        return (
                          <div key={category} className="p-3 bg-slate-700/50 rounded-lg">
                            <div className="mb-3">
                              <Label className="text-white font-medium text-sm">{category}:</Label>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant={detectedValue === 'Not Detected' ? "destructive" : "secondary"}
                                  className={detectedValue === 'Not Detected' ? "bg-red-600 text-white" : "bg-blue-600 text-white"}
                                >
                                  Best: {detectedValue}
                                </Badge>
                                {confidence > 0 && (
                                  <span className="text-slate-400 text-xs">
                                    {Math.round(confidence * 100)}% confidence
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Show all tested values */}
                            <div className="space-y-2">
                              <Label className="text-slate-300 text-xs">All tested values:</Label>
                              <div className="space-y-1">
                                {Object.entries(values as any).map(([traitValue, examples]) => {
                                  const traitResult = specificTraitResults?.[traitValue];
                                  const isDetected = traitResult?.detected || false;
                                  const traitConfidence = traitResult?.confidence || 0;
                                  const feedbackKey = `${index}-${category}-${traitValue}`;
                                  const feedbackValue = feedback[feedbackKey];
                                  
                                  return (
                                    <div key={traitValue} className="flex items-center justify-between p-2 bg-slate-800/50 rounded text-sm border border-slate-600">
                                      <div className="flex items-center gap-2">
                                        <Badge 
                                          variant={isDetected ? "default" : "outline"}
                                          className={isDetected ? "bg-green-600 text-white" : "bg-red-600/20 text-red-300 border-red-600"}
                                        >
                                          {traitValue}: {isDetected ? 'Detected' : 'Not Detected'}
                                        </Badge>
                                        {traitConfidence > 0 && (
                                          <span className="text-slate-400 text-xs">
                                            {Math.round(traitConfidence * 100)}%
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleFeedback(index, `${category}-${traitValue}`, true)}
                                          disabled={feedbackValue === true || feedbackValue === 'corrected'}
                                          className="h-6 w-6 p-0 group"
                                          title="Mark as correct"
                                        >
                                          <CheckCircle className={`w-3 h-3 ${
                                            feedbackValue === true ? 'text-green-500' : 
                                            'text-slate-500 group-hover:text-green-400'
                                          }`} />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleFeedback(index, `${category}-${traitValue}`, false)}
                                          disabled={feedbackValue === false || feedbackValue === 'corrected'}
                                          className="h-6 w-6 p-0 group"
                                          title="Mark as wrong"
                                        >
                                          <XCircle className={`w-3 h-3 ${
                                            feedbackValue === false ? 'text-red-500' : 
                                            'text-slate-500 group-hover:text-red-400'
                                          }`} />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            
                            {/* Feedback inputs for any trait that was marked wrong */}
                            {Object.entries(values as any).map(([traitValue, examples]) => {
                              const feedbackKey = `${index}-${category}-${traitValue}`;
                              const feedbackValue = feedback[feedbackKey];
                              
                              if (feedbackValue === false) {
                                return (
                                  <div key={`feedback-${traitValue}`} className="flex gap-2 mt-2">
                                    <Input
                                      type="text"
                                      placeholder={`Correct value for ${category}:${traitValue} (e.g., "should be detected" or "wrong detection")`}
                                      value={correctionInputs[feedbackKey] || ''}
                                      onChange={(e) => handleCorrectionInputChange(index, `${category}-${traitValue}`, e.target.value)}
                                      className="bg-slate-600 border-slate-500 text-white text-sm"
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => handleCorrectionSubmit(index, `${category}-${traitValue}`)}
                                      disabled={!correctionInputs[feedbackKey]?.trim()}
                                      className="bg-blue-600 hover:bg-blue-700"
                                    >
                                      Submit
                                    </Button>
                                  </div>
                                );
                              }
                              
                              if (feedbackValue === 'corrected') {
                                return (
                                  <div key={`corrected-${traitValue}`} className="text-green-400 text-xs mt-1">
                                    ✅ Correction for {traitValue} submitted
                                  </div>
                                );
                              }
                              
                              return null;
                            })}
                          </div>
                        );
                      })}

                      {/* Rare Traits - Note: Functionality removed from test phase, available in collection analysis */}
                      <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <Label className="text-white font-medium text-sm flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              Rare Traits (Collection Analysis Only):
                            </Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="bg-slate-600 text-white">
                                Rare traits will be detected during full collection analysis
                              </Badge>
                            </div>
                            <p className="text-slate-400 text-xs mt-1">
                              Rare trait detection is performed during full collection analysis for accuracy
                            </p>
                          </div>
                        </div>
                      </div>
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
