import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Save, ShieldCheck, Store, Trash2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Props { onBack: () => void; }
type Provider = 'razorpay' | 'payu' | 'meesho' | 'flipkart' | 'amazon' | 'shipping';

const PROVIDERS: { id: Provider; name: string; description: string; fields: { key: string; label: string; secret?: boolean; placeholder?: string }[] }[] = [
  { id:'razorpay', name:'Razorpay', description:'Online payments for your website checkout.', fields:[
    { key:'keyId', label:'Key ID', placeholder:'rzp_test_…' }, { key:'keySecret', label:'Key Secret', secret:true, placeholder:'••••••••••••' }
  ]},
  { id:'payu', name:'PayU', description:'PayU merchant credentials.', fields:[
    { key:'merchantKey', label:'Merchant Key' }, { key:'merchantSalt', label:'Merchant Salt', secret:true }
  ]},
  { id:'meesho', name:'Meesho', description:'Seller account credentials for marketplace integration.', fields:[
    { key:'apiKey', label:'API / Integration Key', secret:true }, { key:'sellerId', label:'Seller ID' }
  ]},
  { id:'flipkart', name:'Flipkart', description:'Seller API credentials.', fields:[
    { key:'applicationId', label:'Application ID' }, { key:'applicationSecret', label:'Application Secret', secret:true }
  ]},
  { id:'amazon', name:'Amazon', description:'Amazon Selling Partner API connection.', fields:[
    { key:'refreshToken', label:'LWA Refresh Token', secret:true }, { key:'clientId', label:'LWA Client ID' }, { key:'clientSecret', label:'LWA Client Secret', secret:true }, { key:'sellerId', label:'Seller ID' }
  ]},
  { id:'shipping', name:'Shipping Provider', description:'Connect your website shipping/courier provider.', fields:[
    { key:'providerName', label:'Provider Name', placeholder:'e.g. Shiprocket' }, { key:'apiKey', label:'API Key', secret:true }, { key:'apiSecret', label:'API Secret / Token', secret:true }, { key:'pickupPincode', label:'Pickup Pincode' }
  ]},
];

export function IntegrationSettings({ onBack }: Props) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<Provider>('razorpay');
  const [environment, setEnvironment] = useState<'test'|'live'>('test');
  const [values, setValues] = useState<Record<string,string>>({});
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState<Record<string,boolean>>({});
  const selected = useMemo(() => PROVIDERS.find(p => p.id === provider)!, [provider]);

  const invoke = async (body: any) => {
    const { data, error } = await supabase.functions.invoke('integration-credentials', { body });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Integration request failed');
    return data;
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await invoke({ action:'status', provider, environment });
      setConfigured(!!data.configured); setStatus(data.credential || null);
      setValues({}); setShow({});
    } catch (e:any) {
      toast({ title:'Could not load integration', description:e.message || 'Please check your admin session.', variant:'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [provider, environment]);

  const save = async () => {
    const requiredMissing = selected.fields.filter(f => !values[f.key]?.trim() && !(configured && f.secret));
    if (requiredMissing.length) { toast({ title:'Missing credentials', description:`Enter ${requiredMissing.map(f=>f.label).join(', ')}.`, variant:'destructive' }); return; }
    setSaving(true);
    try {
      await invoke({ action:'save', provider, environment, credentials:values, metadata:{ label:selected.name, account:values.sellerId || values.keyId || values.merchantKey || '' } });
      toast({ title:'Credentials saved', description:`${selected.name} is securely configured for ${environment} mode.` });
      await load();
    } catch (e:any) { toast({ title:'Save failed', description:e.message || 'Unable to save credentials.', variant:'destructive' }); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setLoading(true);
    try {
      const data = await invoke({ action:'test', provider, environment });
      toast({ title:'Connection successful', description:data.message });
      await load();
    } catch (e:any) { toast({ title:'Connection failed', description:e.message || 'Credential test failed.', variant:'destructive' }); await load(); }
    finally { setLoading(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${selected.name} ${environment} credentials?`)) return;
    setLoading(true);
    try { await invoke({ action:'delete', provider, environment }); toast({ title:'Disconnected', description:`${selected.name} credentials removed.` }); await load(); }
    catch (e:any) { toast({ title:'Disconnect failed', description:e.message, variant:'destructive' }); }
    finally { setLoading(false); }
  };

  return <div className="space-y-6 animate-slide-up">
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
      <div><h1 className="text-2xl font-bold">Integrations & API Credentials</h1><p className="text-sm text-muted-foreground">Connect payments and marketplaces without editing source code.</p></div>
    </div>

    <div className="glass-card rounded-xl p-4 flex gap-3 items-start border-primary/20">
      <ShieldCheck className="w-5 h-5 text-success mt-0.5" />
      <div className="text-sm"><p className="font-medium">Credentials are handled server-side</p><p className="text-muted-foreground">Secrets are encrypted before storage and are never returned to the browser after saving. Use Test mode first.</p></div>
    </div>

    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <div className="glass-card rounded-xl p-3 space-y-2">
        {PROVIDERS.map(p => <button key={p.id} onClick={()=>setProvider(p.id)} className={`w-full text-left rounded-lg p-4 transition-colors ${provider===p.id?'bg-primary/15 border border-primary/30':'hover:bg-secondary/60'}`}><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10 text-primary">{p.id==='razorpay'||p.id==='payu'?<CreditCard className="w-5 h-5"/>:<Store className="w-5 h-5"/>}</div><div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.id==='razorpay'||p.id==='payu'?'Payments':'Marketplace'}</p></div></div></button>)}
      </div>

      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div><h2 className="text-xl font-semibold">{selected.name}</h2><p className="text-sm text-muted-foreground mt-1">{selected.description}</p></div>
          <Badge variant="outline" className={configured ? 'badge-success':'badge-danger'}>{configured?<><CheckCircle2 className="w-3 h-3 mr-1"/>Connected</>: 'Not Connected'}</Badge>
        </div>

        <div className="max-w-xs space-y-2"><Label>Environment</Label><Select value={environment} onValueChange={(v:'test'|'live')=>setEnvironment(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="test">Test / Sandbox</SelectItem><SelectItem value="live">Live / Production</SelectItem></SelectContent></Select></div>

        {configured && <div className="rounded-lg bg-secondary/60 p-4 text-sm"><p className="font-medium">Saved securely</p><p className="text-muted-foreground">{status?.metadata?.account ? `Account: ${status.metadata.account}` : 'Credentials are configured.'}</p>{status?.last_tested_at && <p className="text-muted-foreground mt-1">Last test: {new Date(status.last_tested_at).toLocaleString()} — {status.last_test_status || 'unknown'}</p>}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          {selected.fields.map(field => <div key={field.key} className="space-y-2"><Label>{field.label}</Label><div className="relative"><Input type={field.secret && !show[field.key]?'password':'text'} value={values[field.key]||''} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))} placeholder={configured && field.secret?'Leave blank to keep the saved secret':field.placeholder}/>{field.secret && <button type="button" onClick={()=>setShow(s=>({...s,[field.key]:!s[field.key]}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{show[field.key]?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>}</div></div>)}
        </div>

        {provider==='amazon' && <div className="text-sm text-muted-foreground rounded-lg bg-secondary/50 p-4"><KeyRound className="w-4 h-4 inline mr-2"/>Amazon is intended to use seller authorization/OAuth credentials rather than a generic API-key field.</div>}

        <div className="flex flex-wrap gap-3"><Button onClick={save} disabled={saving||loading}><Save className="w-4 h-4 mr-2"/>{saving?'Saving…':'Save Securely'}</Button><Button variant="outline" onClick={test} disabled={!configured||loading}><CheckCircle2 className="w-4 h-4 mr-2"/>{loading?'Testing…':'Test Connection'}</Button>{configured&&<Button variant="destructive" onClick={remove} disabled={loading}><Trash2 className="w-4 h-4 mr-2"/>Disconnect</Button>}</div>
        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin"/>Working securely…</div>}
      </div>
    </div>
  </div>;
}
