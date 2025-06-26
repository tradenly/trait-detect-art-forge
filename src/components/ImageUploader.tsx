
import { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from "@/hooks/use-toast";

interface ImageUploaderProps {
  onImagesUploaded: (images: File[]) => void;
  uploadedImages: File[];
}

const ImageUploader = ({ onImagesUploaded, uploadedImages }: ImageUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (files.length > 5000) {
      toast({
        title: "Too many files",
        description: "Maximum 5,000 images supported",
        variant: "destructive"
      });
      return;
    }
    
    processFiles(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  }, []);

  const processFiles = async (files: File[]) => {
    setUploading(true);
    
    try {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      onImagesUploaded([...uploadedImages, ...imageFiles]);
      
      toast({
        title: "Images uploaded successfully",
        description: `${imageFiles.length} images added to collection`
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Error processing images",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    onImagesUploaded(newImages);
  };

  const clearAll = () => {
    onImagesUploaded([]);
    toast({
      title: "All images cleared",
      description: "Ready for new upload"
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-purple-400 bg-purple-400/10' 
            : 'border-slate-600 hover:border-slate-500'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        
        <div className="space-y-4">
          <Upload className="w-12 h-12 mx-auto text-slate-400" />
          <div>
            <p className="text-lg font-medium text-white">
              Drop your NFT images here or click to browse
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Supports PNG, JPG, GIF • Up to 5,000 images • Max 100MB per file
            </p>
          </div>
          <Button variant="outline" className="mt-4">
            <Upload className="w-4 h-4 mr-2" />
            Choose Files
          </Button>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Processing images...</span>
          </div>
          <Progress value={75} className="w-full" />
        </div>
      )}

      {/* Uploaded Images Summary */}
      {uploadedImages.length > 0 && (
        <div className="bg-slate-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">
                {uploadedImages.length} Images Uploaded
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearAll}
              className="text-red-400 border-red-400 hover:bg-red-400/10"
            >
              <X className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
          
          <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto">
            {uploadedImages.slice(0, 32).map((file, index) => (
              <div 
                key={index}
                className="relative group aspect-square bg-slate-600 rounded overflow-hidden"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {uploadedImages.length > 32 && (
              <div className="aspect-square bg-slate-600 rounded flex items-center justify-center">
                <span className="text-xs text-slate-400">
                  +{uploadedImages.length - 32}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
