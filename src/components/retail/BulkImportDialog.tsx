import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Category } from '@/types/retail';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onImport: (products: Record<string, unknown>[]) => Promise<void>;
}

type MarketplaceFormat = 'meesho' | 'amazon' | 'flipkart' | 'generic';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

// Field mappings for different marketplace templates
const FIELD_MAPPINGS: Record<MarketplaceFormat, Record<string, string>> = {
  meesho: {
    'Product Name': 'name',
    'SKU ID': 'sku',
    'Product ID / Style ID': 'style_id',
    'Brand Name': 'brand',
    'Product Description': 'description',
    'Meesho Price': 'price',
    'Wrong/Defective Returns Price': 'wrong_defective_price',
    'MRP': 'mrp',
    'Inventory': 'quantity',
    'Color': 'color',
    'Fabric': 'fabric',
    'Saree Fabric': 'fabric',
    'Pattern': 'pattern',
    'Fit/Shape': 'fit_shape',
    'Occasion': 'occasion',
    'Sleeve Length': 'sleeve_length',
    'Neck': 'neck_type',
    'Generic Name': 'generic_name',
    'Net Weight (gms)': 'net_weight_grams',
    'Net Quantity (N)': 'net_quantity',
    'Country of Origin': 'country_of_origin',
    'Manufacturer Name': 'manufacturer_name',
    'Manufacturer Address': 'manufacturer_address',
    'Manufacturer Pincode': 'manufacturer_pincode',
    'Packer Name': 'packer_name',
    'Packer Address': 'packer_address',
    'Packer Pincode': 'packer_pincode',
    'Importer Name': 'importer_name',
    'Importer Address': 'importer_address',
    'Importer Pincode': 'importer_pincode',
    'Image 1 (Front)': 'image_url',
    'Image 2': 'image_url_2',
    'Image 3': 'image_url_3',
    'Image 4': 'image_url_4',
    'Group ID': 'group_id',
    'EAN/UPC': 'ean_upc',
    'Chest Size': 'chest_size',
    'Length Size': 'length_size',
    'Shoulder Size': 'shoulder_size',
    'Print Or Pattern Type': 'print_pattern_type',
    'Print or Pattern Type': 'print_pattern_type',
    'Variation': 'variation',
    'Blouse Length Size': 'length_size',
    'Saree Length Size': 'length_size',
    'Hemline': 'hemline',
    'Length': 'length_type',
    'Sleeve Styling': 'sleeve_styling',
    'Number of Pockets': 'number_of_pockets',
    'Character/Theme': 'character_theme',
  },
  amazon: {
    'item_name': 'name',
    'item_sku': 'sku',
    'external_product_id': 'ean_upc',
    'brand_name': 'brand',
    'product_description': 'description',
    'standard_price': 'price',
    'list_price': 'mrp',
    'quantity': 'quantity',
    'color_name': 'color',
    'material_type': 'fabric',
    'pattern_type': 'pattern',
    'fit_type': 'fit_shape',
    'occasion_type': 'occasion',
    'sleeve_type': 'sleeve_length',
    'neck_style': 'neck_type',
    'item_weight': 'net_weight_grams',
    'country_of_origin': 'country_of_origin',
    'manufacturer': 'manufacturer_name',
    'main_image_url': 'image_url',
    'other_image_url1': 'image_url_2',
    'other_image_url2': 'image_url_3',
    'other_image_url3': 'image_url_4',
    'size_name': 'variation',
    'product_type': 'generic_name',
  },
  flipkart: {
    'Product Name': 'name',
    'SKU ID': 'sku',
    'EAN': 'ean_upc',
    'Brand': 'brand',
    'Description': 'description',
    'Selling Price': 'price',
    'MRP': 'mrp',
    'Stock': 'quantity',
    'Color': 'color',
    'Fabric': 'fabric',
    'Pattern': 'pattern',
    'Fit': 'fit_shape',
    'Occasion': 'occasion',
    'Sleeve': 'sleeve_length',
    'Neck': 'neck_type',
    'Weight': 'net_weight_grams',
    'Country of Origin': 'country_of_origin',
    'Manufacturer Details': 'manufacturer_name',
    'Main Image': 'image_url',
    'Image 2': 'image_url_2',
    'Image 3': 'image_url_3',
    'Image 4': 'image_url_4',
    'Size': 'variation',
  },
  generic: {
    'Name': 'name',
    'SKU': 'sku',
    'Brand': 'brand',
    'Description': 'description',
    'Price': 'price',
    'MRP': 'mrp',
    'Cost': 'cost',
    'Quantity': 'quantity',
    'Stock': 'quantity',
    'Color': 'color',
    'Fabric': 'fabric',
    'Pattern': 'pattern',
    'Fit': 'fit_shape',
    'Occasion': 'occasion',
    'Sleeve Length': 'sleeve_length',
    'Neck Type': 'neck_type',
    'Weight': 'net_weight_grams',
    'Net Weight (gms)': 'net_weight_grams',
    'Country': 'country_of_origin',
    'Image URL': 'image_url',
    'Size': 'variation',
  },
};

export function BulkImportDialog({ open, onOpenChange, categories, onImport }: BulkImportDialogProps) {
  const [format, setFormat] = useState<MarketplaceFormat>('meesho');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [defaultCategory, setDefaultCategory] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setProgress(0);

    try {
      const data = await readExcelFile(selectedFile);
      const mapped = mapToProductFormat(data, format);
      setPreviewData(mapped.slice(0, 10)); // Preview first 10 rows
      
      toast({
        title: 'File loaded',
        description: `Found ${data.length} products. Showing preview of first 10.`,
      });
    } catch (error) {
      toast({
        title: 'Error reading file',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readExcelFile = (file: File): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          
          // Try each sheet to find the one with product data
          let bestResult: Record<string, unknown>[] = [];
          
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            
            // First try: read as array of arrays to find the real header row
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
            
            // Find the header row - look for a row containing product-related column names
            let headerRowIdx = -1;
            const productFieldPatterns = [
              'product name', 'meesho price', 'mrp', 'sku id', 'sku', 'item_name',
              'selling price', 'standard_price', 'inventory', 'variation', 'brand name'
            ];
            
            for (let i = 0; i < Math.min(rawData.length, 15); i++) {
              const row = rawData[i];
              if (!Array.isArray(row)) continue;
              
              const rowStr = row.map(cell => String(cell || '').toLowerCase().trim());
              // Check if this row contains field names (at least 3 product-related fields)
              const matches = rowStr.filter(cell => 
                productFieldPatterns.some(pattern => cell.includes(pattern))
              );
              
              if (matches.length >= 2) {
                headerRowIdx = i;
                break;
              }
            }
            
            let products: Record<string, unknown>[] = [];
            
            if (headerRowIdx >= 0) {
              // Use the found header row and extract clean field names
              const headerRow = rawData[headerRowIdx] as string[];
              const cleanHeaders = headerRow.map(h => {
                if (!h) return '';
                // Extract just the field name (before any description/newline)
                let name = String(h).split('\n')[0].split('\r')[0].trim();
                // Remove "* Compulsory Field" or "Optional Field" prefixes if present
                name = name.replace(/^\*\s*/, '').trim();
                return name;
              });
              
              // Extract data rows after the header
              for (let i = headerRowIdx + 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!Array.isArray(row) || row.length < 3) continue;
                
                const record: Record<string, unknown> = {};
                let nonEmpty = 0;
                
                cleanHeaders.forEach((header, colIdx) => {
                  if (header && row[colIdx] !== undefined && row[colIdx] !== null && String(row[colIdx]).trim() !== '') {
                    record[header] = row[colIdx];
                    nonEmpty++;
                  }
                });
                
                // Skip rows with too few values or descriptor/tutorial rows
                if (nonEmpty < 3) continue;
                const firstVal = String(Object.values(record)[0] || '').toLowerCase();
                if (firstVal.includes('field names') || firstVal.includes('fields + description') || 
                    firstVal.includes('tutorial') || firstVal.includes('compulsory') ||
                    firstVal.includes('do not fill')) continue;
                
                products.push(record);
              }
            } else {
              // Fallback: standard sheet_to_json (for simple templates)
              products = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
              
              // Filter out descriptor rows
              products = products.filter(row => {
                const values = Object.values(row);
                const nonEmpty = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
                if (nonEmpty.length < 3) return false;
                const firstVal = String(values[0] || '').toLowerCase();
                if (firstVal.includes('field names') || firstVal.includes('fields + description') || 
                    firstVal.includes('tutorial') || firstVal.includes('do not fill')) return false;
                return true;
              });
            }
            
            if (products.length > bestResult.length) {
              bestResult = products;
            }
          }
          
          resolve(bestResult);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const mapToProductFormat = (data: Record<string, unknown>[], marketplaceFormat: MarketplaceFormat): Record<string, unknown>[] => {
    const mapping = FIELD_MAPPINGS[marketplaceFormat];
    
    return data.map((row) => {
      const product: Record<string, unknown> = {
        low_stock_threshold: 10,
        reorder_quantity: 50,
        auto_reorder: false,
        country_of_origin: 'India',
        cost: 0,
      };

      // Map fields from the template to our product format
      for (const [templateField, productField] of Object.entries(mapping)) {
        if (row[templateField] !== undefined && row[templateField] !== null && row[templateField] !== '') {
          let value = row[templateField];
          
      // Convert numeric fields
          if (['price', 'mrp', 'cost', 'quantity', 'net_weight_grams', 'net_quantity', 'wrong_defective_price', 'number_of_pockets'].includes(productField)) {
            value = parseFloat(String(value)) || 0;
          }
          
          product[productField] = value;
        }
      }

      // Also try to map by checking for similar field names (case-insensitive)
      for (const [key, value] of Object.entries(row)) {
        const lowerKey = key.toLowerCase().trim();
        
        // Check if we already have this field mapped
        const mappedFields = new Set(Object.values(product).filter(v => v !== undefined));
        
        // Try to auto-detect common fields
        if (lowerKey.includes('product name') && !product.name) product.name = value;
        if (lowerKey.includes('name') && !lowerKey.includes('brand') && !lowerKey.includes('manufacturer') && !lowerKey.includes('packer') && !lowerKey.includes('importer') && !lowerKey.includes('generic') && !product.name) product.name = value;
        if (lowerKey.includes('sku') && !product.sku) product.sku = value;
        if ((lowerKey.includes('price') || lowerKey.includes('selling')) && !lowerKey.includes('mrp') && !lowerKey.includes('wrong') && !lowerKey.includes('defective') && !product.price) {
          product.price = parseFloat(String(value)) || 0;
        }
        if (lowerKey.includes('mrp') && !product.mrp) {
          product.mrp = parseFloat(String(value)) || 0;
        }
        if (lowerKey.includes('weight') && !lowerKey.includes('charge') && !product.net_weight_grams) {
          product.net_weight_grams = parseFloat(String(value)) || 0;
        }
        if (lowerKey.includes('stock') || lowerKey.includes('inventory') || lowerKey === 'quantity') {
          if (!product.quantity) product.quantity = parseFloat(String(value)) || 0;
        }
      }

      // Ensure required fields
      if (!product.sku && product.name) {
        product.sku = `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
      }

      // Set MRP if not set
      if (!product.mrp && product.price) {
        product.mrp = product.price;
      }

      // Set default category if provided
      if (defaultCategory) {
        product.category_id = defaultCategory;
      }

      return product;
    });
  };

  const handleImport = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const data = await readExcelFile(file);
      const products = mapToProductFormat(data, format);
      
      const errors: string[] = [];
      let success = 0;
      let failed = 0;

      // Validate products
      const validProducts: Record<string, unknown>[] = [];
      products.forEach((product, index) => {
        if (!product.name) {
          errors.push(`Row ${index + 2}: Missing product name`);
          failed++;
          return;
        }
        if (!product.sku) {
          errors.push(`Row ${index + 2}: Missing SKU`);
          failed++;
          return;
        }
        if ((product.price as number) <= 0) {
          errors.push(`Row ${index + 2}: Invalid price for "${product.name}"`);
          failed++;
          return;
        }
        validProducts.push(product);
        success++;
      });

      setProgress(50);

      // Import valid products
      if (validProducts.length > 0) {
        await onImport(validProducts);
      }

      setProgress(100);
      setResult({ success, failed, errors: errors.slice(0, 10) }); // Show first 10 errors

      if (success > 0) {
        toast({
          title: 'Import complete',
          description: `Successfully imported ${success} products${failed > 0 ? `, ${failed} failed` : ''}`,
        });
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = (templateFormat: MarketplaceFormat) => {
    const fields = Object.keys(FIELD_MAPPINGS[templateFormat]);
    const ws = XLSX.utils.aoa_to_sheet([fields, []]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `${templateFormat}_product_template.xlsx`);
  };

  const resetDialog = () => {
    setFile(null);
    setPreviewData([]);
    setResult(null);
    setProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetDialog();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-3xl bg-card border-border max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Bulk Import Products
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Import Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as MarketplaceFormat)}>
                <SelectTrigger className="input-retail">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meesho">Meesho Template</SelectItem>
                  <SelectItem value="amazon">Amazon Template</SelectItem>
                  <SelectItem value="flipkart">Flipkart Template</SelectItem>
                  <SelectItem value="generic">Generic/Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Category</Label>
              <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                <SelectTrigger className="input-retail">
                  <SelectValue placeholder="Select category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Download Template */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate('meesho')}>
              <Download className="w-4 h-4 mr-1" />
              Meesho Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate('amazon')}>
              <Download className="w-4 h-4 mr-1" />
              Amazon Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadTemplate('flipkart')}>
              <Download className="w-4 h-4 mr-1" />
              Flipkart Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              id="bulk-import-file"
            />
            {file ? (
              <div className="space-y-2">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {previewData.length > 0 ? `Preview: ${previewData.length} products` : 'Processing...'}
                </p>
                <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                  Change File
                </Button>
              </div>
            ) : (
              <label htmlFor="bulk-import-file" className="cursor-pointer space-y-2 block">
                <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="font-medium">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">Excel files (.xlsx, .xls) or CSV</p>
              </label>
            )}
          </div>

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="space-y-2">
              <Label>Preview (first 10 products)</Label>
              <ScrollArea className="h-[200px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-secondary sticky top-0">
                    <tr>
                     <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">SKU</th>
                      <th className="p-2 text-right">Price</th>
                      <th className="p-2 text-right">MRP</th>
                      <th className="p-2 text-right">Weight</th>
                      <th className="p-2 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((product, idx) => (
                      <tr key={idx} className="border-b border-border">
                        <td className="p-2 truncate max-w-[200px]">{String(product.name || '-')}</td>
                        <td className="p-2 font-mono text-xs">{String(product.sku || '-')}</td>
                        <td className="p-2 text-right">₹{Number(product.price || 0).toFixed(2)}</td>
                        <td className="p-2 text-right">₹{Number(product.mrp || 0).toFixed(2)}</td>
                        <td className="p-2 text-right">{product.net_weight_grams ? `${product.net_weight_grams}g` : '-'}</td>
                        <td className="p-2 text-right">{String(product.quantity || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Importing products...</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Result */}
          {result && (
            <Alert variant={result.failed > 0 ? 'destructive' : 'default'}>
              {result.failed > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <AlertDescription>
                <p className="font-medium">
                  Imported {result.success} products, {result.failed} failed
                </p>
                {result.errors.length > 0 && (
                  <ul className="mt-2 text-sm space-y-1">
                    {result.errors.map((err, idx) => (
                      <li key={idx}>• {err}</li>
                    ))}
                    {result.errors.length === 10 && (
                      <li className="text-muted-foreground">...and more</li>
                    )}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!file || isProcessing || previewData.length === 0}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {previewData.length > 0 ? `${previewData.length}+ Products` : 'Products'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
