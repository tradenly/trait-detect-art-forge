
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Table, Settings } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { saveAs } from 'file-saver';

interface MetadataGeneratorProps {
  metadata: any[];
}

const MetadataGenerator = ({ metadata }: MetadataGeneratorProps) => {
  const [collectionName, setCollectionName] = useState("AI Trait Collection");
  const [collectionDescription, setCollectionDescription] = useState("Generated with AI Trait Forge - Automatically detected traits using advanced AI image analysis");
  const [ipfsBaseUrl, setIpfsBaseUrl] = useState("ipfs://YOUR-HASH-HERE");

  const hasData = metadata.length > 0;

  const generateFinalMetadata = () => {
    return metadata.map((item, index) => ({
      ...item,
      name: `${collectionName} #${String(index + 1).padStart(4, '0')}`,
      description: collectionDescription,
      image: `${ipfsBaseUrl}/${item.fileName}`,
      collectionName,
      collectionDescription,
      // Recalculate rarities for final export
      attributes: item.attributes.map((attr: any) => ({
        ...attr,
        rarity: calculateFinalRarity(attr.trait_type, attr.value)
      }))
    }));
  };

  const calculateFinalRarity = (traitType: string, value: string): string => {
    const count = metadata.filter(item => 
      item.attributes.some((attr: any) => attr.trait_type === traitType && attr.value === value)
    ).length;
    
    const percentage = ((count / metadata.length) * 100).toFixed(1);
    return `${percentage}%`;
  };

  const downloadJSON = () => {
    const finalMetadata = generateFinalMetadata();
    const blob = new Blob([JSON.stringify(finalMetadata, null, 2)], { 
      type: 'application/json' 
    });
    saveAs(blob, `${collectionName.replace(/\s+/g, '_')}_metadata.json`);
    
    toast({
      title: "JSON downloaded",
      description: "Metadata exported successfully"
    });
  };

  const downloadCSV = () => {
    const finalMetadata = generateFinalMetadata();
    const csvHeader = [
      'Name',
      'Description', 
      'Image',
      'FileName',
      ...Array.from(new Set(finalMetadata.flatMap(item => 
        item.attributes.map((attr: any) => attr.trait_type)
      )))
    ].join(',');

    const csvRows = finalMetadata.map(item => {
      const baseData = [
        `"${item.name}"`,
        `"${item.description}"`,
        `"${item.image}"`,
        `"${item.fileName}"`
      ];

      // Add trait values in consistent order
      const traitTypes = Array.from(new Set(finalMetadata.flatMap(item => 
        item.attributes.map((attr: any) => attr.trait_type)
      )));

      const traitValues = traitTypes.map(traitType => {
        const attr = item.attributes.find((a: any) => a.trait_type === traitType);
        return attr ? `"${attr.value}"` : '""';
      });

      return [...baseData, ...traitValues].join(',');
    });

    const csvContent = [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    saveAs(blob, `${collectionName.replace(/\s+/g, '_')}_metadata.csv`);
    
    toast({
      title: "CSV downloaded",
      description: "Spreadsheet exported successfully"
    });
  };

  const downloadIndividualJSON = () => {
    const finalMetadata = generateFinalMetadata();
    finalMetadata.forEach((item, index) => {
      const blob = new Blob([JSON.stringify(item, null, 2)], { 
        type: 'application/json' 
      });
      saveAs(blob, `${String(index + 1).padStart(4, '0')}.json`);
    });
    
    toast({
      title: "Individual JSONs downloaded",
      description: `${finalMetadata.length} metadata files exported`
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

      {/* Export Options */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Download className="w-5 h-5 text-purple-400" />
            Export Metadata
          </CardTitle>
          <CardDescription className="text-slate-400">
            Download your generated metadata in various formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xl font-bold text-purple-400">{metadata.length}</div>
              <div className="text-xs text-slate-400">Total NFTs</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xl font-bold text-purple-400">
                {new Set(metadata.flatMap(item => item.attributes.map((attr: any) => attr.trait_type))).size}
              </div>
              <div className="text-xs text-slate-400">Trait Types</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xl font-bold text-purple-400">
                {new Set(metadata.flatMap(item => item.attributes.map((attr: any) => attr.value))).size}
              </div>
              <div className="text-xs text-slate-400">Unique Values</div>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <div className="text-xl font-bold text-purple-400">100%</div>
              <div className="text-xs text-slate-400">Complete</div>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button onClick={downloadJSON} className="h-16 flex flex-col gap-1">
              <FileText className="w-5 h-5" />
              <span className="text-sm">Download JSON</span>
              <span className="text-xs opacity-70">Single metadata file</span>
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
          <div className="text-xs text-slate-400 space-y-1">
            <p><strong>JSON:</strong> Single file with all metadata - compatible with most marketplaces</p>
            <p><strong>CSV:</strong> Spreadsheet format for easy viewing and editing</p>
            <p><strong>Individual JSONs:</strong> Separate metadata file for each NFT (some platforms prefer this)</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white">Metadata Preview</CardTitle>
          <CardDescription className="text-slate-400">
            Sample of your generated metadata
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-800 rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-slate-300 whitespace-pre-wrap">
              {JSON.stringify(generateFinalMetadata()[0], null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetadataGenerator;
