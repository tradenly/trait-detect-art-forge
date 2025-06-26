
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Upload, Brain } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { loadModel, getImageEmbedding } from '@/utils/embeddingUtils';

interface TraitTrainerProps {
  onTraitsUpdated: (traits: any) => void;
  trainedTraits: any;
}

const TraitTrainer = ({ onTraitsUpdated, trainedTraits }: TraitTrainerProps) => {
  const [traitCategories, setTraitCategories] = useState([
    'Background', 'Clothing', 'Accessories', 'Eyes', 'Mouth'
  ]);
  const [newCategory, setNewCategory] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Background');
  const [newTraitValue, setNewTraitValue] = useState('');
  const [training, setTraining] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    loadModel().then(() => {
      setModelLoaded(true);
      toast({
        title: "AI Model Loaded",
        description: "Ready to train trait detection"
      });
    }).catch(() => {
      toast({
        title: "Model Loading Failed",
        description: "Please refresh and try again",
        variant: "destructive"
      });
    });
  }, []);

  const addCategory = () => {
    if (newCategory && !traitCategories.includes(newCategory)) {
      setTraitCategories([...traitCategories, newCategory]);
      setNewCategory('');
      toast({
        title: "Category added",
        description: `${newCategory} trait category created`
      });
    }
  };

  const removeCategory = (category: string) => {
    setTraitCategories(traitCategories.filter(c => c !== category));
    const updatedTraits = { ...trainedTraits };
    delete updatedTraits[category];
    onTraitsUpdated(updatedTraits);
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

    const files = Array.from(event.target.files || []);
    if (files.length === 0 || !newTraitValue) return;

    setTraining(true);

    try {
      const updatedTraits = { ...trainedTraits };
      if (!updatedTraits[selectedCategory]) {
        updatedTraits[selectedCategory] = {};
      }
      if (!updatedTraits[selectedCategory][newTraitValue]) {
        updatedTraits[selectedCategory][newTraitValue] = [];
      }

      for (const file of files) {
        const img = await loadImageFromFile(file);
        const embedding = await getImageEmbedding(img);
        
        updatedTraits[selectedCategory][newTraitValue].push({
          embedding: embedding,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file)
        });
      }

      onTraitsUpdated(updatedTraits);
      setNewTraitValue('');
      
      toast({
        title: "Training data added",
        description: `${files.length} examples added for ${newTraitValue}`
      });
    } catch (error) {
      toast({
        title: "Training failed",
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

  const removeTraitExample = (category: string, value: string, index: number) => {
    const updatedTraits = { ...trainedTraits };
    updatedTraits[category][value].splice(index, 1);
    
    if (updatedTraits[category][value].length === 0) {
      delete updatedTraits[category][value];
    }
    
    onTraitsUpdated(updatedTraits);
  };

  const getTotalTrainingExamples = () => {
    let total = 0;
    Object.values(trainedTraits).forEach((category: any) => {
      Object.values(category).forEach((examples: any) => {
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

      {/* Add New Category */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white text-lg">Trait Categories</CardTitle>
          <CardDescription className="text-slate-400">
            Define the types of traits you want to detect in your NFTs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter new category (e.g., Hat, Weapon, Pet)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 bg-slate-800 border-slate-600 text-white"
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
            />
            <Button onClick={addCategory} disabled={!newCategory}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {traitCategories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "secondary"}
                className="cursor-pointer flex items-center gap-1"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
                {traitCategories.length > 1 && (
                  <X 
                    className="w-3 h-3 ml-1 hover:bg-red-500 rounded-full" 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCategory(category);
                    }}
                  />
                )}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Train Selected Category */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">Train: {selectedCategory}</CardTitle>
          <CardDescription className="text-slate-400">
            Upload 5+ example images for each trait value in this category
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={`Enter ${selectedCategory.toLowerCase()} value (e.g., Red, Blue, Rare)`}
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
        </CardContent>
      </Card>

      {/* Training Data Overview */}
      {Object.keys(trainedTraits).length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white">Training Data</CardTitle>
            <CardDescription className="text-slate-400">
              Your uploaded trait examples
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(trainedTraits).map(([category, values]: [string, any]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium text-white">{category}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(values).map(([value, examples]: [string, any]) => (
                      <div key={value} className="bg-slate-800/50 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-white">{value}</span>
                          <Badge variant="outline" className="text-xs">
                            {examples.length} examples
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {examples.slice(0, 4).map((example: any, index: number) => (
                            <div key={index} className="relative group aspect-square">
                              <img
                                src={example.imageUrl}
                                alt={`${value} example`}
                                className="w-full h-full object-cover rounded"
                              />
                              <button
                                onClick={() => removeTraitExample(category, value, index)}
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
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TraitTrainer;
