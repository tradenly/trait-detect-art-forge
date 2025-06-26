
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Save, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [preferredMarketplace, setPreferredMarketplace] = useState('tradeport');
  const [ipfsApiKey, setIpfsApiKey] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const { toast } = useToast();

  const handleSaveSettings = () => {
    // Save settings to localStorage
    const settings = {
      darkMode,
      preferredMarketplace,
      ipfsApiKey,
      collectionName,
      collectionDescription,
      autoSaveEnabled
    };
    
    localStorage.setItem('nft-forge-settings', JSON.stringify(settings));
    
    toast({
      title: "Settings Saved",
      description: "Your preferences have been saved successfully.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="outline" size="sm" className="bg-slate-800/50 border-slate-600 text-white hover:bg-slate-700/50">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to App
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-purple-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* General Settings */}
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">General Settings</CardTitle>
              <CardDescription className="text-slate-400">
                Configure your app preferences and appearance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Dark Mode</Label>
                  <p className="text-sm text-slate-400">Toggle dark/light theme</p>
                </div>
                <Switch
                  checked={darkMode}
                  onCheckedChange={setDarkMode}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Auto-save Progress</Label>
                  <p className="text-sm text-slate-400">Automatically save your work</p>
                </div>
                <Switch
                  checked={autoSaveEnabled}
                  onCheckedChange={setAutoSaveEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Collection Settings */}
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Collection Settings</CardTitle>
              <CardDescription className="text-slate-400">
                Set default values for your NFT collection metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="collection-name" className="text-white">Default Collection Name</Label>
                <Input
                  id="collection-name"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="e.g., My NFT Collection"
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="collection-description" className="text-white">Default Collection Description</Label>
                <Input
                  id="collection-description"
                  value={collectionDescription}
                  onChange={(e) => setCollectionDescription(e.target.value)}
                  placeholder="e.g., A unique collection of AI-generated NFTs"
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="marketplace" className="text-white">Preferred Marketplace</Label>
                <select
                  id="marketplace"
                  value={preferredMarketplace}
                  onChange={(e) => setPreferredMarketplace(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white"
                >
                  <option value="tradeport">Tradeport</option>
                  <option value="opensea">OpenSea</option>
                  <option value="magic-eden">Magic Eden</option>
                  <option value="rarible">Rarible</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* IPFS Settings */}
          <Card className="bg-slate-800/50 backdrop-blur border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">IPFS Settings</CardTitle>
              <CardDescription className="text-slate-400">
                Configure IPFS upload settings for your NFT images and metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ipfs-key" className="text-white">IPFS API Key</Label>
                <Input
                  id="ipfs-key"
                  type="password"
                  value={ipfsApiKey}
                  onChange={(e) => setIpfsApiKey(e.target.value)}
                  placeholder="Enter your IPFS service API key"
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
                <p className="text-xs text-slate-500">
                  Used for uploading images to IPFS. Supports Pinata, Web3.Storage, and others.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} className="bg-purple-600 hover:bg-purple-700">
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
