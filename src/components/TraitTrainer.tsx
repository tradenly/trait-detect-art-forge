import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Upload, Brain, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { loadModel, getImageEmbedding, preprocessImage, batchProcessImages, validateTrainingQuality } from '@/utils/embeddingUtils';
import { enhancedDetector } from '@/utils/enhancedDetection';
import RareTraitDefiner from './RareTraitDefiner';
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
}

interface TraitTrainerProps {
  onTraitsUpdated: (traits: TrainedTraits) => void;
  trainedTraits: TrainedTraits;
  onRareTraitsUpdated?: (rareTraits: RareTrait[]) => void;
  rareTraits?: RareTrait[];
}

const TraitTrainer = ({ onTraitsUpdated, trainedTraits, onRareTraitsUpdated, rareTraits = [] }: TraitTrainerProps) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newTraitValue, setNewTraitValue] = useState('');
  const [training, setTraining] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  const categories = Object.keys(trainedTraits);

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

  const addCategory = () => {
    if (newCategoryName.trim()) {
      const updatedTraits = { ...trainedTraits };
      if (!updatedTraits[newCategoryName]) {
        updatedTraits[newCategoryName] = {};
      }
      onTraitsUpdated(updatedTraits);
      setSelectedCategory(newCategoryName);
      setNewCategoryName('');
      toast({
        title: "Category Added ✅",
        description: `${newCategoryName} trait category created`
      });
    }
  };

  const removeCategory = (categoryName: string) => {
    const updatedTraits = { ...trainedTraits };
    
    if (updatedTraits[categoryName]) {
      Object.values(updatedTraits[categoryName]).forEach(examples => {
        examples.forEach(example => {
          if (example.embedding && typeof example.embedding.dispose === 'function') {
            example.embedding.dispose();
          }
        });
      });
    }
    
    delete updatedTraits[categoryName];
    onTraitsUpdated(updatedTraits);
    
    if (selectedCategory === categoryName) {
      setSelectedCategory(categories.length > 1 ? categories.find(c => c !== categoryName) || '' : '');
    }
    
    toast({
      title: "Category Removed",
      description: `${categoryName} and all its training data deleted`
    });
  };

  const handleTraitImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!modelLoaded) {
      toast({
        title: "Model not ready",
        description: "Please wait for the AI model to load",
        variant: "destructive"
      });
      return;
    }

    if (!selectedCategory || !newTraitValue.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a category and enter a trait value",
        variant: "destructive"
      });
      return;
    }

    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const trimmedValue = newTraitValue.trim();
    const existingExamples = trainedTraits[selectedCategory]?.[trimmedValue]?.length || 0;
    
    if (existingExamples >= 8) {
      toast({
        title: "Consider Other Values",
        description: "8+ examples per trait value provides optimal accuracy. Consider training other values.",
      });
    }

    setTraining(true);

    try {
      const updatedTraits = { ...trainedTraits };
      if (!updatedTraits[selectedCategory]) {
        updatedTraits[selectedCategory] = {};
      }
      if (!updatedTraits[selectedCategory][trimmedValue]) {
        updatedTraits[selectedCategory][trimmedValue] = [];
      }

      const imageElements = await Promise.all(
        files.map(file => loadImageFromFile(file))
      );
      
      const embeddings = await batchProcessImages(imageElements, 3);

      for (let i = 0; i < files.length; i++) {
        updatedTraits[selectedCategory][trimmedValue].push({
          embedding: embeddings[i],
          fileName: files[i].name,
          imageUrl: URL.createObjectURL(files[i])
        });
      }

      // Update adaptive thresholds
      enhancedDetector.updateAdaptiveThresholds(selectedCategory, updatedTraits[selectedCategory][trimmedValue]);

      onTraitsUpdated(updatedTraits);
      setNewTraitValue('');
      
      const validation = validateTrainingQuality(updatedTraits[selectedCategory][trimmedValue]);
      
      toast({
        title: "Training Examples Added ✅",
        description: `${files.length} examples added. ${validation.recommendations.length > 0 ? validation.recommendations[0] : 'Quality looks good!'}`
      });
    } catch (error) {
      console.error('Training error:', error);
      toast({
        title: "Training Failed",
        description: "Error processing training images",
        variant: "destructive"
      });
    } finally {
      setTraining(false);
    }
  };

  const handleAddMoreExamples = async (category: string, value: string, files: File[]) => {
    if (files.length === 0) return;

    setTraining(true);
    try {
      const updatedTraits = { ...trainedTraits };

      const imageElements = await Promise.all(
        files.map(file => loadImageFromFile(file))
      );
      
      const embeddings = await batchProcessImages(imageElements, 3);

      for (let i = 0; i < files.length; i++) {
        updatedTraits[category][value].push({
          embedding: embeddings[i],
          fileName: files[i].name,
          imageUrl: URL.createObjectURL(files[i])
        });
      }

      enhancedDetector.updateAdaptiveThresholds(category, updatedTraits[category][value]);
      onTraitsUpdated(updatedTraits);
      
      toast({
        title: "Examples Added",
        description: `Added ${files.length} new examples to ${category}: ${value}`
      });
    } catch (error) {
      console.error('Failed to add examples:', error);
      toast({
        title: "Failed to add examples",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setTraining(false);
    }
  };

  const handleRemoveExample = (category: string, value: string, index: number) => {
    const updatedTraits = { ...trainedTraits };
    
    const example = updatedTraits[category][value][index];
    if (example.embedding && typeof example.embedding.dispose === 'function') {
      example.embedding.dispose();
    }
    
    updatedTraits[category][value].splice(index, 1);
    
    if (updatedTraits[category][value].length === 0) {
      delete updatedTraits[category][value];
    }
    
    onTraitsUpdated(updatedTraits);
    
    toast({
      title: "Example Removed",
      description: `Removed example from ${category}: ${value}`
    });
  };

  const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const getTotalTrainingExamples = () => {
    let total = 0;
    Object.values(trainedTraits).forEach((category) => {
      Object.values(category).forEach((examples) => {
        total += examples.length;
      });
    });
    return total;
  };

  const getTrainingQualityIndicator = (examples: TrainingExample[]) => {
    const validation = validateTrainingQuality(examples);
    if (validation.isValid && examples.length >= 5) {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    } else if (validation.isValid) {
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    }
    return <X className="w-4 h-4 text-red-400" />;
  };

  const getQualityMessage = (examples: TrainingExample[]) => {
    if (examples.length >= 8) return "Excellent (8+ examples)";
    if (examples.length >= 5) return "Good (5+ examples)";
    if (examples.length >= 3) return "Minimum (3+ examples)";
    return "Insufficient (<3 examples)";
  };

  const handleRareTraitsUpdate = (updatedRareTraits: RareTrait[]) => {
    if (onRareTraitsUpdated) {
      onRareTraitsUpdated(updatedRareTraits);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
        <Brain className={`w-5 h-5 ${modelLoaded ? 'text-green-400' : 'text-yellow-400'}`} />
        <span className="text-white">
          {modelLoaded ? 'Enhanced AI Model Ready (MobileNet v2)' : 'Loading Enhanced AI Model...'}
        </span>
        {getTotalTrainingExamples() > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {getTotalTrainingExamples()} training examples
          </Badge>
        )}
      </div>

      <Card className="bg-blue-900/20 border-blue-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">AI Training Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="text-slate-300 space-y-2">
          <p><strong>Quality over Quantity:</strong> 5-8 high-quality examples per trait work better than many poor ones</p>
          <p><strong>Diverse Examples:</strong> Include different angles, lighting, and backgrounds</p>
          <p><strong>Clear Images:</strong> Use high-resolution, well-lit images for best results</p>
          <p><strong>Avoid Conflicts:</strong> Don't train overlapping traits (e.g., "shorts" and "pants" for same image)</p>
        </CardContent>
      </Card>

      {/* Add New Category - MOVED TO FIRST POSITION */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white text-lg">1. Create Trait Categories</CardTitle>
          <CardDescription className="text-slate-400">
            Define the types of traits you want to detect (e.g., Hat, Clothing, Background)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter category name (e.g., Clothing, Accessories, Background)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 bg-slate-800 border-slate-600 text-white"
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
            />
            <Button onClick={addCategory} disabled={!newCategoryName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
          
          {categories.length > 0 && (
            <div className="space-y-2">
              <Label className="text-white">Your Categories:</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? "default" : "secondary"}
                    className="cursor-pointer flex items-center gap-1 px-3 py-1"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                    <X 
                      className="w-3 h-3 ml-1 hover:bg-red-500 rounded-full" 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCategory(category);
                      }}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Train Selected Category */}
      {selectedCategory && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white">2. Train Category: {selectedCategory}</CardTitle>
            <CardDescription className="text-slate-400">
              Upload 5-8 diverse, high-quality examples for optimal AI accuracy. Click on existing values to add more examples or remove them.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={`Enter ${selectedCategory.toLowerCase()} value (e.g., Green, Black, Blue)`}
                value={newTraitValue}
                onChange={(e) => setNewTraitValue(e.target.value)}
                className="flex-1 bg-slate-800 border-slate-600 text-white"
              />
              <div className="relative">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleTraitImageUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={!newTraitValue.trim() || !modelLoaded || training}
                />
                <Button disabled={!newTraitValue.trim() || !modelLoaded || training}>
                  <Upload className="w-4 h-4 mr-2" />
                  {training ? 'Training...' : 'Upload Examples'}
                </Button>
              </div>
            </div>

            {/* Display current trait values with editing capabilities */}
            {trainedTraits[selectedCategory] && Object.keys(trainedTraits[selectedCategory]).length > 0 && (
              <div className="space-y-3">
                <Label className="text-white">Current Trait Values for {selectedCategory} (click to edit):</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(trainedTraits[selectedCategory]).map(([value, examples]) => (
                    <div key={value} className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-white">{selectedCategory}: {value}</span>
                        <div className="flex items-center gap-2">
                          {getTrainingQualityIndicator(examples)}
                          <Badge variant="outline" className="text-xs">
                            {examples.length} examples
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        {getQualityMessage(examples)}
                      </div>
                      
                      {/* Add more examples button */}
                      <div className="relative mb-2">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                              handleAddMoreExamples(selectedCategory, value, files);
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={training}
                        />
                        <Button size="sm" disabled={training} className="w-full text-xs">
                          <Plus className="w-3 h-3 mr-1" />
                          {training ? 'Adding...' : 'Add More Examples'}
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-1">
                        {examples.slice(0, 8).map((example, index) => (
                          <div key={index} className="aspect-square relative group">
                            <img
                              src={example.imageUrl}
                              alt={`${value} example`}
                              className="w-full h-full object-cover rounded"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto w-auto"
                              onClick={() => handleRemoveExample(selectedCategory, value, index)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        {examples.length > 8 && (
                          <div className="aspect-square bg-slate-700 rounded flex items-center justify-center">
                            <span className="text-slate-400 text-xs">+{examples.length - 8}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rare Trait Definer - MOVED TO AFTER REGULAR TRAITS */}
      <RareTraitDefiner 
        onRareTraitsUpdate={handleRareTraitsUpdate}
        initialRareTraits={rareTraits}
        trainedTraits={trainedTraits}
      />

      {/* Training Summary */}
      {categories.length > 0 && (
        <Card className="bg-green-900/20 border-green-700">
          <CardHeader>
            <CardTitle className="text-white">Training Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categories.map((category) => {
                const categoryData = trainedTraits[category] || {};
                const valueCount = Object.keys(categoryData).length;
                const exampleCount = Object.values(categoryData).reduce(
                  (sum, examples) => sum + examples.length, 0
                );
                
                return (
                  <div key={category} className="flex justify-between text-white">
                    <span>{category}:</span>
                    <span>{valueCount} values, {exampleCount} examples</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TraitTrainer;
