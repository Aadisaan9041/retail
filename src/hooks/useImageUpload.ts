import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadResult {
  url: string;
  path: string;
}

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const uploadImage = useCallback(async (
    file: File,
    bucket: string = 'product-images'
  ): Promise<UploadResult | null> => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a JPG, PNG, WebP, or GIF image.',
          variant: 'destructive',
        });
        return null;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload an image smaller than 5MB.',
          variant: 'destructive',
        });
        return null;
      }

      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      setUploadProgress(30);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        toast({
          title: 'Upload failed',
          description: error.message,
          variant: 'destructive',
        });
        return null;
      }

      setUploadProgress(80);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      setUploadProgress(100);

      toast({
        title: 'Image uploaded',
        description: 'Your image has been uploaded successfully.',
      });

      return {
        url: publicUrl,
        path: data.path,
      };
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'There was an error uploading your image.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [toast]);

  const deleteImage = useCallback(async (
    path: string,
    bucket: string = 'product-images'
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        console.error('Delete error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }, []);

  return {
    uploadImage,
    deleteImage,
    isUploading,
    uploadProgress,
  };
}
