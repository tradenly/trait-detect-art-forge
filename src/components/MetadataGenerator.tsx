
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Table, Settings, Eye, CheckCircle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { saveAs } from 'file-saver';

interface MetadataGeneratorProps {
  metadata: any[];
  uploadedImages: File[];
}

const MetadataGenerator = ({ metadata, uploadedImages }: MetadataGeneratorProps) => {
  const [collectionName, setCollectionName] = useState("AI Trait Collection");
  const [collectionDescription, setCollectionDescription] = useState("Generated with AI Trait Forge - Automatically detected traits using advanced AI image analysis");
  const [ipfsBaseUrl, setIpfsBaseUrl] = useState("ipfs://YOUR-HASH-HERE");
  const [previewIndex, setPreviewIndex] = useState(0);

  const hasData = metadata.length > 0;

  // Clean metadata function - remove ALL debug info and duplicates
  const getCleanMetadata = () => {
    return metadata.map((item, index) => {
      // Get only detected attributes without duplicates
      const cleanAttributes = [];
      const seenTraits = new Set();
      
      // First, try to get from the main attributes array if it exists and has clean data
      if (item.attributes && Array.isArray(item.attributes)) {
        item.attributes.forEach((attr: any) => {
          if (attr.value && attr.value !== 'Not Detected' && attr.trait_type) {
            const traitKey = `${attr.trait_type}-${attr.value}`;
            if (!seenTraits.has(traitKey)) {
              seenTraits.add(traitKey);
              cleanAttributes.push({
                trait_type: attr.trait_type,
                value: attr.value,
                rarity: attr.rarity || calculateRarity(attr.trait_type, attr.value)
              });
            }
          }
        });
      }
      
      // If no attributes found, check allTraitAnalysis
      if (cleanAttributes.length === 0 && item.allTraitAnalysis && Array.isArray(item.allTraitAnalysis)) {
        item.allTraitAnalysis.forEach((attr: any) => {
          if (attr.value && attr.value !== 'Not Detected' && attr.trait_type && attr.isDetected) {
            const traitKey = `${attr.trait_type}-${attr.value}`;
            if (!seenTraits.has(traitKey)) {
              seenTraits.add(traitKey);
              cleanAttributes.push({
                trait_type: attr.trait_type,
                value: attr.value,
                rarity: attr.rarity || calculateRarity(attr.trait_type, attr.value)
              });
            }
          }
        });
      }
      
      // If still no attributes, check detectedTraits object
      if (cleanAttributes.length === 0 && item.detectedTraits) {
        Object.entries(item.detectedTraits).forEach(([traitType, value]: [string, any]) => {
          if (value && value !== 'Not Detected') {
            const traitKey = `${traitType}-${value}`;
            if (!seenTraits.has(traitKey)) {
              seenTraits.add(traitKey);
              cleanAttributes.push({
                trait_type: traitType,
                value: value,
                rarity: calculateRarity(traitType, value)
              });
            }
          }
        });
      }

      return {
        name: `${collectionName} #${String(index + 1).padStart(4, '0')}`,
        description: collectionDescription,
        image: `${ipfsBaseUrl}/${item.fileName}`,
        attributes: cleanAttributes
      };
    });
  };

  const calculateRarity = (traitType: string, value: string) => {
    // Calculate rarity based on how many items have this trait value
    const totalItems = metadata.length;
    let count = 0;
    
    metadata.forEach(item => {
      // Check in various places where the trait might be stored
      const hasThisTrait = 
        (item.attributes && item.attributes.some((attr: any) => attr.trait_type === traitType && attr.value === value)) ||
        (item.allTraitAnalysis && item.allTraitAnalysis.some((attr: any) => attr.trait_type === traitType && attr.value === value && attr.isDetected)) ||
        (item.detectedTraits && item.detectedTraits[traitType] === value);
      
      if (hasThisTrait) count++;
    });
    
    const percentage = totalItems > 0 ? (count / totalItems) * 100 : 0;
    return `${percentage.toFixed(1)}%`;
  };

  const downloadJSON = () => {
    const cleanMetadata = getCleanMetadata();
    const blob = new Blob([JSON.stringify(cleanMetadata, null, 2)], { 
      type: 'application/json' 
    });
    saveAs(blob, `${collectionName.replace(/\s+/g, '_')}_metadata.json`);
    
    toast({
      title: "JSON downloaded ✅",
      description: "Clean metadata exported successfully"
    });
  };

  const downloadCSV = () => {
    const cleanMetadata = getCleanMetadata();
    
    // Create CSV with one row per NFT, columns for each trait
    const traitTypes = Array.from(new Set(cleanMetadata.flatMap(item => 
      item.attributes.map((attr: any) => attr.trait_type)
    )));

    const csvHeader = [
      'Name',
      'Description', 
      'Image',
      ...traitTypes,
      ...traitTypes.map(trait => `${trait}_Rarity`)
    ].join(',');

    const csvRows = cleanMetadata.map(item => {
      const baseData = [
        `"${item.name}"`,
        `"${item.description}"`,
        `"${item.image}"`
      ];

      // Add trait values
      const traitValues = traitTypes.map(traitType => {
        const attr = item.attributes.find((a: any) => a.trait_type === traitType);
        return attr ? `"${attr.value}"` : '""';
      });

      // Add rarity values
      const rarityValues = traitTypes.map(traitType => {
        const attr = item.attributes.find((a: any) => a.trait_type === traitType);
        return attr ? `"${attr.rarity}"` : '""';
      });

      return [...baseData, ...traitValues, ...rarityValues].join(',');
    });

    const csvContent = [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    saveAs(blob, `${collectionName.replace(/\s+/g, '_')}_metadata.csv`);
    
    toast({
      title: "CSV downloaded ✅",
      description: "Spreadsheet exported successfully"
    });
  };

  const downloadIndividualJSON = () => {
    const cleanMetadata = getCleanMetadata();
    cleanMetadata.forEach((item, index) => {
      const blob = new Blob([JSON.stringify(item, null, 2)], { 
        type: 'application/json' 
      });
      saveAs(blob, `${String(index + 1).padStart(4, '0')}.json`);
    });
    
    toast({
      title: "Individual JSONs downloaded ✅",
      description: `${cleanMetadata.length} clean metadata files exported`
    });
  };

  if (!hasData) {
    return (
      <Card className="bg-slate-700/30 border-slate-600">
        <CardContent className="py-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Metadata Available</h3>
          <p className="text-slate-400">
            Please complete trait detection first to generate metadata for export.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get clean metadata for preview
  const cleanMetadata = getCleanMetadata();

  return (
    <div className="space-y-6">
      {/* Collection Settings */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            Collection Settings
          </CardTitle>
          <CardDescription className="text-slate-400">
            Configure your collection metadata before export
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name" className="text-white">Collection Name</Label>
              <Input
                id="collection-name"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ipfs-url" className="text-white">IPFS Base URL</Label>
              <Input
                id="ipfs-url"
                value={ipfsBaseUrl}
                onChange={(e) => setIpfsBaseUrl(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="ipfs://QmYourHashHere"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-description" className="text-white">Collection Description</Label>
            <Textarea
              id="collection-description"
              value={collectionDescription}
              onChange={(e) => setCollectionDescription(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Metadata Preview with Images */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-400" />
            Clean Metadata Preview
          </CardTitle>
          <CardDescription className="text-slate-400">
            Review your clean, marketplace-ready metadata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Navigation */}
          <div className="flex justify-between items-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
              disabled={previewIndex === 0}
            >
              Previous
            </Button>
            <span className="text-white">
              {previewIndex + 1} of {cleanMetadata.length} NFTs
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPreviewIndex(Math.min(cleanMetadata.length - 1, previewIndex + 1))}
              disabled={previewIndex === cleanMetadata.length - 1}
            >
              Next
            </Button>
          </div>

          {/* Current Item Preview */}
          {cleanMetadata[previewIndex] && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="aspect-square bg-slate-800 rounded-lg overflow-hidden">
                  <img
                    src={metadata[previewIndex].imageUrl}
                    alt={cleanMetadata[previewIndex].name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center">
                  <h4 className="font-medium text-white">{cleanMetadata[previewIndex].name}</h4>
                  <p className="text-sm text-slate-400">{metadata[previewIndex].fileName}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <h5 className="text-white font-medium mb-2">Detected Traits ({cleanMetadata[previewIndex].attributes.length})</h5>
                  {cleanMetadata[previewIndex].attributes.length > 0 ? (
                    <div className="space-y-2">
                      {cleanMetadata[previewIndex].attributes.map((attr: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                          <span className="text-slate-300 text-sm">{attr.trait_type}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{attr.value}</Badge>
                            <span className="text-xs text-slate-400">{attr.rarity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">No traits detected for this image</p>
                  )}
                </div>

                <div className="bg-slate-800 rounded-lg p-4">
                  <h5 className="text-white font-medium mb-2">Clean JSON Preview</h5>
                  <div className="bg-slate-900 rounded p-3 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                      {JSON.stringify(cleanMetadata[previewIndex], null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-purple-400" />
            Export Clean Metadata
          </CardTitle>
          <CardDescription className="text-slate-400">
            Download your clean, marketplace-ready metadata in various formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <div className="text-xl font-bold text-green-400">{cleanMetadata.length}</div>
              </div>
              <div className="text-xs text-slate-400">Total NFTs</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xl font-bold text-purple-400">
                {new Set(cleanMetadata.flatMap(item => 
                  item.attributes.map((attr: any) => attr.trait_type)
                )).size}
              </div>
              <div className="text-xs text-slate-400">Trait Types</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xl font-bold text-purple-400">
                {new Set(cleanMetadata.flatMap(item => 
                  item.attributes.map((attr: any) => attr.value)
                )).size}
              </div>
              <div className="text-xs text-slate-400">Unique Values</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xl font-bold text-purple-400">100%</div>
              <div className="text-xs text-slate-400">Clean</div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button onClick={downloadJSON} className="h-16 flex flex-col gap-1">
              <FileText className="w-5 h-5" />
              <span className="text-sm">Download JSON</span>
              <span className="text-xs opacity-70">Marketplace ready</span>
            </Button>
            
            <Button onClick={downloadCSV} variant="outline" className="h-16 flex flex-col gap-1">
              <Table className="w-5 h-5" />
              <span className="text-sm">Download CSV</span>
              <span className="text-xs opacity-70">Spreadsheet format</span>
            </Button>
            
            <Button onClick={downloadIndividualJSON} variant="outline" className="h-16 flex flex-col gap-1">
              <Download className="w-5 h-5" />
              <span className="text-sm">Individual JSONs</span>
              <span className="text-xs opacity-70">One file per NFT</span>
            </Button>
          </div>

          {/* Format Information */}
          <div className="bg-slate-800/30 rounded-lg p-4">
            <h5 className="text-white font-medium mb-2">Clean Export Formats</h5>
            <div className="text-xs text-slate-400 space-y-1">
              <p><strong>JSON:</strong> Clean metadata with only name, description, image, and attributes - no debug info</p>
              <p><strong>CSV:</strong> Spreadsheet format with trait columns and rarity percentages for analysis</p>
              <p><strong>Individual JSONs:</strong> Separate clean metadata file for each NFT (required by some platforms)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetadataGenerator;
