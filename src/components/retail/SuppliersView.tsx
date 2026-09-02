import { useState, useEffect } from 'react';
import { Plus, Search, Truck, Phone, Mail, MapPin, TrendingUp, Package, Edit2, ToggleLeft, ToggleRight, Trash2, Download, FileText, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Supplier, Product } from '@/types/retail';
import { BulkSupplierImportDialog } from './BulkSupplierImportDialog';
import { useCurrency } from '@/hooks/useCurrency';

export function SuppliersView() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '', contact_person: '', phone: '', email: '',
    address: '', gst_number: '', payment_terms: '30 days', notes: '',
  });
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const fetchData = async () => {
    setIsLoading(true);
    const [suppliersRes, productsRes, txRes] = await Promise.all([
      (supabase.from('suppliers' as any).select('*').order('name')) as any,
      (supabase.from('products').select('id, name, sku, price, quantity, supplier_id, image_url') as any),
      supabase.from('transaction_items').select('product_id, quantity, total_price, created_at').order('created_at', { ascending: false }).limit(500),
    ]);
    if (suppliersRes.data) setSuppliers(suppliersRes.data as Supplier[]);
    if (productsRes.data) setProducts(productsRes.data as Product[]);
    if (txRes.data) setTransactions(txRes.data);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getSupplierProducts = (supplierId: string) =>
    products.filter(p => p.supplier_id === supplierId);

  const getSupplierSalesData = (supplierId: string) => {
    const supplierProductIds = getSupplierProducts(supplierId).map(p => p.id);
    const supplierTxItems = transactions.filter(t => supplierProductIds.includes(t.product_id));
    const totalRevenue = supplierTxItems.reduce((sum: number, t: any) => sum + Number(t.total_price), 0);
    const totalUnitsSold = supplierTxItems.reduce((sum: number, t: any) => sum + t.quantity, 0);
    return { totalRevenue, totalUnitsSold, transactionCount: supplierTxItems.length };
  };

  const handleSave = async () => {
    try {
      if (editingSupplier) {
        const { error } = await (supabase.from('suppliers' as any).update(formData as any).eq('id', editingSupplier.id) as any);
        if (error) throw error;
        toast({ title: 'Supplier Updated' });
      } else {
        const { error } = await (supabase.from('suppliers' as any).insert(formData as any) as any);
        if (error) throw error;
        toast({ title: 'Supplier Added' });
      }
      setDialogOpen(false);
      setEditingSupplier(null);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (supplier: Supplier) => {
    const { error } = await (supabase.from('suppliers' as any).update({ is_active: !supplier.is_active } as any).eq('id', supplier.id) as any);
    if (!error) fetchData();
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Delete supplier "${supplier.name}"? Products linked to this supplier will be unlinked.`)) return;
    // Unlink products first
    await (supabase.from('products').update({ supplier_id: null } as any).eq('supplier_id', supplier.id) as any);
    const { error } = await (supabase.from('suppliers' as any).delete().eq('id', supplier.id) as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Supplier Deleted' });
      fetchData();
    }
  };

  const resetForm = () => setFormData({ name: '', contact_person: '', phone: '', email: '', address: '', gst_number: '', payment_terms: '30 days', notes: '' });

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name, contact_person: supplier.contact_person || '',
      phone: supplier.phone || '', email: supplier.email || '',
      address: supplier.address || '', gst_number: supplier.gst_number || '',
      payment_terms: supplier.payment_terms || '30 days', notes: supplier.notes || '',
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingSupplier(null);
    resetForm();
    setDialogOpen(true);
  };

  // Rank suppliers by sales velocity
  const supplierRankings = suppliers
    .map(s => ({ supplier: s, ...getSupplierSalesData(s.id), productCount: getSupplierProducts(s.id).length }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const filtered = supplierRankings.filter(s =>
    s.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.supplier.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ['Supplier', 'Contact Person', 'Phone', 'Email', 'GST', 'Status', 'Products', 'Units Sold', 'Revenue'];
    const rows = supplierRankings.map(item => [
      item.supplier.name,
      item.supplier.contact_person || '',
      item.supplier.phone || '',
      item.supplier.email || '',
      item.supplier.gst_number || '',
      item.supplier.is_active ? 'Active' : 'Inactive',
      item.productCount,
      item.totalUnitsSold,
      item.totalRevenue.toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `supplier-sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: 'CSV exported successfully' });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Supplier Sales Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

    let y = 40;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Supplier', 14, y);
    doc.text('Products', 90, y);
    doc.text('Units Sold', 115, y);
    doc.text('Revenue', 150, y);
    y += 8;
    doc.setFont('helvetica', 'normal');

    supplierRankings.forEach(item => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(item.supplier.name.slice(0, 40), 14, y);
      doc.text(String(item.productCount), 90, y);
      doc.text(String(item.totalUnitsSold), 115, y);
      doc.text(item.totalRevenue.toFixed(2), 150, y);
      y += 7;
    });

    doc.save(`supplier-sales-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: 'PDF exported successfully' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Supplier Management</h2>
          <p className="text-muted-foreground text-sm">Track suppliers and their product sales performance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={supplierRankings.length === 0}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={supplierRankings.length === 0}>
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkImportOpen(true)}>
            <Upload className="w-4 h-4 mr-1" /> Import CSV
          </Button>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" /> Add Supplier
          </Button>
        </div>
      </div>

      {/* Top Performing Suppliers */}
      {supplierRankings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {supplierRankings.slice(0, 3).map((item, idx) => (
            <Card key={item.supplier.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                    'bg-orange-500/20 text-orange-400'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{item.supplier.name}</p>
                    <p className="text-xs text-muted-foreground">{item.productCount} products</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Revenue</p>
                    <p className="font-medium">{formatCurrency(item.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Units Sold</p>
                    <p className="font-medium">{item.totalUnitsSold}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Supplier List */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading suppliers...</p>
        ) : filtered.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No suppliers found. Add your first supplier to start tracking.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card key={item.supplier.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{item.supplier.name}</h3>
                      <Badge variant={item.supplier.is_active ? 'default' : 'secondary'} className="text-xs">
                        {item.supplier.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
                      {item.supplier.contact_person && (
                        <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{item.supplier.contact_person}</span>
                      )}
                      {item.supplier.phone && (
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{item.supplier.phone}</span>
                      )}
                      {item.supplier.email && (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{item.supplier.email}</span>
                      )}
                    </div>
                    {item.supplier.gst_number && (
                      <p className="text-xs text-muted-foreground mt-1">GST: {item.supplier.gst_number}</p>
                    )}
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-1">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="font-bold text-primary">{formatCurrency(item.totalRevenue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Products</p>
                      <p className="font-medium">{item.productCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Units Sold</p>
                      <p className="font-medium">{item.totalUnitsSold}</p>
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(item.supplier)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => toggleActive(item.supplier)}>
                      {item.supplier.is_active ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(item.supplier)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Supplier's products */}
                {item.productCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Products from this supplier:</p>
                    <div className="flex flex-wrap gap-2">
                      {getSupplierProducts(item.supplier.id).slice(0, 5).map(p => (
                        <Badge key={p.id} variant="outline" className="text-xs">
                          {p.name} ({p.quantity} in stock)
                        </Badge>
                      ))}
                      {item.productCount > 5 && (
                        <Badge variant="secondary" className="text-xs">+{item.productCount - 5} more</Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-1">
              <div>
                <Label>Supplier Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Supplier name" />
              </div>
              <div>
                <Label>Contact Person</Label>
                <Input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} placeholder="Contact person" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Phone" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="Email" />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Full address" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>GST Number</Label>
                  <Input value={formData.gst_number} onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })} placeholder="GSTIN" />
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <Input value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} placeholder="e.g. 30 days" />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes" />
              </div>
              <Button onClick={handleSave} className="w-full" disabled={!formData.name.trim()}>
                {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <BulkSupplierImportDialog open={bulkImportOpen} onOpenChange={setBulkImportOpen} onImportComplete={fetchData} />
    </div>
  );
}
