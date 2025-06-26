
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Upload, Brain, Trash2 } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { loadModel, getImageEmbedding, preprocessImage } from '@/utils/embeddingUtils';
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

interface TraitTrainerProps {
  onTraitsUpdated: (traits: TrainedTraits) => void;
  trainedTraits: TrainedTraits;
}

const TraitTrainer = ({ onTraitsUpdated, trainedTraits }: TraitTrainerProps) => {
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
        title: "AI Model Loaded ✅",
        description: "Ready to train trait detection"
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
    if (newCategoryName && !categories.includes(newCategoryName)) {
      const updatedTraits = { ...trainedTraits };
      updatedTraits[newCategoryName] = {};
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
    
    // Clean up tensors before deleting
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

    if (!selectedCategory || !newTraitValue) {
      toast({
        title: "Missing Information",
        description: "Please select a category and enter a trait value",
        variant: "destructive"
      });
      return;
    }

    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setTraining(true);

    try {
      const updatedTraits = { ...trainedTraits };
      if (!updatedTraits[selectedCategory][newTraitValue]) {
        updatedTraits[selectedCategory][newTraitValue] = [];
      }

      for (const file of files) {
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);
        
        updatedTraits[selectedCategory][newTraitValue].push({
          embedding: embedding,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file)
        });
      }

      onTraitsUpdated(updatedTraits);
      setNewTraitValue('');
      
      toast({
        title: "Training Examples Added ✅",
        description: `${files.length} examples added for ${selectedCategory} → ${newTraitValue}`
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

  const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const removeTraitValue = (category: string, value: string) => {
    const updatedTraits = { ...trainedTraits };
    
    // Clean up tensors
    if (updatedTraits[category][value]) {
      updatedTraits[category][value].forEach(example => {
        if (example.embedding && typeof example.embedding.dispose === 'function') {
          example.embedding.dispose();
        }
      });
    }
    
    delete updatedTraits[category][value];
    onTraitsUpdated(updatedTraits);
    
    toast({
      title: "Trait Value Removed",
      description: `${category} → ${value} deleted`
    });
  };

  const removeTraitExample = (category: string, value: string, index: number) => {
    const updatedTraits = { ...trainedTraits };
    
    // Clean up tensor
    const example = updatedTraits[category][value][index];
    if (example.embedding && typeof example.embedding.dispose === 'function') {
      example.embedding.dispose();
    }
    
    updatedTraits[category][value].splice(index, 1);
    
    if (updatedTraits[category][value].length === 0) {
      delete updatedTraits[category][value];
    }
    
    onTraitsUpdated(updatedTraits);
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

  return (
    <div className="space-y-6">
      {/* Model Status */}
      <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
        <Brain className={`w-5 h-5 ${modelLoaded ? 'text-green-400' : 'text-yellow-400'}`} />
        <span className="text-white">
          {modelLoaded ? 'AI Model Ready' : 'Loading AI Model...'}
        </span>
        {getTotalTrainingExamples() > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {getTotalTrainingExamples()} training examples
          </Badge>
        )}
      </div>

      {/* Instructions */}
      <Card className="bg-blue-900/20 border-blue-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">How to Train Your AI</CardTitle>
        </CardHeader>
        <CardContent className="text-slate-300 space-y-2">
          <p><strong>Step 1:</strong> Add trait categories (e.g., "Clothing", "Background", "Accessories")</p>
          <p><strong>Step 2:</strong> For each category, define values (e.g., "Red Shirt", "Blue Shirt", "No Shirt")</p>
          <p><strong>Step 3:</strong> Upload 3-5 example images for each trait value to teach the AI</p>
          <p><strong>Step 4:</strong> Test your model before processing your full collection</p>
        </CardContent>
      </Card>

      {/* Add New Category */}
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
            <Button onClick={addCategory} disabled={!newCategoryName}>
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
              Upload 3-5 example images for each trait value in this category
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={`Enter ${selectedCategory.toLowerCase()} value (e.g., Red, Blue, None)`}
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
                  disabled={!newTraitValue || !modelLoaded || training}
                />
                <Button disabled={!newTraitValue || !modelLoaded || training}>
                  <Upload className="w-4 h-4 mr-2" />
                  {training ? 'Training...' : 'Upload Examples'}
                </Button>
              </div>
            </div>

            {/* Show current trait values for selected category */}
            {trainedTraits[selectedCategory] && Object.keys(trainedTraits[selectedCategory]).length > 0 && (
              <div className="space-y-3">
                <Label className="text-white">Current Trait Values:</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(trainedTraits[selectedCategory]).map(([value, examples]) => (
                    <div key={value} className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-white">{value}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {examples.length} examples
                          </Badge>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeTraitValue(selectedCategory, value)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {examples.slice(0, 4).map((example, index) => (
                          <div key={index} className="relative group aspect-square">
                            <img
                              src={example.imageUrl}
                              alt={`${value} example`}
                              className="w-full h-full object-cover rounded"
                            />
                            <button
                              onClick={() => removeTraitExample(selectedCategory, value, index)}
                              className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-2 h-2" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
