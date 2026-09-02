 import { useState, useEffect, useRef } from 'react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Switch } from '@/components/ui/switch';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Product, Category } from '@/types/retail';
 import { MARKETPLACE_OPTIONS } from '@/types/marketplace';
 import { useImageUpload } from '@/hooks/useImageUpload';
 import { useAIProductAssistant } from '@/hooks/useAIProductAssistant';
 import { Upload, X, Loader2, Image as ImageIcon, Sparkles, Wand2, DollarSign, Layers } from 'lucide-react';
 import { Progress } from '@/components/ui/progress';
 import { ScrollArea } from '@/components/ui/scroll-area';
 
 interface MarketplaceProductDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   product: Product | null;
   categories: Category[];
   onSave: (product: Record<string, unknown>) => void;
 }
 
 const defaultProduct = {
   name: '',
   sku: '',
   barcode: '',
   price: 0,
   cost: 0,
   mrp: 0,
   quantity: 0,
   category_id: '',
   low_stock_threshold: 10,
   reorder_quantity: 50,
   auto_reorder: false,
   image_url: '',
   image_url_2: '',
   image_url_3: '',
   image_url_4: '',
   description: '',
   brand: '',
   generic_name: '',
   color: '',
   fabric: '',
   pattern: '',
   fit_shape: '',
   occasion: '',
   sleeve_length: '',
   neck_type: '',
   hemline: '',
   length_type: '',
   sleeve_styling: '',
   print_pattern_type: '',
   character_theme: '',
   number_of_pockets: 0,
   net_weight_grams: 0,
   net_quantity: 1,
   chest_size: '',
   length_size: '',
   shoulder_size: '',
   country_of_origin: 'India',
   manufacturer_name: '',
   manufacturer_address: '',
   manufacturer_pincode: '',
   packer_name: '',
   packer_address: '',
   packer_pincode: '',
   importer_name: '',
   importer_address: '',
   importer_pincode: '',
   ean_upc: '',
   style_id: '',
   group_id: '',
 };
 
 export function MarketplaceProductDialog({ open, onOpenChange, product, categories, onSave }: MarketplaceProductDialogProps) {
   const [formData, setFormData] = useState(defaultProduct);
   const [errors, setErrors] = useState<Record<string, string>>({});
   const [activeTab, setActiveTab] = useState('basic');
   const fileInputRef = useRef<HTMLInputElement>(null);
   const { uploadImage, isUploading, uploadProgress } = useImageUpload();
   const { isLoading: aiLoading, generateProductDetails, enhanceDescription, suggestPricing } = useAIProductAssistant();
 
   useEffect(() => {
     if (product) {
       setFormData({
         name: product.name || '',
         sku: product.sku || '',
         barcode: product.barcode || '',
         price: Number(product.price) || 0,
         cost: Number(product.cost) || 0,
         mrp: Number(product.mrp) || 0,
         quantity: product.quantity || 0,
         category_id: product.category_id || '',
         low_stock_threshold: product.low_stock_threshold || 10,
         reorder_quantity: product.reorder_quantity || 50,
         auto_reorder: product.auto_reorder || false,
         image_url: product.image_url || '',
         image_url_2: product.image_url_2 || '',
         image_url_3: product.image_url_3 || '',
         image_url_4: product.image_url_4 || '',
         description: product.description || '',
         brand: product.brand || '',
         generic_name: product.generic_name || '',
         color: product.color || '',
         fabric: product.fabric || '',
         pattern: product.pattern || '',
         fit_shape: product.fit_shape || '',
         occasion: product.occasion || '',
         sleeve_length: product.sleeve_length || '',
         neck_type: product.neck_type || '',
         hemline: product.hemline || '',
         length_type: product.length_type || '',
         sleeve_styling: product.sleeve_styling || '',
         print_pattern_type: product.print_pattern_type || '',
         character_theme: product.character_theme || '',
         number_of_pockets: Number(product.number_of_pockets) || 0,
         net_weight_grams: Number(product.net_weight_grams) || 0,
         net_quantity: Number(product.net_quantity) || 1,
         chest_size: product.chest_size || '',
         length_size: product.length_size || '',
         shoulder_size: product.shoulder_size || '',
         country_of_origin: product.country_of_origin || 'India',
         manufacturer_name: product.manufacturer_name || '',
         manufacturer_address: product.manufacturer_address || '',
         manufacturer_pincode: product.manufacturer_pincode || '',
         packer_name: product.packer_name || '',
         packer_address: product.packer_address || '',
         packer_pincode: product.packer_pincode || '',
         importer_name: product.importer_name || '',
         importer_address: product.importer_address || '',
         importer_pincode: product.importer_pincode || '',
         ean_upc: product.ean_upc || '',
         style_id: product.style_id || '',
         group_id: product.group_id || '',
       });
     } else {
       setFormData(defaultProduct);
     }
     setErrors({});
     setActiveTab('basic');
   }, [product, open]);
 
   const validate = () => {
     const newErrors: Record<string, string> = {};
     if (!formData.name.trim()) newErrors.name = 'Name is required';
     if (!formData.sku.trim()) newErrors.sku = 'SKU is required';
     if (formData.price <= 0) newErrors.price = 'Price must be greater than 0';
     if (formData.cost < 0) newErrors.cost = 'Cost cannot be negative';
     if (formData.quantity < 0) newErrors.quantity = 'Quantity cannot be negative';
     setErrors(newErrors);
     return Object.keys(newErrors).length === 0;
   };
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (validate()) {
       onSave({
         ...formData,
         category_id: formData.category_id || null,
         barcode: formData.barcode || null,
         image_url: formData.image_url || null,
         image_url_2: formData.image_url_2 || null,
         image_url_3: formData.image_url_3 || null,
         image_url_4: formData.image_url_4 || null,
       });
     }
   };
 
   const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, imageField: string = 'image_url') => {
     const file = e.target.files?.[0];
     if (!file) return;
 
     const result = await uploadImage(file);
     if (result) {
       setFormData({ ...formData, [imageField]: result.url });
     }
 
     if (fileInputRef.current) {
       fileInputRef.current.value = '';
     }
   };
 
   const handleAIGenerate = async () => {
     if (!formData.name.trim()) {
       setErrors({ name: 'Enter a product name first' });
       return;
     }
 
     const category = categories.find(c => c.id === formData.category_id);
     const details = await generateProductDetails(formData.name, category?.name);
     
     if (details) {
       setFormData(prev => ({
         ...prev,
         description: details.description || prev.description,
         brand: details.brand || prev.brand,
         generic_name: details.generic_name || prev.generic_name,
         color: details.color || prev.color,
         fabric: details.fabric || prev.fabric,
         pattern: details.pattern || prev.pattern,
         fit_shape: details.fit_shape || prev.fit_shape,
         occasion: details.occasion || prev.occasion,
         sleeve_length: details.sleeve_length || prev.sleeve_length,
         neck_type: details.neck_type || prev.neck_type,
         hemline: details.hemline || prev.hemline,
         length_type: details.length_type || prev.length_type,
         print_pattern_type: details.print_pattern_type || prev.print_pattern_type,
         sleeve_styling: details.sleeve_styling || prev.sleeve_styling,
         net_weight_grams: details.net_weight_grams || prev.net_weight_grams,
         mrp: details.suggested_mrp || prev.mrp,
         price: details.suggested_price || prev.price,
       }));
     }
   };
 
   const handleAIEnhanceDescription = async () => {
     if (!formData.name.trim()) return;
     const enhanced = await enhanceDescription(formData.name, formData.description);
     if (enhanced) {
       setFormData(prev => ({ ...prev, description: enhanced }));
     }
   };
 
   const handleAISuggestPricing = async () => {
     if (!formData.name.trim()) return;
     const category = categories.find(c => c.id === formData.category_id);
     const pricing = await suggestPricing(formData.name, category?.name, formData.cost);
     if (pricing) {
       setFormData(prev => ({
         ...prev,
         mrp: pricing.mrp,
         price: pricing.selling_price,
       }));
     }
   };
 
   const updateField = (field: string, value: string | number | boolean) => {
     setFormData(prev => ({ ...prev, [field]: value }));
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-4xl bg-card border-border max-h-[90vh] overflow-hidden p-0">
         <DialogHeader className="px-6 pt-6 pb-2">
           <DialogTitle className="flex items-center gap-2">
             {product ? 'Edit Product' : 'Add New Product'}
             <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
               Marketplace Compatible
             </span>
           </DialogTitle>
         </DialogHeader>
         
         <form onSubmit={handleSubmit} className="flex flex-col h-[calc(90vh-100px)]">
           {/* AI Actions Bar */}
           <div className="px-6 py-3 border-b border-border bg-secondary/30 flex flex-wrap gap-2">
             <Button
               type="button"
               variant="outline"
               size="sm"
               onClick={handleAIGenerate}
               disabled={aiLoading || !formData.name.trim()}
               className="gap-1.5"
             >
               {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
               AI Generate Details
             </Button>
             <Button
               type="button"
               variant="outline"
               size="sm"
               onClick={handleAIEnhanceDescription}
               disabled={aiLoading || !formData.name.trim()}
               className="gap-1.5"
             >
               <Wand2 className="w-4 h-4" />
               Enhance Description
             </Button>
             <Button
               type="button"
               variant="outline"
               size="sm"
               onClick={handleAISuggestPricing}
               disabled={aiLoading || !formData.cost}
               className="gap-1.5"
             >
               <DollarSign className="w-4 h-4" />
               Suggest Pricing
             </Button>
           </div>
 
           <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
             <TabsList className="mx-6 mt-4 grid w-auto grid-cols-5 gap-1">
               <TabsTrigger value="basic" className="text-xs">Basic Info</TabsTrigger>
               <TabsTrigger value="attributes" className="text-xs">Attributes</TabsTrigger>
               <TabsTrigger value="images" className="text-xs">Images</TabsTrigger>
               <TabsTrigger value="manufacturer" className="text-xs">Manufacturer</TabsTrigger>
               <TabsTrigger value="inventory" className="text-xs">Inventory</TabsTrigger>
             </TabsList>
 
             <ScrollArea className="flex-1 px-6 py-4">
               <TabsContent value="basic" className="mt-0 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2 col-span-2">
                     <Label htmlFor="name">Product Name *</Label>
                     <Input
                       id="name"
                       value={formData.name}
                       onChange={(e) => updateField('name', e.target.value)}
                       className="input-retail"
                       placeholder="Men's Solid Cotton T-Shirt - Round Neck Half Sleeve"
                     />
                     {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="sku">SKU *</Label>
                     <Input
                       id="sku"
                       value={formData.sku}
                       onChange={(e) => updateField('sku', e.target.value.toUpperCase())}
                       className="input-retail font-mono"
                       placeholder="TSH-BLK-001"
                     />
                     {errors.sku && <p className="text-xs text-destructive">{errors.sku}</p>}
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="style_id">Style ID / Product ID</Label>
                     <Input
                       id="style_id"
                       value={formData.style_id}
                       onChange={(e) => updateField('style_id', e.target.value)}
                       className="input-retail font-mono"
                       placeholder="STYLE-001"
                     />
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="brand">Brand</Label>
                     <Input
                       id="brand"
                       value={formData.brand}
                       onChange={(e) => updateField('brand', e.target.value)}
                       className="input-retail"
                       placeholder="Your Brand Name"
                     />
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="generic_name">Generic Name</Label>
                     <Input
                       id="generic_name"
                       value={formData.generic_name}
                       onChange={(e) => updateField('generic_name', e.target.value)}
                       className="input-retail"
                       placeholder="T-Shirt, Kurta, Jeans, etc."
                     />
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="category">Category</Label>
                     <Select
                       value={formData.category_id}
                       onValueChange={(value) => updateField('category_id', value)}
                     >
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select category" />
                       </SelectTrigger>
                       <SelectContent>
                         {categories.map((cat) => (
                           <SelectItem key={cat.id} value={cat.id}>
                             {cat.name}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label htmlFor="group_id">Group ID</Label>
                     <Input
                       id="group_id"
                       value={formData.group_id}
                       onChange={(e) => updateField('group_id', e.target.value)}
                       className="input-retail"
                       placeholder="For catalog grouping"
                     />
                   </div>
                 </div>
 
                 <div className="space-y-2">
                   <Label htmlFor="description">Product Description</Label>
                   <Textarea
                     id="description"
                     value={formData.description}
                     onChange={(e) => updateField('description', e.target.value)}
                     className="input-retail min-h-[120px]"
                     placeholder="Detailed product description for marketplaces..."
                   />
                 </div>
 
                 <div className="grid grid-cols-4 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="cost">Cost (₹)</Label>
                     <Input
                       id="cost"
                       type="number"
                       step="0.01"
                       value={formData.cost}
                       onChange={(e) => updateField('cost', parseFloat(e.target.value) || 0)}
                       className="input-retail"
                     />
                     {errors.cost && <p className="text-xs text-destructive">{errors.cost}</p>}
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="price">Selling Price (₹) *</Label>
                     <Input
                       id="price"
                       type="number"
                       step="0.01"
                       value={formData.price}
                       onChange={(e) => updateField('price', parseFloat(e.target.value) || 0)}
                       className="input-retail"
                     />
                     {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="mrp">MRP (₹)</Label>
                     <Input
                       id="mrp"
                       type="number"
                       step="0.01"
                       value={formData.mrp}
                       onChange={(e) => updateField('mrp', parseFloat(e.target.value) || 0)}
                       className="input-retail"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="ean_upc">EAN/UPC</Label>
                     <Input
                       id="ean_upc"
                       value={formData.ean_upc}
                       onChange={(e) => updateField('ean_upc', e.target.value)}
                       className="input-retail font-mono"
                       placeholder="13-digit barcode"
                     />
                   </div>
                 </div>
               </TabsContent>
 
               <TabsContent value="attributes" className="mt-0 space-y-4">
                 <div className="grid grid-cols-3 gap-4">
                   <div className="space-y-2">
                     <Label>Color</Label>
                     <Select value={formData.color} onValueChange={(v) => updateField('color', v)}>
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select color" />
                       </SelectTrigger>
                       <SelectContent>
                         {MARKETPLACE_OPTIONS.colors.map((opt) => (
                           <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>Fabric</Label>
                     <Select value={formData.fabric} onValueChange={(v) => updateField('fabric', v)}>
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select fabric" />
                       </SelectTrigger>
                       <SelectContent>
                         {MARKETPLACE_OPTIONS.fabrics.map((opt) => (
                           <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>Pattern</Label>
                     <Select value={formData.pattern} onValueChange={(v) => updateField('pattern', v)}>
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select pattern" />
                       </SelectTrigger>
                       <SelectContent>
                         {MARKETPLACE_OPTIONS.patterns.map((opt) => (
                           <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>Fit/Shape</Label>
                     <Select value={formData.fit_shape} onValueChange={(v) => updateField('fit_shape', v)}>
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select fit" />
                       </SelectTrigger>
                       <SelectContent>
                         {MARKETPLACE_OPTIONS.fitShapes.map((opt) => (
                           <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>Occasion</Label>
                     <Select value={formData.occasion} onValueChange={(v) => updateField('occasion', v)}>
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select occasion" />
                       </SelectTrigger>
                       <SelectContent>
                         {MARKETPLACE_OPTIONS.occasions.map((opt) => (
                           <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>Sleeve Length</Label>
                     <Select value={formData.sleeve_length} onValueChange={(v) => updateField('sleeve_length', v)}>
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select sleeve length" />
                       </SelectTrigger>
                       <SelectContent>
                         {MARKETPLACE_OPTIONS.sleeveLengths.map((opt) => (
                           <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>Neck Type</Label>
                     <Select value={formData.neck_type} onValueChange={(v) => updateField('neck_type', v)}>
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select neck type" />
                       </SelectTrigger>
                       <SelectContent>
                         {MARKETPLACE_OPTIONS.neckTypes.map((opt) => (
                           <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>Hemline</Label>
                     <Select value={formData.hemline} onValueChange={(v) => updateField('hemline', v)}>
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select hemline" />
                       </SelectTrigger>
                       <SelectContent>
                         {MARKETPLACE_OPTIONS.hemlines.map((opt) => (
                           <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>Length Type</Label>
                     <Select value={formData.length_type} onValueChange={(v) => updateField('length_type', v)}>
                       <SelectTrigger className="input-retail">
                         <SelectValue placeholder="Select length type" />
                       </SelectTrigger>
                       <SelectContent>
                         {MARKETPLACE_OPTIONS.lengthTypes.map((opt) => (
                           <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                 </div>
 
                 <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                   <div className="space-y-2">
                     <Label htmlFor="net_weight">Net Weight (gms)</Label>
                     <Input
                       id="net_weight"
                       type="number"
                       value={formData.net_weight_grams}
                       onChange={(e) => updateField('net_weight_grams', parseInt(e.target.value) || 0)}
                       className="input-retail"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="net_qty">Net Quantity</Label>
                     <Input
                       id="net_qty"
                       type="number"
                       value={formData.net_quantity}
                       onChange={(e) => updateField('net_quantity', parseInt(e.target.value) || 1)}
                       className="input-retail"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="chest_size">Chest Size (in)</Label>
                     <Input
                       id="chest_size"
                       value={formData.chest_size}
                       onChange={(e) => updateField('chest_size', e.target.value)}
                       className="input-retail"
                       placeholder="38"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="length_size">Length Size (in)</Label>
                     <Input
                       id="length_size"
                       value={formData.length_size}
                       onChange={(e) => updateField('length_size', e.target.value)}
                       className="input-retail"
                       placeholder="27"
                     />
                   </div>
                 </div>
               </TabsContent>
 
               <TabsContent value="images" className="mt-0 space-y-4">
                 <p className="text-sm text-muted-foreground">
                   Upload up to 4 images. Image 1 is required for marketplace listings.
                 </p>
                 <div className="grid grid-cols-2 gap-4">
                   {['image_url', 'image_url_2', 'image_url_3', 'image_url_4'].map((field, idx) => (
                     <div key={field} className="space-y-2">
                       <Label>Image {idx + 1} {idx === 0 && '(Front - Required)'}</Label>
                       <div className="flex gap-3 items-start">
                         <div className="w-20 h-20 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                           {formData[field as keyof typeof formData] ? (
                             <img
                               src={formData[field as keyof typeof formData] as string}
                               alt={`Product ${idx + 1}`}
                               className="w-full h-full object-cover"
                             />
                           ) : (
                             <ImageIcon className="w-6 h-6 text-muted-foreground" />
                           )}
                         </div>
                         <div className="flex-1 space-y-2">
                           <input
                             type="file"
                             accept="image/jpeg,image/png,image/webp"
                             onChange={(e) => handleFileSelect(e, field)}
                             className="hidden"
                             id={`file-${field}`}
                           />
                           {isUploading ? (
                             <div className="space-y-1">
                               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                 <Loader2 className="w-4 h-4 animate-spin" />
                                 Uploading...
                               </div>
                               <Progress value={uploadProgress} className="h-2" />
                             </div>
                           ) : (
                             <div className="flex gap-2">
                               <Button
                                 type="button"
                                 variant="outline"
                                 size="sm"
                                 onClick={() => document.getElementById(`file-${field}`)?.click()}
                               >
                                 <Upload className="w-4 h-4 mr-1" />
                                 Upload
                               </Button>
                               {formData[field as keyof typeof formData] && (
                                 <Button
                                   type="button"
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => updateField(field, '')}
                                   className="text-destructive"
                                 >
                                   <X className="w-4 h-4" />
                                 </Button>
                               )}
                             </div>
                           )}
                           <Input
                             value={formData[field as keyof typeof formData] as string}
                             onChange={(e) => updateField(field, e.target.value)}
                             className="input-retail text-xs"
                             placeholder="Or paste image URL"
                           />
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </TabsContent>
 
               <TabsContent value="manufacturer" className="mt-0 space-y-4">
                 <div className="space-y-2">
                   <Label>Country of Origin</Label>
                   <Select value={formData.country_of_origin} onValueChange={(v) => updateField('country_of_origin', v)}>
                     <SelectTrigger className="input-retail">
                       <SelectValue placeholder="Select country" />
                     </SelectTrigger>
                     <SelectContent>
                       {MARKETPLACE_OPTIONS.countries.map((opt) => (
                         <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
 
                 <div className="p-4 rounded-lg border border-border space-y-4">
                   <h4 className="font-medium">Manufacturer Details</h4>
                   <div className="grid grid-cols-3 gap-4">
                     <div className="space-y-2">
                       <Label htmlFor="mfr_name">Name</Label>
                       <Input
                         id="mfr_name"
                         value={formData.manufacturer_name}
                         onChange={(e) => updateField('manufacturer_name', e.target.value)}
                         className="input-retail"
                       />
                     </div>
                     <div className="space-y-2 col-span-2">
                       <Label htmlFor="mfr_address">Address</Label>
                       <Input
                         id="mfr_address"
                         value={formData.manufacturer_address}
                         onChange={(e) => updateField('manufacturer_address', e.target.value)}
                         className="input-retail"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="mfr_pin">Pincode</Label>
                       <Input
                         id="mfr_pin"
                         value={formData.manufacturer_pincode}
                         onChange={(e) => updateField('manufacturer_pincode', e.target.value)}
                         className="input-retail"
                       />
                     </div>
                   </div>
                 </div>
 
                 <div className="p-4 rounded-lg border border-border space-y-4">
                   <h4 className="font-medium">Packer Details</h4>
                   <div className="grid grid-cols-3 gap-4">
                     <div className="space-y-2">
                       <Label htmlFor="pkr_name">Name</Label>
                       <Input
                         id="pkr_name"
                         value={formData.packer_name}
                         onChange={(e) => updateField('packer_name', e.target.value)}
                         className="input-retail"
                       />
                     </div>
                     <div className="space-y-2 col-span-2">
                       <Label htmlFor="pkr_address">Address</Label>
                       <Input
                         id="pkr_address"
                         value={formData.packer_address}
                         onChange={(e) => updateField('packer_address', e.target.value)}
                         className="input-retail"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="pkr_pin">Pincode</Label>
                       <Input
                         id="pkr_pin"
                         value={formData.packer_pincode}
                         onChange={(e) => updateField('packer_pincode', e.target.value)}
                         className="input-retail"
                       />
                     </div>
                   </div>
                 </div>
 
                 <div className="p-4 rounded-lg border border-border space-y-4">
                   <h4 className="font-medium">Importer Details (if imported)</h4>
                   <div className="grid grid-cols-3 gap-4">
                     <div className="space-y-2">
                       <Label htmlFor="imp_name">Name</Label>
                       <Input
                         id="imp_name"
                         value={formData.importer_name}
                         onChange={(e) => updateField('importer_name', e.target.value)}
                         className="input-retail"
                       />
                     </div>
                     <div className="space-y-2 col-span-2">
                       <Label htmlFor="imp_address">Address</Label>
                       <Input
                         id="imp_address"
                         value={formData.importer_address}
                         onChange={(e) => updateField('importer_address', e.target.value)}
                         className="input-retail"
                       />
                     </div>
                     <div className="space-y-2">
                       <Label htmlFor="imp_pin">Pincode</Label>
                       <Input
                         id="imp_pin"
                         value={formData.importer_pincode}
                         onChange={(e) => updateField('importer_pincode', e.target.value)}
                         className="input-retail"
                       />
                     </div>
                   </div>
                 </div>
               </TabsContent>
 
               <TabsContent value="inventory" className="mt-0 space-y-4">
                 <div className="grid grid-cols-3 gap-4">
                   <div className="space-y-2">
                     <Label htmlFor="quantity">Stock Quantity *</Label>
                     <Input
                       id="quantity"
                       type="number"
                       value={formData.quantity}
                       onChange={(e) => updateField('quantity', parseInt(e.target.value) || 0)}
                       className="input-retail"
                     />
                     {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="threshold">Low Stock Alert</Label>
                     <Input
                       id="threshold"
                       type="number"
                       value={formData.low_stock_threshold}
                       onChange={(e) => updateField('low_stock_threshold', parseInt(e.target.value) || 10)}
                       className="input-retail"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="barcode">Barcode</Label>
                     <Input
                       id="barcode"
                       value={formData.barcode}
                       onChange={(e) => updateField('barcode', e.target.value)}
                       className="input-retail font-mono"
                     />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="net_weight_grams">Net Weight (grams)</Label>
                      <Input
                        id="net_weight_grams"
                        type="number"
                        value={formData.net_weight_grams}
                        onChange={(e) => updateField('net_weight_grams', parseInt(e.target.value) || 0)}
                        className="input-retail"
                        placeholder="e.g. 500"
                      />
                      <p className="text-[10px] text-muted-foreground">Used for shipping charge calculations</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="net_quantity">Net Quantity</Label>
                      <Input
                        id="net_quantity"
                        type="number"
                        value={formData.net_quantity}
                        onChange={(e) => updateField('net_quantity', parseInt(e.target.value) || 1)}
                        className="input-retail"
                        placeholder="e.g. 1"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-secondary/50 space-y-4">
                   <div className="flex items-center justify-between">
                     <div>
                       <Label>Auto Reorder</Label>
                       <p className="text-xs text-muted-foreground">Automatically create reorder when stock is low</p>
                     </div>
                     <Switch
                       checked={formData.auto_reorder}
                       onCheckedChange={(checked) => updateField('auto_reorder', checked)}
                     />
                   </div>
                   {formData.auto_reorder && (
                     <div className="space-y-2">
                       <Label htmlFor="reorderQty">Reorder Quantity</Label>
                       <Input
                         id="reorderQty"
                         type="number"
                         value={formData.reorder_quantity}
                         onChange={(e) => updateField('reorder_quantity', parseInt(e.target.value) || 50)}
                         className="input-retail"
                       />
                     </div>
                   )}
                 </div>
               </TabsContent>
             </ScrollArea>
           </Tabs>
 
           <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-background">
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isUploading || aiLoading}>
               {product ? 'Update Product' : 'Add Product'}
             </Button>
           </div>
         </form>
       </DialogContent>
     </Dialog>
   );
 }