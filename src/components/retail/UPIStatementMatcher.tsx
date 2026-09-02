import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Check, X, AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import * as XLSX from 'xlsx';

interface ParsedTransaction {
  date: string;
  utrNumber: string;
  amount: number;
  payerVpa: string;
  description: string;
  matched: boolean;
  matchedVerificationId?: string;
}

export function UPIStatementMatcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchResults, setMatchResults] = useState<{
    matched: number;
    unmatched: number;
    autoVerified: number;
  } | null>(null);
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      // Try to parse transactions from common UPI statement formats
      const transactions: ParsedTransaction[] = [];

      for (const row of rows) {
        // Common column name patterns for UPI statements
        const utr = findValue(row, ['utr', 'utr_number', 'utr no', 'transaction id', 'txn id', 'ref no', 'reference', 'rrn']);
        const amount = findNumericValue(row, ['amount', 'credit', 'received', 'cr', 'txn amount']);
        const payer = findValue(row, ['payer', 'payer vpa', 'from', 'sender', 'remitter']);
        const date = findValue(row, ['date', 'txn date', 'transaction date', 'created']);
        const desc = findValue(row, ['description', 'remarks', 'narration', 'note']);

        if (utr && amount > 0) {
          transactions.push({
            date: date || '',
            utrNumber: utr,
            amount,
            payerVpa: payer || '',
            description: desc || '',
            matched: false,
          });
        }
      }

      if (transactions.length === 0) {
        toast({
          title: 'No Transactions Found',
          description: 'Could not parse UPI transactions from the file. Make sure the file has columns like UTR, Amount, etc.',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      // Now match against pending verifications
      const { data: pendingVerifications } = await supabase
        .from('upi_payment_verifications')
        .select('*')
        .eq('status', 'pending');

      let matched = 0;
      let autoVerified = 0;

      for (const txn of transactions) {
        // Match by UTR number
        const utrMatch = pendingVerifications?.find(
          (v) => v.utr_number && v.utr_number.toLowerCase() === txn.utrNumber.toLowerCase()
        );

        if (utrMatch) {
          txn.matched = true;
          txn.matchedVerificationId = utrMatch.id;
          matched++;
          continue;
        }

        // Match by amount (fuzzy — same amount within ±0.01)
        const amountMatches = pendingVerifications?.filter(
          (v) => Math.abs(v.amount - txn.amount) < 0.02
        );

        if (amountMatches && amountMatches.length === 1) {
          txn.matched = true;
          txn.matchedVerificationId = amountMatches[0].id;
          matched++;
        }
      }

      setParsedTransactions(transactions);
      setMatchResults({
        matched,
        unmatched: transactions.length - matched,
        autoVerified,
      });

      setIsProcessing(false);
    } catch (err) {
      console.error('Error parsing file:', err);
      toast({
        title: 'File Error',
        description: 'Failed to parse the uploaded file.',
        variant: 'destructive',
      });
      setIsProcessing(false);
    }

    // Reset file input
    e.target.value = '';
  }, [toast]);

  const handleAutoVerifyMatched = async () => {
    const matchedTxns = parsedTransactions.filter((t) => t.matched && t.matchedVerificationId);
    if (matchedTxns.length === 0) return;

    setIsProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    let verified = 0;

    for (const txn of matchedTxns) {
      const { error } = await supabase
        .from('upi_payment_verifications')
        .update({
          status: 'verified',
          verified_by: user?.id || null,
          verified_at: new Date().toISOString(),
          utr_number: txn.utrNumber,
          payer_vpa: txn.payerVpa || null,
        })
        .eq('id', txn.matchedVerificationId!);

      if (!error) {
        verified++;
        // Also update linked order
        const { data: verification } = await supabase
          .from('upi_payment_verifications')
          .select('order_id')
          .eq('id', txn.matchedVerificationId!)
          .single();

        if (verification?.order_id) {
          await supabase
            .from('orders')
            .update({ status: 'confirmed' })
            .eq('id', verification.order_id);
        }
      }
    }

    setMatchResults((prev) => prev ? { ...prev, autoVerified: verified } : null);
    setIsProcessing(false);
    toast({
      title: `${verified} Payment(s) Verified`,
      description: 'Matched UPI payments have been auto-verified from your statement.',
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <FileSpreadsheet className="w-4 h-4 mr-1" />
        Upload UPI Statement
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Match UPI Statement with Pending Payments
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-dashed border-border bg-secondary/30 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                Upload your UPI transaction statement (CSV/Excel) from your banking or UPI business app
              </p>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="max-w-xs mx-auto"
                disabled={isProcessing}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supported: PhonePe Business, GPay Business, Paytm Business, Bank statements
              </p>
            </div>

            {matchResults && (
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-lg bg-success/10 border border-success/30 text-center">
                  <p className="text-2xl font-bold text-success">{matchResults.matched}</p>
                  <p className="text-xs text-muted-foreground">Matched</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-warning/10 border border-warning/30 text-center">
                  <p className="text-2xl font-bold text-warning">{matchResults.unmatched}</p>
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
                  <p className="text-2xl font-bold text-primary">{matchResults.autoVerified}</p>
                  <p className="text-xs text-muted-foreground">Auto-Verified</p>
                </div>
              </div>
            )}

            {parsedTransactions.length > 0 && (
              <>
                <div className="rounded-lg border border-border overflow-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>UTR</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payer</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedTransactions.map((txn, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{txn.utrNumber}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(txn.amount)}</TableCell>
                          <TableCell className="text-sm">{txn.payerVpa || '-'}</TableCell>
                          <TableCell>
                            {txn.matched ? (
                              <Badge variant="outline" className="text-success border-success/30">
                                <Check className="w-3 h-3 mr-1" /> Matched
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                <AlertCircle className="w-3 h-3 mr-1" /> No Match
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {matchResults && matchResults.matched > 0 && matchResults.autoVerified === 0 && (
                  <Button
                    onClick={handleAutoVerifyMatched}
                    disabled={isProcessing}
                    className="w-full bg-success hover:bg-success/90"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Auto-Verify {matchResults.matched} Matched Payment(s)
                  </Button>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsOpen(false);
              setParsedTransactions([]);
              setMatchResults(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper: find a value in a row by trying multiple column name patterns
function findValue(row: Record<string, unknown>, patterns: string[]): string {
  for (const key of Object.keys(row)) {
    const lowerKey = key.toLowerCase().trim();
    for (const pattern of patterns) {
      if (lowerKey === pattern || lowerKey.includes(pattern)) {
        const val = row[key];
        return val != null ? String(val).trim() : '';
      }
    }
  }
  return '';
}

function findNumericValue(row: Record<string, unknown>, patterns: string[]): number {
  const str = findValue(row, patterns);
  if (!str) return 0;
  const num = parseFloat(str.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}
