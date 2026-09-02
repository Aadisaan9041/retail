import { useEffect, useState } from 'react';
import { FileText, DollarSign, User, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

interface PriceOverrideLog {
  id: string;
  transaction_id: string | null;
  product_id: string | null;
  product_name: string;
  original_price: number;
  modified_price: number;
  user_id: string;
  user_name: string | null;
  reason: string | null;
  created_at: string;
}

export function PriceOverrideAudit() {
  const [logs, setLogs] = useState<PriceOverrideLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('price_override_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setLogs(data);
      }
      setIsLoading(false);
    };

    fetchLogs();
  }, []);

  const getPriceChange = (original: number, modified: number) => {
    const diff = modified - original;
    const percentage = ((diff / original) * 100).toFixed(1);
    return {
      diff,
      percentage,
      isIncrease: diff > 0,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="w-5 h-5" />
          Price Override Audit Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No price overrides recorded yet</p>
            <p className="text-sm">Overrides made during checkout will appear here</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const { diff, percentage, isIncrease } = getPriceChange(
                    Number(log.original_price),
                    Number(log.modified_price)
                  );
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[150px] truncate">
                        {log.product_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCurrency(Number(log.original_price))}
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {formatCurrency(Number(log.modified_price))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isIncrease ? 'default' : 'destructive'}
                          className="font-mono text-xs"
                        >
                          {isIncrease ? '+' : ''}{formatCurrency(diff)} ({percentage}%)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {log.user_name || 'Unknown'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {log.reason || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
