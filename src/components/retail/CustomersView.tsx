import { useState } from 'react';
import { Search, Plus, Edit, Users, Star, Mail, Phone } from 'lucide-react';
import { Customer } from '@/types/retail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CustomersViewProps {
  customers: Customer[];
  onAddCustomer: (customer: Omit<Customer, 'id' | 'loyalty_points' | 'total_spent' | 'created_at' | 'updated_at'>) => Promise<any>;
  onUpdateCustomer: (id: string, updates: Partial<Customer>) => Promise<boolean>;
}

export function CustomersView({ customers, onAddCustomer, onUpdateCustomer }: CustomersViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery)
  );

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a customer name.',
        variant: 'destructive',
      });
      return;
    }

    if (editingCustomer) {
      const success = await onUpdateCustomer(editingCustomer.id, {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
      });
      if (success) {
        toast({
          title: 'Customer Updated',
          description: `${formData.name} has been updated.`,
        });
      }
    } else {
      const result = await onAddCustomer({
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
      });
      if (result) {
        toast({
          title: 'Customer Added',
          description: `${formData.name} has been added.`,
        });
      }
    }

    setDialogOpen(false);
    setEditingCustomer(null);
    setFormData({ name: '', email: '', phone: '' });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Customers</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage customer loyalty program</p>
        </div>
        <Button
          onClick={() => {
            setEditingCustomer(null);
            setFormData({ name: '', email: '', phone: '' });
            setDialogOpen(true);
          }}
          className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 sm:pl-10 input-retail text-sm sm:text-base"
        />
      </div>

      {/* Customers Grid */}
      {filteredCustomers.length === 0 ? (
        <div className="glass-card rounded-xl p-8 sm:p-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm sm:text-base">No customers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="glass-card rounded-xl p-4 sm:p-6">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-base sm:text-lg flex-shrink-0">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base truncate">{customer.name}</h3>
                    <div className="flex items-center gap-1 text-xs sm:text-sm text-warning">
                      <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                      {customer.loyalty_points} points
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(customer)}
                  className="hover:bg-primary/10 hover:text-primary flex-shrink-0"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                {customer.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span>{customer.phone}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Total Spent</span>
                  <span className="font-semibold text-success">{formatCurrency(Number(customer.total_spent))}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Customer Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md bg-card border-border mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-retail text-sm sm:text-base"
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-retail text-sm sm:text-base"
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input-retail text-sm sm:text-base"
                placeholder="+1 555-1234"
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="w-full sm:w-auto order-1 sm:order-2">
                {editingCustomer ? 'Update' : 'Add'} Customer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
