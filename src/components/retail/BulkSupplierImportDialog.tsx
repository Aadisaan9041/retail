import { useState, useRef } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BulkSupplierImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ParsedSupplier {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  gst_number: string;
  payment_terms: string;
  notes: string;
  valid: boolean;
  error?: string;
}

const REQUIRED_HEADERS = ['name'];
const ALL_HEADERS = ['name', 'contact_person', 'phone', 'email', 'address', 'gst_number', 'payment_terms', 'notes'];

export function BulkSupplierImportDialog({ open, onOpenChange, onImportComplete }: BulkSupplierImportDialogProps) {
  const [parsed, setParsed] = useState<ParsedSupplier[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const csv = ALL_HEADERS.join(',') + '\n' + 'Example Supplier,John Doe,9876543210,john@example.com,"123 Main St",22AAAAA0000A1Z5,30 days,Notes here\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(current.trim());
          current = '';
        } else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && text[i + 1] === '\n') i++;
          row.push(current.trim());
          if (row.some(c => c)) rows.push(row);
          row = [];
          current = '';
        } else {
          current += ch;
        }
      }
    }
    row.push(current.trim());
    if (row.some(c => c)) rows.push(row);
    return rows;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast({ title: 'Invalid CSV', description: 'File must have a header row and at least one data row', variant: 'destructive' });
        return;
      }

      const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));
      const nameIdx = headers.indexOf('name');
      if (nameIdx === -1) {
        toast({ title: 'Missing "name" column', description: 'CSV must have a "name" header', variant: 'destructive' });
        return;
      }

      const suppliers: ParsedSupplier[] = rows.slice(1).map(row => {
        const get = (key: string) => {
          const idx = headers.indexOf(key);
          return idx >= 0 && idx < row.length ? row[idx] : '';
        };
        const name = get('name');
        const valid = name.length > 0 && name.length <= 200;
        return {
          name,
          contact_person: get('contact_person').slice(0, 200),
          phone: get('phone').slice(0, 20),
          email: get('email').slice(0, 255),
          address: get('address').slice(0, 500),
          gst_number: get('gst_number').slice(0, 20),
          payment_terms: get('payment_terms').slice(0, 50) || '30 days',
          notes: get('notes').slice(0, 500),
          valid,
          error: !valid ? (name.length === 0 ? 'Name is required' : 'Name too long') : undefined,
        };
      });

      setParsed(suppliers);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    const validSuppliers = parsed.filter(s => s.valid);
    if (validSuppliers.length === 0) return;

    setImporting(true);
    let success = 0;
    let failed = 0;

    // Batch insert
    const toInsert = validSuppliers.map(({ valid, error, ...rest }) => rest);
    const { error } = await (supabase.from('suppliers' as any).insert(toInsert as any) as any);

    if (error) {
      // Fallback: insert one by one
      for (const s of toInsert) {
        const { error: err } = await (supabase.from('suppliers' as any).insert(s as any) as any);
        if (err) failed++;
        else success++;
      }
    } else {
      success = toInsert.length;
    }

    setImporting(false);
    setImportResult({ success, failed });
    toast({ title: `Imported ${success} suppliers`, description: failed > 0 ? `${failed} failed` : undefined });
    if (success > 0) onImportComplete();
  };

  const validCount = parsed.filter(s => s.valid).length;
  const invalidCount = parsed.filter(s => !s.valid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) { setParsed([]); setImportResult(null); } } }}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>Bulk Import Suppliers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-1" /> Download Template
            </Button>
          </div>

          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">Upload a CSV file with supplier data</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Choose CSV File
            </Button>
          </div>

          {parsed.length > 0 && (
            <>
              <div className="flex gap-2 items-center">
                <Badge variant="default" className="text-xs">{validCount} valid</Badge>
                {invalidCount > 0 && <Badge variant="destructive" className="text-xs">{invalidCount} invalid</Badge>}
              </div>

              <ScrollArea className="max-h-[200px] border border-border rounded-md">
                <div className="p-2 space-y-1">
                  {parsed.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50">
                      {s.valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                      )}
                      <span className="truncate flex-1">{s.name || '(empty)'}</span>
                      {s.contact_person && <span className="text-muted-foreground text-xs truncate">{s.contact_person}</span>}
                      {s.error && <span className="text-destructive text-xs">{s.error}</span>}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {importResult ? (
                <p className="text-sm text-muted-foreground">
                  ✅ {importResult.success} imported{importResult.failed > 0 ? `, ❌ ${importResult.failed} failed` : ''}
                </p>
              ) : (
                <Button onClick={handleImport} disabled={validCount === 0 || importing} className="w-full">
                  {importing ? 'Importing...' : `Import ${validCount} Suppliers`}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
