import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ImageUploader from '@/components/ImageUploader';
import TraitTrainer from '@/components/TraitTrainer';
import TraitClassifier from '@/components/TraitClassifier';
import MetadataGenerator from '@/components/MetadataGenerator';
import { Brain, Upload, Sparkles, Download, Settings } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedImages, setUploadedImages] = useState([]);
  const [trainedTraits, setTrainedTraits] = useState({});
  const [detectedMetadata, setDetectedMetadata] = useState([]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Brain className="w-12 h-12 text-purple-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              AI Trait Forge
            </h1>
          </div>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-6">
            Automatically detect and generate NFT metadata using advanced AI image analysis. 
            Train custom trait models and export marketplace-ready metadata files.
          </p>
          
          {/* Settings Link */}
          <div className="flex justify-center">
            <a 
              href="/settings" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur border border-slate-600 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </a>
          </div>
        </div>

        {/* Main Interface */}
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8 bg-slate-800/50 backdrop-blur">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Images
              </TabsTrigger>
              <TabsTrigger value="train" className="flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Train Traits
              </TabsTrigger>
              <TabsTrigger value="classify" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Detect Traits
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export Data
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-6">
              <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-400" />
                    Upload NFT Collection
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Upload your NFT images (up to 5,000 supported). These will be analyzed for traits.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ImageUploader 
                    onImagesUploaded={setUploadedImages}
                    uploadedImages={uploadedImages}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="train" className="space-y-6">
              <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    Train Trait Detection
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Upload 5+ example images for each trait value to train the AI model.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TraitTrainer 
                    onTraitsUpdated={setTrainedTraits}
                    trainedTraits={trainedTraits}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="classify" className="space-y-6">
              <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    AI Trait Detection
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Analyze your uploaded images using the trained trait models.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TraitClassifier 
                    uploadedImages={uploadedImages}
                    trainedTraits={trainedTraits}
                    onMetadataGenerated={setDetectedMetadata}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export" className="space-y-6">
              <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-purple-400" />
                    Export Metadata
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Download your generated metadata in JSON and CSV formats for marketplace upload.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MetadataGenerator 
                    metadata={detectedMetadata}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
