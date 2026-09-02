import { Receipt, CreditCard, Banknote } from 'lucide-react';
import { Transaction } from '@/types/retail';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const { formatCurrency } = useCurrency();

  const formatTime = (date: string) =>
    new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));

  const PaymentIcon = ({ method }: { method: string }) => {
    switch (method) {
      case 'card':
        return <CreditCard className="w-4 h-4" />;
      case 'cash':
        return <Banknote className="w-4 h-4" />;
      default:
        return <Receipt className="w-4 h-4" />;
    }
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Recent Transactions</h2>
        <Receipt className="w-5 h-5 text-muted-foreground" />
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No transactions yet today</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 table-row-hover"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  transaction.payment_method === 'card' ? 'bg-primary/20 text-primary' : 'bg-success/20 text-success'
                )}>
                  <PaymentIcon method={transaction.payment_method} />
                </div>
                <div>
                  <p className="font-medium text-sm">{transaction.id.slice(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground">
                    {transaction.items.length} item{transaction.items.length > 1 ? 's' : ''} • {formatTime(transaction.created_at)}
                  </p>
                </div>
              </div>
              <p className="font-semibold text-success">{formatCurrency(Number(transaction.total))}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
