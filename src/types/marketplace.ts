 // Marketplace-compatible product fields for Meesho, Amazon, Flipkart
 
 export interface MarketplaceProductData {
   // Basic Info
   name: string;
   sku: string;
   barcode?: string | null;
   style_id?: string | null;
   group_id?: string | null;
   ean_upc?: string | null;
   
   // Pricing
   price: number;
   cost: number;
   mrp: number;
   
   // Inventory
   quantity: number;
   low_stock_threshold: number;
   reorder_quantity?: number | null;
   auto_reorder?: boolean;
   
   // Category & Description
   category_id?: string | null;
   description?: string | null;
   generic_name?: string | null;
   brand?: string | null;
   
   // Attributes
   color?: string | null;
   fabric?: string | null;
   pattern?: string | null;
   fit_shape?: string | null;
   occasion?: string | null;
   sleeve_length?: string | null;
   neck_type?: string | null;
   hemline?: string | null;
   length_type?: string | null;
   sleeve_styling?: string | null;
   print_pattern_type?: string | null;
   character_theme?: string | null;
   number_of_pockets?: number | null;
   
   // Measurements
   net_weight_grams?: number | null;
   net_quantity?: number | null;
   chest_size?: string | null;
   length_size?: string | null;
   shoulder_size?: string | null;
   
   // Manufacturer Details
   country_of_origin?: string | null;
   manufacturer_name?: string | null;
   manufacturer_address?: string | null;
   manufacturer_pincode?: string | null;
   packer_name?: string | null;
   packer_address?: string | null;
   packer_pincode?: string | null;
   importer_name?: string | null;
   importer_address?: string | null;
   importer_pincode?: string | null;
   
   // Images
   image_url?: string | null;
   image_url_2?: string | null;
   image_url_3?: string | null;
   image_url_4?: string | null;
 }
 
 export interface ProductVariant {
   id: string;
   product_id: string;
   variation: string;
   color?: string | null;
   sku: string;
   barcode?: string | null;
   price: number;
   mrp: number;
   cost: number;
   quantity: number;
   meesho_price?: number | null;
   wrong_defective_price?: number | null;
   image_url?: string | null;
   chest_size?: string | null;
   length_size?: string | null;
   shoulder_size?: string | null;
   created_at: string;
   updated_at: string;
 }
 
 // Dropdown options for marketplace fields
 export const MARKETPLACE_OPTIONS = {
   colors: [
     'Aqua Blue', 'Assorted', 'Beige', 'Black', 'Blue', 'Brown', 'Coffee Brown',
     'Coral', 'Cream', 'Gold', 'Green', 'Grey', 'Maroon', 'Multicolor', 'Mustard',
     'Navy Blue', 'Olive', 'Orange', 'Peach', 'Pink', 'Purple', 'Red', 'Silver',
     'Teal', 'White', 'Yellow'
   ],
   fabrics: [
     'Cotton', 'Cotton Blend', 'Polyester', 'Linen', 'Silk', 'Rayon', 'Denim',
     'Lycra', 'Viscose Rayon', 'Georgette', 'Chiffon', 'Velvet', 'Wool', 'Nylon',
     'Acrylic', 'Modal', 'Satin', 'Crepe', 'Net', 'Organza'
   ],
   patterns: [
     'Solid', 'Printed', 'Striped', 'Checked', 'Embroidered', 'Woven Design',
     'Self-Design', 'Colorblocked', 'Graphic Print', 'Floral', 'Abstract',
     'Geometric', 'Polka Dots', 'Camouflage', 'Animal', 'Paisley'
   ],
   fitShapes: [
     'Regular', 'Slim', 'Relaxed', 'Loose', 'Tailored', 'Oversize', 'Compression', 'Boxy'
   ],
   occasions: [
     'Casual', 'Formal', 'Party', 'Festive', 'Beach', 'Sports', 'Lounge', 'Work'
   ],
   sleeveLengths: [
     'Short Sleeves', 'Long Sleeves', 'Sleeveless', 'Three-Quarter Sleeves', 
     'Half Sleeves', 'Cap Sleeves', 'Roll-Up'
   ],
   neckTypes: [
     'Round', 'V-neck', 'Polo', 'Henley', 'Hood', 'Mandarin', 'Crew',
     'Scoop', 'Square', 'High Neck', 'Cowl', 'Contrast Collar'
   ],
   variations: [
     'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL',
     'Free Size', '28', '30', '32', '34', '36', '38', '40', '42', '44', '46'
   ],
   countries: [
     'India', 'China', 'Bangladesh', 'Vietnam', 'Turkey', 'Pakistan', 'Indonesia',
     'Thailand', 'Sri Lanka', 'Nepal'
   ],
   hemlines: [
     'Straight', 'Curved', 'High-Low', 'Asymmetric', 'Vented'
   ],
   lengthTypes: [
     'Regular', 'Crop', 'Longline'
   ],
   sleeveStyles: [
     'Regular', 'Raglan', 'Cuffed', 'Roll-Up', 'Thumbhole', 'Doctor Sleeves', 'Elbow Patches'
   ]
 };
 
 // Meesho template export fields
 export const MEESHO_EXPORT_FIELDS = [
   'Product Name', 'Variation', 'Meesho Price', 'Wrong/Defective Returns Price', 'MRP',
   'Net Weight (gms)', 'Inventory', 'Country of Origin', 'Manufacturer Name',
   'Manufacturer Address', 'Manufacturer Pincode', 'Packer Name', 'Packer Address',
   'Packer Pincode', 'Importer Name', 'Importer Address', 'Importer Pincode',
   'Color', 'Fabric', 'Fit/Shape', 'Generic Name', 'Neck', 'Net Quantity (N)',
   'Occasion', 'Pattern', 'Print Or Pattern Type', 'Sleeve Length',
   'Chest Size', 'Length Size', 'Shoulder Size', 'Image 1 (Front)', 'Image 2',
   'Image 3', 'Image 4', 'Product ID / Style ID', 'SKU ID', 'Brand Name',
   'Group ID', 'Product Description', 'EAN/UPC'
 ];