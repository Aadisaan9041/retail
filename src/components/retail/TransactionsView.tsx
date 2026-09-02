import { useState } from 'react';
import { Search, Receipt, CreditCard, Banknote, ChevronDown, ChevronUp, Star, FileText } from 'lucide-react';
import { Transaction } from '@/types/retail';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InvoiceGenerator } from './InvoiceGenerator';
import { useCurrency } from '@/hooks/useCurrency';

interface TransactionsViewProps {
  transactions: Transaction[];
}

export function TransactionsView({ transactions }: TransactionsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { formatCurrency, isLoading: currencyLoading } = useCurrency();

  const filteredTransactions = transactions.filter(
    (t) =>
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.items.some((item) => item.product_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const formatDateTime = (date: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));

  return (
    <div className="space-y-4 sm:space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Transactions</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">View all sales transactions</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Receipt className="w-4 h-4" />
          <span>{filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
        <Input
          placeholder="Search by transaction ID or product..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 sm:pl-10 input-retail text-sm sm:text-base"
        />
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="glass-card rounded-xl p-8 sm:p-12 text-center text-muted-foreground">
            <Receipt className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm sm:text-base">No transactions found</p>
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <div key={transaction.id} className="glass-card rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === transaction.id ? null : transaction.id)}
                className="w-full p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-secondary/30 transition-colors"
              >
                {/* Left side - Icon and basic info */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <div
                    className={cn(
                      'p-2 sm:p-3 rounded-lg flex-shrink-0',
                      transaction.payment_method === 'card'
                        ? 'bg-primary/20 text-primary'
                        : 'bg-success/20 text-success'
                    )}
                  >
                    {transaction.payment_method === 'card' ? (
                      <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-semibold font-mono text-sm sm:text-base truncate">
                      {transaction.id.slice(0, 8)}...
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {transaction.items.length} item{transaction.items.length > 1 ? 's' : ''} •{' '}
                      {formatDateTime(transaction.created_at)}
                    </p>
                  </div>
                </div>
                
                {/* Right side - Points, total, expand button */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                  <div className="flex items-center gap-3">
                    {transaction.loyalty_points_earned > 0 && (
                      <span className="flex items-center gap-1 text-xs sm:text-sm text-warning">
                        <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                        +{transaction.loyalty_points_earned}
                      </span>
                    )}
                    <p className="text-lg sm:text-xl font-bold text-success">
                      {formatCurrency(Number(transaction.total))}
                    </p>
                  </div>
                  {expandedId === transaction.id ? (
                    <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
              </button>

              {expandedId === transaction.id && (
                <div className="border-t border-border p-3 sm:p-4 bg-secondary/20 animate-fade-in">
                  {/* Items list */}
                  <div className="space-y-2 mb-4">
                    {transaction.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs sm:text-sm">
                        <span className="truncate mr-2">
                          {item.product_name} x {item.quantity}
                        </span>
                        <span className="text-muted-foreground flex-shrink-0">
                          {formatCurrency(Number(item.total_price))}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Price breakdown */}
                  <div className="border-t border-border pt-3 space-y-1">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(Number(transaction.subtotal))}</span>
                    </div>
                    {Number(transaction.discount) > 0 && (
                      <div className="flex justify-between text-xs sm:text-sm text-success">
                        <span>Loyalty Discount</span>
                        <span>-{formatCurrency(Number(transaction.discount))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrency(Number(transaction.tax))}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-sm sm:text-base">
                      <span>Total</span>
                      <span className="text-success">{formatCurrency(Number(transaction.total))}</span>
                    </div>
                  </div>

                  {/* Invoice Generation */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Generate Invoice</span>
                    </div>
                    <InvoiceGenerator transaction={transaction} />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
