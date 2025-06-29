
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit2, Plus, Trash2, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
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

interface TrainingManagerProps {
  trainedTraits: TrainedTraits;
  onTraitsUpdated: (traits: TrainedTraits) => void;
}

const TrainingManager = ({ trainedTraits, onTraitsUpdated }: TrainingManagerProps) => {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [newValueName, setNewValueName] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleAddExamples = async (category: string, value: string, files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const updatedTraits = { ...trainedTraits };

      for (const file of files) {
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);

        updatedTraits[category][value].push({
          embedding,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file)
        });
      }

      // Update adaptive thresholds
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
      setUploading(false);
    }
  };

  const handleAddNewValue = async (category: string, files: File[]) => {
    if (!newValueName.trim() || files.length === 0) return;

    setUploading(true);
    try {
      const updatedTraits = { ...trainedTraits };
      
      if (!updatedTraits[category][newValueName]) {
        updatedTraits[category][newValueName] = [];
      }

      for (const file of files) {
        const img = await loadImageFromFile(file);
        const processedImg = await preprocessImage(img);
        const embedding = await getImageEmbedding(processedImg);

        updatedTraits[category][newValueName].push({
          embedding,
          fileName: file.name,
          imageUrl: URL.createObjectURL(file)
        });
      }

      // Update adaptive thresholds
      enhancedDetector.updateAdaptiveThresholds(category, updatedTraits[category][newValueName]);

      onTraitsUpdated(updatedTraits);
      setNewValueName('');
      setEditingCategory(null);
      
      toast({
        title: "New Value Added",
        description: `Added ${newValueName} to ${category} with ${files.length} examples`
      });
    } catch (error) {
      console.error('Failed to add new value:', error);
      toast({
        title: "Failed to add new value",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveExample = (category: string, value: string, index: number) => {
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

  const getQualityIndicator = (examples: TrainingExample[]) => {
    if (examples.length >= 8) return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (examples.length >= 5) return <CheckCircle className="w-4 h-4 text-blue-400" />;
    if (examples.length >= 3) return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    return <AlertTriangle className="w-4 h-4 text-red-400" />;
  };

  const getQualityMessage = (examples: TrainingExample[]) => {
    if (examples.length >= 8) return "Excellent";
    if (examples.length >= 5) return "Good";
    if (examples.length >= 3) return "Adequate";
    return "Needs More";
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">Training Management</CardTitle>
          <CardDescription className="text-slate-400">
            Edit, add, or remove training examples to improve detection accuracy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(trainedTraits).map(([category, values]) => (
            <div key={category} className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-white">{category}</h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => setEditingCategory(category)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Value
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-800 border-slate-600">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add New Value to {category}</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Add a new trait value with training examples
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-white">Value Name</Label>
                        <Input
                          value={newValueName}
                          onChange={(e) => setNewValueName(e.target.value)}
                          placeholder="e.g., Blue, Red, Green"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-white">Training Examples</Label>
                        <div className="relative">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length > 0 && newValueName.trim()) {
                                handleAddNewValue(category, files);
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={!newValueName.trim() || uploading}
                          />
                          <Button disabled={!newValueName.trim() || uploading} className="w-full">
                            <Upload className="w-4 h-4 mr-2" />
                            {uploading ? 'Uploading...' : 'Upload Examples'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(values).map(([value, examples]) => (
                  <div key={value} className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{value}</span>
                        {getQualityIndicator(examples)}
                        <Badge variant="outline" className="text-xs">
                          {examples.length} examples
                        </Badge>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-800 border-slate-600 max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-white">Edit {category}: {value}</DialogTitle>
                            <DialogDescription className="text-slate-400">
                              Manage training examples - {getQualityMessage(examples)} ({examples.length} examples)
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="relative">
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  if (files.length > 0) {
                                    handleAddExamples(category, value, files);
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={uploading}
                              />
                              <Button disabled={uploading} className="w-full">
                                <Plus className="w-4 h-4 mr-2" />
                                {uploading ? 'Adding...' : 'Add More Examples'}
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                              {examples.map((example, index) => (
                                <div key={index} className="relative group">
                                  <img
                                    src={example.imageUrl}
                                    alt={`${value} example`}
                                    className="w-full aspect-square object-cover rounded"
                                  />
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
                                    onClick={() => handleRemoveExample(category, value, index)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 rounded-b">
                                    {example.fileName}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    <div className="text-xs text-slate-400 mb-2">
                      Status: {getQualityMessage(examples)}
                    </div>
                    
                    <div className="grid grid-cols-4 gap-1">
                      {examples.slice(0, 4).map((example, index) => (
                        <div key={index} className="aspect-square">
                          <img
                            src={example.imageUrl}
                            alt={`${value} example`}
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                      ))}
                      {examples.length > 4 && (
                        <div className="aspect-square bg-slate-700 rounded flex items-center justify-center">
                          <span className="text-slate-400 text-xs">+{examples.length - 4}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrainingManager;
