
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Plus, X, AlertTriangle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";

interface RareTrait {
  category: string;
  value: string;
  rarity: 'rare' | 'epic' | 'legendary';
  description?: string;
}

interface RareTraitDefinerProps {
  onRareTraitsUpdate: (rareTraits: RareTrait[]) => void;
  initialRareTraits?: RareTrait[];
}

const RareTraitDefiner = ({ onRareTraitsUpdate, initialRareTraits = [] }: RareTraitDefinerProps) => {
  const [rareTraits, setRareTraits] = useState<RareTrait[]>(initialRareTraits);
  const [newTrait, setNewTrait] = useState<Partial<RareTrait>>({
    category: '',
    value: '',
    rarity: 'rare'
  });

  const handleAddRareTrait = () => {
    if (!newTrait.category || !newTrait.value) {
      toast({
        title: "Missing information",
        description: "Please enter both category and value for the rare trait",
        variant: "destructive"
      });
      return;
    }

    const rareTrait: RareTrait = {
      category: newTrait.category,
      value: newTrait.value,
      rarity: newTrait.rarity || 'rare',
      description: newTrait.description
    };

    const updatedTraits = [...rareTraits, rareTrait];
    setRareTraits(updatedTraits);
    onRareTraitsUpdate(updatedTraits);
    
    setNewTrait({
      category: '',
      value: '',
      rarity: 'rare'
    });

    toast({
      title: "Rare trait added!",
      description: `${rareTrait.category}: ${rareTrait.value} (${rareTrait.rarity})`
    });
  };

  const handleRemoveRareTrait = (index: number) => {
    const updatedTraits = rareTraits.filter((_, i) => i !== index);
    setRareTraits(updatedTraits);
    onRareTraitsUpdate(updatedTraits);
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'rare': return 'bg-blue-900 text-blue-300 border-blue-600';
      case 'epic': return 'bg-purple-900 text-purple-300 border-purple-600';
      case 'legendary': return 'bg-yellow-900 text-yellow-300 border-yellow-600';
      default: return 'bg-gray-900 text-gray-300 border-gray-600';
    }
  };

  return (
    <Card className="bg-slate-700/30 border-slate-600">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          Define Rare Traits
        </CardTitle>
        <CardDescription className="text-slate-400">
          Mark special traits as rare, epic, or legendary for proper rarity calculation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Box */}
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-200">
              <strong>Rarity Impact:</strong> Defining rare traits helps ensure accurate rarity percentages in your NFT metadata. 
              Rare traits should have lower occurrence rates than common traits.
            </div>
          </div>
        </div>

        {/* Add New Rare Trait */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
          <div className="space-y-2">
            <Label className="text-white">Category</Label>
            <Input
              placeholder="e.g., hat, eyes, background"
              value={newTrait.category || ''}
              onChange={(e) => setNewTrait(prev => ({ ...prev, category: e.target.value }))}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-white">Value</Label>
            <Input
              placeholder="e.g., golden crown, laser eyes"
              value={newTrait.value || ''}
              onChange={(e) => setNewTrait(prev => ({ ...prev, value: e.target.value }))}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-white">Rarity Level</Label>
            <select
              value={newTrait.rarity || 'rare'}
              onChange={(e) => setNewTrait(prev => ({ ...prev, rarity: e.target.value as 'rare' | 'epic' | 'legendary' }))}
              className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md text-white"
            >
              <option value="rare">Rare (5-15%)</option>
              <option value="epic">Epic (1-5%)</option>
              <option value="legendary">Legendary (&lt;1%)</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-white">Description (Optional)</Label>
            <Input
              placeholder="Brief description of this rare trait"
              value={newTrait.description || ''}
              onChange={(e) => setNewTrait(prev => ({ ...prev, description: e.target.value }))}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          
          <div className="md:col-span-2">
            <Button onClick={handleAddRareTrait} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Rare Trait
            </Button>
          </div>
        </div>

        {/* Current Rare Traits */}
        {rareTraits.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-white font-medium">Defined Rare Traits ({rareTraits.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rareTraits.map((trait, index) => (
                <div key={index} className={`p-3 rounded-lg border ${getRarityColor(trait.rarity)}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">{trait.category}: {trait.value}</div>
                      <Badge variant="outline" className={`text-xs mt-1 ${getRarityColor(trait.rarity)}`}>
                        {trait.rarity.toUpperCase()}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveRareTrait(index)}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                  {trait.description && (
                    <p className="text-xs opacity-80 mt-1">{trait.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {rareTraits.length === 0 && (
          <div className="text-center py-6 text-slate-400">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No rare traits defined yet</p>
            <p className="text-xs">Add rare traits to ensure accurate rarity calculations</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RareTraitDefiner;
