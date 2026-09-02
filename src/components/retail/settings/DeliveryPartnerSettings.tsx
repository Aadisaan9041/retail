import { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, Check, X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  api_endpoint: string | null;
  api_key: string | null;
  service_areas: string[] | null;
  is_active: boolean;
  delivery_fee: number;
  min_order_value: number;
  estimated_delivery_time: string | null;
  created_at: string;
}

export function DeliveryPartnerSettings() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPartner, setNewPartner] = useState({
    name: '',
    phone: '',
    email: '',
    api_endpoint: '',
    api_key: '',
    service_areas: '',
    delivery_fee: 0,
    min_order_value: 0,
    estimated_delivery_time: '',
  });

  const fetchPartners = async () => {
    const { data, error } = await supabase
      .from('delivery_partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching delivery partners:', error);
      toast({
        title: 'Error',
        description: 'Failed to load delivery partners',
        variant: 'destructive',
      });
    } else {
      setPartners(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.phone) {
      toast({
        title: 'Missing Information',
        description: 'Name and phone number are required',
        variant: 'destructive',
      });
      return;
    }

    const partnerData = {
      name: newPartner.name,
      phone: newPartner.phone,
      email: newPartner.email || null,
      api_endpoint: newPartner.api_endpoint || null,
      api_key: newPartner.api_key || null,
      service_areas: newPartner.service_areas ? newPartner.service_areas.split(',').map(s => s.trim()) : null,
      delivery_fee: newPartner.delivery_fee,
      min_order_value: newPartner.min_order_value,
      estimated_delivery_time: newPartner.estimated_delivery_time || null,
      is_active: true,
    };

    const { error } = await supabase.from('delivery_partners').insert(partnerData);

    if (error) {
      console.error('Error adding delivery partner:', error);
      toast({
        title: 'Error',
        description: 'Failed to add delivery partner',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Partner Added',
        description: `${newPartner.name} has been added as a delivery partner`,
      });
      setNewPartner({
        name: '',
        phone: '',
        email: '',
        api_endpoint: '',
        api_key: '',
        service_areas: '',
        delivery_fee: 0,
        min_order_value: 0,
        estimated_delivery_time: '',
      });
      setIsAdding(false);
      fetchPartners();
    }
  };

  const handleRemovePartner = async (id: string, name: string) => {
    const { error } = await supabase.from('delivery_partners').delete().eq('id', id);

    if (error) {
      console.error('Error removing delivery partner:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove delivery partner',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Partner Removed',
        description: `${name} has been removed`,
      });
      fetchPartners();
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('delivery_partners')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      console.error('Error toggling partner status:', error);
    } else {
      fetchPartners();
    }
  };

  const { formatCurrency } = useCurrency();

  if (isLoading) {
    return <div className="text-center py-8">Loading delivery partners...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Delivery Partner Management</h3>
        <p className="text-sm text-muted-foreground">
          Add and manage delivery partners for your webstore orders
        </p>
      </div>

      {/* Connected Partners */}
      {partners.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Active Partners</h4>
          {partners.map(partner => (
            <Card key={partner.id} className={!partner.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{partner.name}</h4>
                        <Badge variant={partner.is_active ? 'default' : 'secondary'}>
                          {partner.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{partner.phone}</p>
                      {partner.email && (
                        <p className="text-xs text-muted-foreground">{partner.email}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Fee: {formatCurrency(partner.delivery_fee)}</span>
                        <span>Min Order: {formatCurrency(partner.min_order_value)}</span>
                        {partner.estimated_delivery_time && (
                          <span>ETA: {partner.estimated_delivery_time}</span>
                        )}
                      </div>
                      {partner.service_areas && partner.service_areas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {partner.service_areas.map((area, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={partner.is_active}
                      onCheckedChange={() => handleToggleActive(partner.id, partner.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemovePartner(partner.id, partner.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Partner */}
      {isAdding ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Delivery Partner</CardTitle>
            <CardDescription>Enter the partner's details to connect them to your webstore</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partnerName">Partner Name *</Label>
                <Input
                  id="partnerName"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Express Delivery Co."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partnerPhone">Phone Number *</Label>
                <Input
                  id="partnerPhone"
                  value={newPartner.phone}
                  onChange={(e) => setNewPartner(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1234567890"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partnerEmail">Email</Label>
              <Input
                id="partnerEmail"
                type="email"
                value={newPartner.email}
                onChange={(e) => setNewPartner(prev => ({ ...prev, email: e.target.value }))}
                placeholder="partner@delivery.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Delivery Fee</Label>
                <Input
                  id="deliveryFee"
                  type="number"
                  value={newPartner.delivery_fee}
                  onChange={(e) => setNewPartner(prev => ({ ...prev, delivery_fee: Number(e.target.value) }))}
                  placeholder="5.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minOrder">Minimum Order Value</Label>
                <Input
                  id="minOrder"
                  type="number"
                  value={newPartner.min_order_value}
                  onChange={(e) => setNewPartner(prev => ({ ...prev, min_order_value: Number(e.target.value) }))}
                  placeholder="20.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eta">Estimated Delivery Time</Label>
              <Input
                id="eta"
                value={newPartner.estimated_delivery_time}
                onChange={(e) => setNewPartner(prev => ({ ...prev, estimated_delivery_time: e.target.value }))}
                placeholder="30-45 minutes"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceAreas">Service Areas (comma-separated)</Label>
              <Input
                id="serviceAreas"
                value={newPartner.service_areas}
                onChange={(e) => setNewPartner(prev => ({ ...prev, service_areas: e.target.value }))}
                placeholder="Downtown, Midtown, Uptown"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiEndpoint">API Endpoint (Optional)</Label>
              <Input
                id="apiEndpoint"
                value={newPartner.api_endpoint}
                onChange={(e) => setNewPartner(prev => ({ ...prev, api_endpoint: e.target.value }))}
                placeholder="https://api.partner.com/v1"
              />
              <p className="text-xs text-muted-foreground">
                If the partner has an API, enter the endpoint to enable automatic order dispatch
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key (Optional)</Label>
              <Input
                id="apiKey"
                type="password"
                value={newPartner.api_key}
                onChange={(e) => setNewPartner(prev => ({ ...prev, api_key: e.target.value }))}
                placeholder="sk_xxx..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddPartner}>
                <Check className="w-4 h-4 mr-2" />
                Add Partner
              </Button>
              <Button variant="outline" onClick={() => {
                setIsAdding(false);
                setNewPartner({
                  name: '',
                  phone: '',
                  email: '',
                  api_endpoint: '',
                  api_key: '',
                  service_areas: '',
                  delivery_fee: 0,
                  min_order_value: 0,
                  estimated_delivery_time: '',
                });
              }}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Delivery Partner
        </Button>
      )}

      {/* Info Section */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium text-sm mb-2">How Delivery Partners Work</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Add delivery partners with their contact info and service details</li>
          <li>• Customers on the webstore will see available delivery options</li>
          <li>• Partners with API integration can receive orders automatically</li>
          <li>• Delivery fees are added to the customer's order total</li>
          <li>• Toggle partners on/off based on availability</li>
        </ul>
      </div>
    </div>
  );
}
