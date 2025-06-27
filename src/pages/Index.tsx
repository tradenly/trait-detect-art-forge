
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import OnboardingScreen from '@/components/OnboardingScreen';
import TraitTrainer from '@/components/TraitTrainer';
import ModelTester from '@/components/ModelTester';
import ImageUploader from '@/components/ImageUploader';
import TraitClassifier from '@/components/TraitClassifier';
import MetadataGenerator from '@/components/MetadataGenerator';
import { Brain, Upload, TestTube, Sparkles, Download, ArrowRight } from 'lucide-react';

const Index = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [trainedTraits, setTrainedTraits] = useState({});
  const [uploadedImages, setUploadedImages] = useState([]);
  const [detectedMetadata, setDetectedMetadata] = useState([]);

  const steps = [
    { id: 'onboarding', title: 'Get Started', icon: Brain },
    { id: 'train', title: 'Train AI Model', icon: Brain },
    { id: 'test', title: 'Test Model', icon: TestTube },
    { id: 'upload', title: 'Upload Collection', icon: Upload },
    { id: 'classify', title: 'Detect Traits', icon: Sparkles },
    { id: 'export', title: 'Export Metadata', icon: Download }
  ];

  const canProceedToTest = Object.keys(trainedTraits).length > 0 && 
    Object.values(trainedTraits).some((category: any) => Object.keys(category).length > 0);

  const canProceedToUpload = canProceedToTest; // Can proceed to upload if we have trained traits
  const canProceedToClassify = uploadedImages.length > 0 && canProceedToUpload;
  const canProceedToExport = detectedMetadata.length > 0;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

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
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Train AI models to automatically detect NFT traits and generate marketplace-ready metadata
          </p>
        </div>

        {/* Progress Steps */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              const isAccessible = index <= currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <button 
                    onClick={() => isAccessible && setCurrentStep(index)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-purple-600 text-white' 
                        : isCompleted 
                          ? 'bg-green-600 text-white hover:bg-green-700' 
                          : isAccessible
                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                    disabled={!isAccessible}
                  >
                    <StepIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">{step.title}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-slate-600 mx-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-6xl mx-auto">
          {currentStep === 0 && (
            <OnboardingScreen onGetStarted={nextStep} />
          )}

          {currentStep === 1 && (
            <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Train AI Models
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Define trait categories and upload sample images to train the AI
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TraitTrainer 
                  onTraitsUpdated={setTrainedTraits}
                  trainedTraits={trainedTraits}
                />
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <Button 
                    onClick={nextStep}
                    disabled={!canProceedToTest}
                    className="w-full"
                    size="lg"
                  >
                    {canProceedToTest ? 'Continue to Testing' : 'Upload Training Examples First'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TestTube className="w-5 h-5 text-purple-400" />
                  Test Your Model
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Upload test images to verify your AI model is working correctly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ModelTester 
                  trainedTraits={trainedTraits}
                />
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <Button 
                    onClick={nextStep}
                    disabled={!canProceedToUpload}
                    className="w-full"
                    size="lg"
                  >
                    {canProceedToUpload ? 'Continue to Collection Upload' : 'Test Your Model First'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-400" />
                  Upload Your Collection
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Upload your complete NFT collection for trait detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUploader 
                  onImagesUploaded={setUploadedImages}
                  uploadedImages={uploadedImages}
                />
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <Button 
                    onClick={nextStep}
                    disabled={!canProceedToClassify}
                    className="w-full"
                    size="lg"
                  >
                    {canProceedToClassify ? 'Continue to Trait Detection' : 'Upload Your Collection First'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  AI Trait Detection
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Analyze your collection using the trained AI models
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TraitClassifier 
                  uploadedImages={uploadedImages}
                  trainedTraits={trainedTraits}
                  onMetadataGenerated={setDetectedMetadata}
                />
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <Button 
                    onClick={nextStep}
                    disabled={!canProceedToExport}
                    className="w-full"
                    size="lg"
                  >
                    {canProceedToExport ? 'Continue to Export' : 'Run Trait Detection First'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 5 && (
            <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-purple-400" />
                  Export Metadata
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Download your generated metadata in JSON and CSV formats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MetadataGenerator 
                  metadata={detectedMetadata}
                  uploadedImages={uploadedImages}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
