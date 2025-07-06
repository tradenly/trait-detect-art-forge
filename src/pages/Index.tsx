import { useState, useEffect } from 'react';
import ImageUploader from "@/components/ImageUploader";
import TraitTrainer from "@/components/TraitTrainer";
import TraitClassifier from "@/components/TraitClassifier";
import MetadataGenerator from "@/components/MetadataGenerator";
import ModelTester from "@/components/ModelTester";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TabType = "upload" | "train" | "test" | "detect";

interface TrainingExample {
  embedding: any;
  fileName: string;
  imageUrl: string;
}

interface TrainedTraits {
  [category: string]: {
    [value: string]: TrainingExample[];
  };
}

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [trainedTraits, setTrainedTraits] = useState<TrainedTraits>({});
  const [metadata, setMetadata] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  const handleClearImages = () => {
    setUploadedImages([]);
  };

  const handleClearTrainingData = () => {
    setTrainedTraits({});
  };

  const handleClearMetadata = () => {
    setMetadata([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
            AI Trait Forge
          </h1>
          <p className="text-slate-400 text-lg">
            Advanced AI-powered NFT trait detection and metadata generation
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600">
              Upload Images
            </TabsTrigger>
            <TabsTrigger value="train" className="data-[state=active]:bg-blue-600">
              Train AI
            </TabsTrigger>
            <TabsTrigger value="test" className="data-[state=active]:bg-blue-600">
              Test AI Model
            </TabsTrigger>
            <TabsTrigger value="detect" className="data-[state=active]:bg-blue-600">
              Detect Traits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <ImageUploader 
              onImagesUploaded={setUploadedImages}
              uploadedImages={uploadedImages}
            />
          </TabsContent>

          <TabsContent value="train">
            <TraitTrainer 
              onTraitsUpdated={setTrainedTraits}
              trainedTraits={trainedTraits}
            />
          </TabsContent>

          <TabsContent value="test">
            <ModelTester 
              trainedTraits={trainedTraits}
              uploadedImages={uploadedImages}
            />
          </TabsContent>

          <TabsContent value="detect">
            <div className="space-y-6">
              <TraitClassifier 
                uploadedImages={uploadedImages}
                trainedTraits={trainedTraits}
                onMetadataGenerated={setMetadata}
              />
              
              <MetadataGenerator 
                metadata={metadata}
                uploadedImages={uploadedImages}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
