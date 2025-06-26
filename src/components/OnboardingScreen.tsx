
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Upload, TestTube, Sparkles, Download, Zap, Target, BarChart3 } from 'lucide-react';

interface OnboardingScreenProps {
  onGetStarted: () => void;
}

const OnboardingScreen = ({ onGetStarted }: OnboardingScreenProps) => {
  return (
    <div className="space-y-8">
      {/* Welcome Card */}
      <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-white mb-4">
            Welcome to AI Trait Forge! 🎨
          </CardTitle>
          <CardDescription className="text-lg text-slate-300">
            Automatically detect and generate NFT metadata using cutting-edge AI technology.
            No coding required, everything runs in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-700/30 rounded-lg">
              <Brain className="w-8 h-8 mx-auto text-purple-400 mb-2" />
              <h4 className="font-medium text-white mb-1">AI-Powered</h4>
              <p className="text-sm text-slate-400">Uses TensorFlow.js and MobileNet for accurate trait detection</p>
            </div>
            <div className="text-center p-4 bg-slate-700/30 rounded-lg">
              <Zap className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
              <h4 className="font-medium text-white mb-1">Client-Side</h4>
              <p className="text-sm text-slate-400">Everything runs in your browser, no data leaves your device</p>
            </div>
            <div className="text-center p-4 bg-slate-700/30 rounded-lg">
              <Target className="w-8 h-8 mx-auto text-green-400 mb-2" />
              <h4 className="font-medium text-white mb-1">Marketplace Ready</h4>
              <p className="text-sm text-slate-400">Exports metadata compatible with OpenSea, Tradeport, and more</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Process Steps */}
      <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-xl">How It Works</CardTitle>
          <CardDescription className="text-slate-400">
            Follow these simple steps to generate your NFT metadata:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Define Your Traits</h4>
                <p className="text-slate-400 text-sm">
                  Create trait categories like "Background", "Clothing", "Accessories". 
                  Define the possible values for each (e.g., Red, Blue, None).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Upload Training Examples</h4>
                <p className="text-slate-400 text-sm">
                  For each trait value, upload 3-5 sample images. This teaches the AI what to look for.
                  Example: Upload 5 images with red jackets labeled as "Jacket → Red".
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Test Your Model</h4>
                <p className="text-slate-400 text-sm">
                  Upload a few test images to verify the AI is detecting traits correctly before processing your full collection.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">
                4
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Upload Your Collection</h4>
                <p className="text-slate-400 text-sm">
                  Upload your complete NFT collection (up to 5,000 images). The AI will analyze each image automatically.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">
                5
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Detect Traits & Calculate Rarity</h4>
                <p className="text-slate-400 text-sm">
                  The AI detects traits in your entire collection and calculates rarity percentages for each trait combination.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full text-sm font-bold">
                6
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Export Metadata</h4>
                <p className="text-slate-400 text-sm">
                  Download your metadata as JSON (marketplace-ready) and CSV (spreadsheet) formats with thumbnails for verification.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Get Started */}
      <div className="text-center">
        <Button 
          onClick={onGetStarted}
          size="lg"
          className="px-8 py-3 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          Begin Training Your AI Model
          <Brain className="w-5 h-5 ml-2" />
        </Button>
        <p className="text-slate-400 text-sm mt-4">
          Ready to start? Click above to define your first trait category!
        </p>
      </div>
    </div>
  );
};

export default OnboardingScreen;
