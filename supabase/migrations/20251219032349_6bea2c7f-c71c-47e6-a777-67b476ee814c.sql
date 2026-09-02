-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Allow anyone to view product images (public bucket)
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow staff to upload product images
CREATE POLICY "Staff can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' AND
  public.is_staff(auth.uid())
);

-- Allow staff to update product images
CREATE POLICY "Staff can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' AND
  public.is_staff(auth.uid())
);

-- Allow staff to delete product images
CREATE POLICY "Staff can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' AND
  public.is_staff(auth.uid())
);