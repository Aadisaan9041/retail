import { useState } from 'react';
import { Search, Plus, Edit, Trash2, Package, FolderPlus, Download, Upload, Layers, RefreshCw } from 'lucide-react';
import { Product, Category } from '@/types/retail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MarketplaceProductDialog } from './MarketplaceProductDialog';
import { BulkImportDialog } from './BulkImportDialog';
import { ProductVariantsDialog } from './ProductVariantsDialog';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketplaceIntegration } from '@/hooks/useMarketplaceIntegration';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import * as XLSX from 'xlsx';

interface ProductsViewProps {
  products: Product[];
  categories: Category[];
  onAddProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category'>) => Promise<any>;
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  onDeleteProduct: (id: string) => Promise<boolean>;
  onAddCategory: (name: string, description?: string) => Promise<any>;
}

export function ProductsView({ 
  products, 
  categories, 
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct,
  onAddCategory 
}: ProductsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [variantsDialogOpen, setVariantsDialogOpen] = useState(false);
  const [variantsProduct, setVariantsProduct] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const { toast } = useToast();
  const { isAdmin, isManager } = useAuth();
  const { syncAllStock, isSyncing } = useMarketplaceIntegration();

  const canManageProducts = isAdmin || isManager;

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { formatCurrency } = useCurrency();

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleDelete = async (product: Product) => {
    const success = await onDeleteProduct(product.id);
    if (success) {
      toast({
        title: 'Product Deleted',
        description: `${product.name} has been removed from inventory.`,
      });
    }
  };

  const handleSave = async (productData: any) => {
    if (editingProduct) {
      const success = await onUpdateProduct(editingProduct.id, productData);
      if (success) {
        toast({
          title: 'Product Updated',
          description: `${productData.name} has been updated.`,
        });
      }
    } else {
      const result = await onAddProduct(productData);
      if (result) {
        toast({
          title: 'Product Added',
          description: `${productData.name} has been added to inventory.`,
        });
      }
    }
    setIsDialogOpen(false);
    setEditingProduct(null);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    const result = await onAddCategory(newCategoryName.trim(), newCategoryDesc.trim() || undefined);
    if (result) {
      toast({
        title: 'Category Added',
        description: `${newCategoryName} has been created.`,
      });
      setCategoryDialogOpen(false);
      setNewCategoryName('');
      setNewCategoryDesc('');
    }
  };

  // Export products to Excel (Marketplace compatible)
  const exportToExcel = (format: 'meesho' | 'amazon' | 'flipkart' | 'all') => {
    const exportData = products.map(product => {
      if (format === 'meesho') {
        return {
          'Product Name': product.name,
          'Variation': 'Free Size',
          'Meesho Price': product.price,
          'Wrong/Defective Returns Price': Number(product.price) - 22,
          'MRP': product.mrp || product.price,
          'Net Weight (gms)': product.net_weight_grams || 200,
          'Inventory': product.quantity,
          'Country of Origin': product.country_of_origin || 'India',
          'Manufacturer Name': product.manufacturer_name || '',
          'Manufacturer Address': product.manufacturer_address || '',
          'Manufacturer Pincode': product.manufacturer_pincode || '',
          'Packer Name': product.packer_name || '',
          'Packer Address': product.packer_address || '',
          'Packer Pincode': product.packer_pincode || '',
          'Color': product.color || '',
          'Fabric': product.fabric || '',
          'Fit/Shape': product.fit_shape || '',
          'Generic Name': product.generic_name || '',
          'Neck': product.neck_type || '',
          'Net Quantity (N)': product.net_quantity || 1,
          'Occasion': product.occasion || '',
          'Pattern': product.pattern || '',
          'Print Or Pattern Type': product.print_pattern_type || '',
          'Sleeve Length': product.sleeve_length || '',
          'Chest Size': product.chest_size || '',
          'Length Size': product.length_size || '',
          'Shoulder Size': product.shoulder_size || '',
          'Image 1 (Front)': product.image_url || '',
          'Image 2': product.image_url_2 || '',
          'Image 3': product.image_url_3 || '',
          'Image 4': product.image_url_4 || '',
          'Product ID / Style ID': product.style_id || product.sku,
          'SKU ID': product.sku,
          'Brand Name': product.brand || '',
          'Group ID': product.group_id || '',
          'Product Description': product.description || '',
          'EAN/UPC': product.ean_upc || '',
        };
      }
      
      if (format === 'amazon') {
        return {
          'item_name': product.name,
          'item_sku': product.sku,
          'external_product_id': product.ean_upc || '',
          'external_product_id_type': product.ean_upc ? 'EAN' : '',
          'brand_name': product.brand || '',
          'product_description': product.description || '',
          'standard_price': product.price,
          'list_price': product.mrp || product.price,
          'quantity': product.quantity,
          'color_name': product.color || '',
          'material_type': product.fabric || '',
          'pattern_type': product.pattern || '',
          'fit_type': product.fit_shape || '',
          'occasion_type': product.occasion || '',
          'sleeve_type': product.sleeve_length || '',
          'neck_style': product.neck_type || '',
          'item_weight': product.net_weight_grams ? `${product.net_weight_grams}g` : '',
          'item_weight_unit_of_measure': 'GR',
          'country_of_origin': product.country_of_origin || 'IN',
          'manufacturer': product.manufacturer_name || '',
          'main_image_url': product.image_url || '',
          'other_image_url1': product.image_url_2 || '',
          'other_image_url2': product.image_url_3 || '',
          'other_image_url3': product.image_url_4 || '',
          'product_type': product.generic_name || '',
          'size_name': 'Free Size',
          'fulfillment_channel': 'DEFAULT',
        };
      }
      
      if (format === 'flipkart') {
        return {
          'Product Name': product.name,
          'SKU ID': product.sku,
          'EAN': product.ean_upc || '',
          'Brand': product.brand || '',
          'Description': product.description || '',
          'Selling Price': product.price,
          'MRP': product.mrp || product.price,
          'Stock': product.quantity,
          'Color': product.color || '',
          'Fabric': product.fabric || '',
          'Pattern': product.pattern || '',
          'Fit': product.fit_shape || '',
          'Occasion': product.occasion || '',
          'Sleeve': product.sleeve_length || '',
          'Neck': product.neck_type || '',
          'Weight (g)': product.net_weight_grams || '',
          'Country of Origin': product.country_of_origin || 'India',
          'Manufacturer Details': product.manufacturer_name || '',
          'Main Image': product.image_url || '',
          'Image 2': product.image_url_2 || '',
          'Image 3': product.image_url_3 || '',
          'Image 4': product.image_url_4 || '',
          'Size': 'Free Size',
          'Ideal For': 'Men',
          'Type': product.generic_name || '',
        };
      }
      
      // Default/All format
      return {
        'SKU': product.sku,
        'Name': product.name,
        'Description': product.description || '',
        'Brand': product.brand || '',
        'Category': product.category || '',
        'Price': product.price,
        'MRP': product.mrp || product.price,
        'Cost': product.cost,
        'Stock': product.quantity,
        'Color': product.color || '',
        'Fabric': product.fabric || '',
        'Pattern': product.pattern || '',
        'Fit': product.fit_shape || '',
        'Occasion': product.occasion || '',
        'Sleeve Length': product.sleeve_length || '',
        'Neck Type': product.neck_type || '',
        'Image URL': product.image_url || '',
        'Country': product.country_of_origin || 'India',
        'Manufacturer': product.manufacturer_name || '',
        'EAN/UPC': product.ean_upc || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    
    const filenames: Record<string, string> = {
      meesho: 'meesho_products_export.xlsx',
      amazon: 'amazon_products_export.xlsx',
      flipkart: 'flipkart_products_export.xlsx',
      all: 'products_export.xlsx',
    };
    
    XLSX.writeFile(wb, filenames[format]);
    
    toast({
      title: 'Export Complete',
      description: `${products.length} products exported for ${format.charAt(0).toUpperCase() + format.slice(1)}`,
    });
  };

  const handleBulkImport = async (importedProducts: Record<string, unknown>[]) => {
    let successCount = 0;
    for (const product of importedProducts) {
      try {
        await onAddProduct(product as Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category'>);
        successCount++;
      } catch (error) {
        console.error('Failed to import product:', product.name, error);
      }
    }
    if (successCount > 0) {
      toast({
        title: 'Bulk Import Complete',
        description: `Successfully imported ${successCount} of ${importedProducts.length} products`,
      });
    }
    setImportDialogOpen(false);
  };

  const handleManageVariants = (product: Product) => {
    setVariantsProduct(product);
    setVariantsDialogOpen(true);
  };
  const getStockStatus = (quantity: number, threshold: number) => {
    if (quantity === 0) return { label: 'Out of Stock', class: 'badge-danger' };
    if (quantity <= threshold) return { label: 'Low Stock', class: 'badge-warning' };
    return { label: 'In Stock', class: 'badge-success' };
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your product inventory</p>
        </div>
        {canManageProducts && (
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setImportDialogOpen(true)}
              title="Bulk Import"
            >
              <Upload className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncAllStock()}
              disabled={isSyncing}
              title="Sync inventory to connected marketplaces"
            >
              <RefreshCw className={cn('w-4 h-4 sm:mr-2', isSyncing && 'animate-spin')} />
              <span className="hidden sm:inline">Sync Channels</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" title="Export Products">
                  <Download className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportToExcel('meesho')}>
                  Export for Meesho
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToExcel('amazon')}>
                  Export for Amazon
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportToExcel('flipkart')}>
                  Export for Flipkart
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportToExcel('all')}>
                  Export All (Generic)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setCategoryDialogOpen(true)}
            >
              <FolderPlus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Category</span>
            </Button>
            <Button size="sm" onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Product</span>
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 input-retail"
        />
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No products found</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const status = getStockStatus(product.quantity, product.low_stock_threshold);
            return (
              <div key={product.id} className="glass-card rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-lg">📦</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-bold text-primary">{formatCurrency(Number(product.price))}</span>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', status.class)}>
                        {product.quantity} units
                      </span>
                    </div>
                  </div>
                  {canManageProducts && (
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleManageVariants(product)} title="Manage Variants">
                        <Layers className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} title="Edit">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product)} className="text-destructive" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 font-semibold text-muted-foreground">Product</th>
                <th className="text-left p-4 font-semibold text-muted-foreground">SKU</th>
                <th className="text-left p-4 font-semibold text-muted-foreground">Category</th>
                <th className="text-right p-4 font-semibold text-muted-foreground">Price</th>
                <th className="text-right p-4 font-semibold text-muted-foreground">Stock</th>
                <th className="text-center p-4 font-semibold text-muted-foreground">Status</th>
                {canManageProducts && <th className="text-right p-4 font-semibold text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={canManageProducts ? 7 : 6} className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No products found</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const status = getStockStatus(product.quantity, product.low_stock_threshold);
                  return (
                    <tr key={product.id} className="border-b border-border/50 table-row-hover">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <span className="text-lg">📦</span>
                            )}
                          </div>
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm text-muted-foreground">{product.sku}</td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded-full bg-secondary text-sm">
                          {product.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-semibold">{formatCurrency(Number(product.price))}</td>
                      <td className="p-4 text-right font-mono">{product.quantity}</td>
                      <td className="p-4 text-center">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium border', status.class)}>
                          {status.label}
                        </span>
                      </td>
                      {canManageProducts && (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleManageVariants(product)} title="Manage Variants">
                              <Layers className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(product)} title="Edit Product">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(product)} className="text-destructive" title="Delete Product">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

       <MarketplaceProductDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
        product={editingProduct}
        categories={categories}
        onSave={handleSave}
      />

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Category Name</Label>
              <Input id="categoryName" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="input-retail" placeholder="Electronics" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryDesc">Description (optional)</Label>
              <Input id="categoryDesc" value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} className="input-retail" placeholder="Electronic devices" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddCategory}>Add Category</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BulkImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        categories={categories}
        onImport={handleBulkImport}
      />

      <ProductVariantsDialog
        open={variantsDialogOpen}
        onOpenChange={setVariantsDialogOpen}
        product={variantsProduct}
      />
    </div>
  );
}
