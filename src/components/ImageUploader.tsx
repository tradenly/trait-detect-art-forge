
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Image as ImageIcon, Trash2, FolderOpen } from 'lucide-react';
import { toast } from "@/hooks/use-toast";

interface ImageUploaderProps {
  onImagesUploaded: (images: File[]) => void;
  uploadedImages: File[];
}

const ImageUploader = ({ onImagesUploaded, uploadedImages }: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: "No images selected",
        description: "Please select image files only",
        variant: "destructive"
      });
      return;
    }

    if (imageFiles.length > 1000) {
      toast({
        title: "Too many images",
        description: "Please upload up to 1000 images at a time",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate processing progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const allImages = [...uploadedImages, ...imageFiles];
      onImagesUploaded(allImages);
      
      toast({
        title: "Images uploaded successfully! 📸",
        description: `${imageFiles.length} images added to your collection`
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Error processing images",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    onImagesUploaded(newImages);
    
    toast({
      title: "Image removed",
      description: "Image deleted from collection"
    });
  };

  const clearAllImages = () => {
    onImagesUploaded([]);
    toast({
      title: "Collection cleared",
      description: "All images removed"
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bg-slate-700/30 border-slate-600">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-400" />
            Upload Your NFT Collection
          </CardTitle>
          <CardDescription className="text-slate-400">
            Upload all your NFT images for trait detection and metadata generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={uploading}
            />
            <div className="border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-lg p-8 text-center transition-colors">
              <FolderOpen className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {uploading ? 'Processing Images...' : 'Select Your NFT Collection'}
              </h3>
              <p className="text-slate-400 mb-4">
                Drag and drop or click to upload PNG, JPG, or GIF files
              </p>
              <Button disabled={uploading} size="lg">
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Choose Files'}
              </Button>
            </div>
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Processing images...</span>
                <span className="text-slate-400">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collection Summary */}
      {uploadedImages.length > 0 && (
        <Card className="bg-slate-700/30 border-slate-600">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-400" />
                Your Collection
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {uploadedImages.length} images
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-400">
              Preview of your uploaded NFT collection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Collection Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">{uploadedImages.length}</div>
                <div className="text-sm text-slate-400">Total Images</div>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">
                  {Math.round(uploadedImages.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024)}MB
                </div>
                <div className="text-sm text-slate-400">Total Size</div>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">
                  {new Set(uploadedImages.map(file => file.type)).size}
                </div>
                <div className="text-sm text-slate-400">File Types</div>
              </div>
              <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-green-400">Ready</div>
                <div className="text-sm text-slate-400">Status</div>
              </div>
            </div>

            {/* Image Grid Preview */}
            <div className="grid grid-cols-8 md:grid-cols-12 gap-2 max-h-64 overflow-y-auto">
              {uploadedImages.slice(0, 48).map((file, index) => (
                <div key={index} className="relative group aspect-square">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`NFT ${index + 1}`}
                    className="w-full h-full object-cover rounded border border-slate-600"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {uploadedImages.length > 48 && (
                <div className="aspect-square bg-slate-800 rounded border border-slate-600 flex items-center justify-center">
                  <span className="text-slate-400 text-xs">+{uploadedImages.length - 48}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearAllImages}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
              <div className="relative flex-1">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Button variant="outline" className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Add More Images
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImageUploader;
