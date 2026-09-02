import { useState } from 'react';
import { Link2, Plus, Trash2, Check, X, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DropshipProvider {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  isActive: boolean;
  lastSync: string | null;
  productCount: number;
}

const providerTemplates = [
  { id: 'custom', name: 'Custom API', placeholder: 'https://api.yourprovider.com' },
  { id: 'aliexpress', name: 'AliExpress', placeholder: 'https://api.aliexpress.com' },
  { id: 'spocket', name: 'Spocket', placeholder: 'https://api.spocket.co' },
  { id: 'printful', name: 'Printful', placeholder: 'https://api.printful.com' },
  { id: 'oberlo', name: 'Oberlo', placeholder: 'https://api.oberlo.com' },
];

export function DropshippingSettings() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<DropshipProvider[]>(() => {
    const saved = localStorage.getItem('dropshipProviders');
    return saved ? JSON.parse(saved) : [];
  });
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [newProvider, setNewProvider] = useState({
    name: '',
    apiUrl: '',
    apiKey: '',
  });
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const saveProviders = (updated: DropshipProvider[]) => {
    setProviders(updated);
    localStorage.setItem('dropshipProviders', JSON.stringify(updated));
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = providerTemplates.find(t => t.id === templateId);
    if (template && templateId !== 'custom') {
      setNewProvider(prev => ({
        ...prev,
        name: template.name,
        apiUrl: template.placeholder,
      }));
    }
  };

  const handleAddProvider = () => {
    if (!newProvider.name || !newProvider.apiUrl || !newProvider.apiKey) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    const provider: DropshipProvider = {
      id: `provider_${Date.now()}`,
      ...newProvider,
      isActive: true,
      lastSync: null,
      productCount: 0,
    };

    saveProviders([...providers, provider]);
    setNewProvider({ name: '', apiUrl: '', apiKey: '' });
    setIsAdding(false);
    setSelectedTemplate('custom');

    toast({
      title: 'Provider Added',
      description: `${provider.name} has been connected successfully`,
    });
  };

  const handleRemoveProvider = (id: string) => {
    const updated = providers.filter(p => p.id !== id);
    saveProviders(updated);
    toast({
      title: 'Provider Removed',
      description: 'The dropshipping provider has been disconnected',
    });
  };

  const handleToggleActive = (id: string) => {
    const updated = providers.map(p =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    saveProviders(updated);
  };

  const handleSyncProducts = async (provider: DropshipProvider) => {
    setIsSyncing(provider.id);
    
    // Simulate API sync
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const updated = providers.map(p =>
      p.id === provider.id
        ? { ...p, lastSync: new Date().toISOString(), productCount: Math.floor(Math.random() * 100) + 10 }
        : p
    );
    saveProviders(updated);
    setIsSyncing(null);

    toast({
      title: 'Sync Complete',
      description: `Products from ${provider.name} have been synchronized`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Dropshipping API Integration</h3>
        <p className="text-sm text-muted-foreground">
          Connect third-party suppliers to auto-import products, pricing, and stock levels
        </p>
      </div>

      {/* Connected Providers */}
      {providers.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Connected Providers</h4>
          {providers.map(provider => (
            <Card key={provider.id} className={!provider.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Link2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{provider.name}</h4>
                        <Badge variant={provider.isActive ? 'default' : 'secondary'}>
                          {provider.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-[200px]">
                        {provider.apiUrl}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {provider.productCount} products
                        </span>
                        {provider.lastSync && (
                          <span>
                            Last sync: {new Date(provider.lastSync).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={provider.isActive}
                      onCheckedChange={() => handleToggleActive(provider.id)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncProducts(provider)}
                      disabled={isSyncing === provider.id || !provider.isActive}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${isSyncing === provider.id ? 'animate-spin' : ''}`} />
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveProvider(provider.id)}
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

      {/* Add New Provider */}
      {isAdding ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Dropshipping Provider</CardTitle>
            <CardDescription>Enter your API credentials to connect a supplier</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider Template</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider template" />
                </SelectTrigger>
                <SelectContent>
                  {providerTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="providerName">Provider Name</Label>
              <Input
                id="providerName"
                value={newProvider.name}
                onChange={(e) => setNewProvider(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Supplier"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiUrl">API Endpoint URL</Label>
              <Input
                id="apiUrl"
                value={newProvider.apiUrl}
                onChange={(e) => setNewProvider(prev => ({ ...prev, apiUrl: e.target.value }))}
                placeholder="https://api.supplier.com/v1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key / Token</Label>
              <Input
                id="apiKey"
                type="password"
                value={newProvider.apiKey}
                onChange={(e) => setNewProvider(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk_live_xxx..."
              />
              <p className="text-xs text-muted-foreground">
                Your API key is stored locally and used only for syncing products
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddProvider}>
                <Check className="w-4 h-4 mr-2" />
                Connect Provider
              </Button>
              <Button variant="outline" onClick={() => {
                setIsAdding(false);
                setNewProvider({ name: '', apiUrl: '', apiKey: '' });
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
          Add Dropshipping Provider
        </Button>
      )}

      {/* Info Section */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h4 className="font-medium text-sm mb-2">How it works</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Connect your dropshipping provider's API using their credentials</li>
          <li>• Products, pricing, and stock levels sync automatically</li>
          <li>• Imported products appear in both your POS and Webstore</li>
          <li>• Orders are automatically forwarded to the supplier</li>
        </ul>
      </div>
    </div>
  );
}
