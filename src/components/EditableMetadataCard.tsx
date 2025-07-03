import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit, Save, X, Plus, Trash2, Sparkles } from 'lucide-react';
import { toast } from "@/hooks/use-toast";

interface EditableMetadataCardProps {
  metadata: any;
  onMetadataUpdate: (updatedMetadata: any) => void;
}

const EditableMetadataCard = ({ metadata, onMetadataUpdate }: EditableMetadataCardProps) => {
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingJson, setEditingJson] = useState(false);
  const [tempName, setTempName] = useState(metadata.name);
  const [tempDescription, setTempDescription] = useState(metadata.description);
  const [tempJsonString, setTempJsonString] = useState('');
  const [newTraitType, setNewTraitType] = useState('');
  const [newTraitValue, setNewTraitValue] = useState('');
  const [isRareTrait, setIsRareTrait] = useState(false);

  const handleNameSave = () => {
    onMetadataUpdate({
      ...metadata,
      name: tempName
    });
    setEditingName(false);
    toast({
      title: "Name Updated",
      description: "NFT name has been updated"
    });
  };

  const handleDescriptionSave = () => {
    onMetadataUpdate({
      ...metadata,
      description: tempDescription
    });
    setEditingDescription(false);
    toast({
      title: "Description Updated",
      description: "NFT description has been updated"
    });
  };

  const handleJsonEdit = () => {
    setTempJsonString(JSON.stringify(metadata, null, 2));
    setEditingJson(true);
  };

  const validateAndSaveJson = () => {
    try {
      const parsedJson = JSON.parse(tempJsonString);
      
      // Basic validation to ensure essential fields exist
      if (!parsedJson.name || !parsedJson.description || !parsedJson.attributes) {
        toast({
          title: "Invalid JSON",
          description: "JSON must contain 'name', 'description', and 'attributes' fields",
          variant: "destructive"
        });
        return;
      }

      // Validate attributes array
      if (!Array.isArray(parsedJson.attributes)) {
        toast({
          title: "Invalid JSON",
          description: "'attributes' must be an array",
          variant: "destructive"
        });
        return;
      }

      // Validate each attribute has required fields
      for (const attr of parsedJson.attributes) {
        if (!attr.trait_type || !attr.value) {
          toast({
            title: "Invalid JSON",
            description: "Each attribute must have 'trait_type' and 'value' fields",
            variant: "destructive"
          });
          return;
        }
      }

      onMetadataUpdate(parsedJson);
      setEditingJson(false);
      toast({
        title: "JSON Updated",
        description: "Metadata has been updated successfully"
      });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your JSON syntax and try again",
        variant: "destructive"
      });
    }
  };

  const handleAddAttribute = () => {
    if (!newTraitType.trim() || !newTraitValue.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both trait type and value",
        variant: "destructive"
      });
      return;
    }

    const newAttribute = {
      trait_type: newTraitType.trim(),
      value: newTraitValue.trim(),
      rarity: isRareTrait ? "rare" : "0%"
    };

    const updatedMetadata = {
      ...metadata,
      attributes: [
        ...metadata.attributes,
        newAttribute
      ]
    };

    onMetadataUpdate(updatedMetadata);
    setNewTraitType('');
    setNewTraitValue('');
    setIsRareTrait(false);
    
    toast({
      title: isRareTrait ? "Rare Attribute Added" : "Attribute Added",
      description: `Added ${newTraitType}: ${newTraitValue}${isRareTrait ? ' (Rare)' : ''}`
    });
  };

  const handleRemoveAttribute = (index: number) => {
    const updatedAttributes = metadata.attributes.filter((_: any, i: number) => i !== index);
    onMetadataUpdate({
      ...metadata,
      attributes: updatedAttributes
    });
    
    toast({
      title: "Attribute Removed",
      description: "Attribute has been removed"
    });
  };

  return (
    <Card className="bg-slate-700/30 border-slate-600">
      <CardHeader>
        <CardTitle className="text-white">Metadata Preview & Editor</CardTitle>
        <CardDescription className="text-slate-400">
          Edit NFT metadata and attributes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name Section */}
        <div className="space-y-2">
          <Label className="text-white">Name</Label>
          {editingName ? (
            <div className="flex gap-2">
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
              <Button size="sm" onClick={handleNameSave}>
                <Save className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-slate-300">{metadata.name}</span>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(true)}>
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Description Section */}
        <div className="space-y-2">
          <Label className="text-white">Description</Label>
          {editingDescription ? (
            <div className="space-y-2">
              <Textarea
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleDescriptionSave}>
                  <Save className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingDescription(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <span className="text-slate-300 flex-1">{metadata.description}</span>
              <Button size="sm" variant="ghost" onClick={() => setEditingDescription(true)}>
                <Edit className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Attributes Section */}
        <div className="space-y-2">
          <Label className="text-white">Attributes</Label>
          <div className="space-y-2">
            {metadata.attributes.map((attr: any, index: number) => (
              <div key={index} className="flex items-center justify-between bg-slate-800/50 rounded p-2">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="secondary" 
                    className={`${attr.rarity === 'rare' ? 'bg-gradient-to-r from-purple-600 to-yellow-600' : 'bg-blue-600'} text-white`}
                  >
                    {attr.trait_type}: {attr.value}
                  </Badge>
                  {attr.rarity === 'rare' && (
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">{attr.rarity}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveAttribute(index)}
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add New Attribute with Rare Trait Checkbox */}
        <div className="space-y-2">
          <Label className="text-white">Add New Attribute</Label>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Trait type (e.g., Background)"
                value={newTraitType}
                onChange={(e) => setNewTraitType(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
              <Input
                placeholder="Value (e.g., Blue)"
                value={newTraitValue}
                onChange={(e) => setNewTraitValue(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
              <Button onClick={handleAddAttribute} disabled={!newTraitType.trim() || !newTraitValue.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rare-trait"
                checked={isRareTrait}
                onCheckedChange={(checked) => setIsRareTrait(checked as boolean)}
                className="border-slate-500 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-600 data-[state=checked]:to-yellow-600"
              />
              <Label htmlFor="rare-trait" className="text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                Mark as Rare Trait
              </Label>
            </div>
          </div>
        </div>

        {/* JSON Preview Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-white">JSON Preview</Label>
            {!editingJson && (
              <Button size="sm" variant="outline" onClick={handleJsonEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit JSON
              </Button>
            )}
          </div>
          
          {editingJson ? (
            <div className="space-y-2">
              <Textarea
                value={tempJsonString}
                onChange={(e) => setTempJsonString(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white font-mono text-sm"
                rows={15}
                placeholder="Edit JSON metadata..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={validateAndSaveJson}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingJson(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <pre className="bg-slate-800 rounded p-4 text-slate-300 text-sm overflow-auto max-h-64">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EditableMetadataCard;
