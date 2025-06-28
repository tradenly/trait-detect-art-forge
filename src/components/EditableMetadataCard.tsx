
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Save, X, Plus, Trash2 } from 'lucide-react';
import { toast } from "@/hooks/use-toast";

interface EditableMetadataCardProps {
  metadata: any;
  onMetadataUpdate: (updatedMetadata: any) => void;
}

const EditableMetadataCard = ({ metadata, onMetadataUpdate }: EditableMetadataCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState(metadata);
  const [newAttribute, setNewAttribute] = useState({ trait_type: '', value: '', rarity: '0%' });

  const handleEdit = () => {
    setEditedMetadata(JSON.parse(JSON.stringify(metadata))); // Deep copy
    setIsEditing(true);
  };

  const handleSave = () => {
    onMetadataUpdate(editedMetadata);
    setIsEditing(false);
    toast({
      title: "Metadata Updated ✅",
      description: `Updated metadata for ${editedMetadata.name}`
    });
  };

  const handleCancel = () => {
    setEditedMetadata(metadata);
    setIsEditing(false);
  };

  const updateAttribute = (index: number, field: string, value: string) => {
    const updated = { ...editedMetadata };
    updated.attributes[index][field] = value;
    setEditedMetadata(updated);
  };

  const removeAttribute = (index: number) => {
    const updated = { ...editedMetadata };
    updated.attributes.splice(index, 1);
    setEditedMetadata(updated);
  };

  const addAttribute = () => {
    if (newAttribute.trait_type.trim() && newAttribute.value.trim()) {
      const updated = { ...editedMetadata };
      updated.attributes.push({
        ...newAttribute,
        confidence: 1.0 // Manual entries get full confidence
      });
      setEditedMetadata(updated);
      setNewAttribute({ trait_type: '', value: '', rarity: '0%' });
    }
  };

  const currentData = isEditing ? editedMetadata : metadata;

  return (
    <Card className="bg-slate-700/30 border-slate-600">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-white text-lg">{currentData.name}</CardTitle>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button size="sm" variant="outline" onClick={handleEdit}>
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Name</label>
            {isEditing ? (
              <Input
                value={editedMetadata.name}
                onChange={(e) => setEditedMetadata({...editedMetadata, name: e.target.value})}
                className="bg-slate-800 border-slate-600 text-white"
              />
            ) : (
              <div className="text-white">{currentData.name}</div>
            )}
          </div>
          
          <div>
            <label className="text-sm text-slate-400 block mb-1">Description</label>
            {isEditing ? (
              <Textarea
                value={editedMetadata.description}
                onChange={(e) => setEditedMetadata({...editedMetadata, description: e.target.value})}
                className="bg-slate-800 border-slate-600 text-white"
                rows={2}
              />
            ) : (
              <div className="text-white text-sm">{currentData.description}</div>
            )}
          </div>
        </div>

        {/* Attributes */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm text-slate-400">Traits</label>
            {isEditing && (
              <Badge variant="secondary" className="text-xs">
                {currentData.attributes.length} traits
              </Badge>
            )}
          </div>
          
          <div className="space-y-2">
            {currentData.attributes.map((attr: any, index: number) => (
              <div key={index} className="bg-slate-800/50 rounded p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Type</label>
                    {isEditing ? (
                      <Input
                        value={attr.trait_type}
                        onChange={(e) => updateAttribute(index, 'trait_type', e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white text-sm"
                      />
                    ) : (
                      <div className="text-white text-sm font-medium">{attr.trait_type}</div>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Value</label>
                    {isEditing ? (
                      <Input
                        value={attr.value}
                        onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                        className="bg-slate-700 border-slate-600 text-white text-sm"
                      />
                    ) : (
                      <Badge variant="secondary" className="bg-green-900 text-green-300">
                        {attr.value}
                      </Badge>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      {isEditing ? 'Actions' : 'Rarity'}
                    </label>
                    {isEditing ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeAttribute(index)}
                        className="h-8"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    ) : (
                      <div className="text-slate-300 text-sm">{attr.rarity}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Add new attribute */}
            {isEditing && (
              <div className="bg-slate-800/30 border-2 border-dashed border-slate-600 rounded p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <Input
                    placeholder="Trait type (e.g., Clothing)"
                    value={newAttribute.trait_type}
                    onChange={(e) => setNewAttribute({...newAttribute, trait_type: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white text-sm"
                  />
                  <Input
                    placeholder="Value (e.g., Red Pants)"
                    value={newAttribute.value}
                    onChange={(e) => setNewAttribute({...newAttribute, value: e.target.value})}
                    className="bg-slate-700 border-slate-600 text-white text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={addAttribute}
                    disabled={!newAttribute.trait_type.trim() || !newAttribute.value.trim()}
                    className="h-8"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* JSON Preview */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400">JSON Preview</label>
          <div className="bg-slate-900 rounded p-3 text-xs font-mono text-slate-300 max-h-40 overflow-y-auto">
            <pre>{JSON.stringify(currentData, null, 2)}</pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EditableMetadataCard;
