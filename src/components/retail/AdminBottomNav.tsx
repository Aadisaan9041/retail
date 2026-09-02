import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Receipt, 
  Settings,
  MoreHorizontal
} from 'lucide-react';
import { ViewType } from '@/types/retail';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminBottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  cartItemCount?: number;
}

const primaryNavItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'transactions', label: 'Sales', icon: Receipt },
];

const moreNavItems: { id: ViewType; label: string }[] = [
  { id: 'orders', label: 'Order Management' },
  { id: 'customers', label: 'Customers' },
  { id: 'loyalty', label: 'Loyalty Program' },
  { id: 'loyalty-analytics', label: 'Loyalty Analytics' },
  { id: 'reorders', label: 'Reorders' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'ai-recommendations', label: 'AI Insights' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
];

export function AdminBottomNav({ currentView, onViewChange, cartItemCount = 0 }: AdminBottomNavProps) {
  const isMoreActive = moreNavItems.some(item => item.id === currentView);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-lg border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const showBadge = item.id === 'pos' && cartItemCount > 0;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors relative min-w-[60px]',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full" />
              )}
            </button>
          );
        })}
        
        {/* More Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors relative min-w-[60px]',
                isMoreActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">More</span>
              {isMoreActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            side="top" 
            className="w-56 mb-2 max-h-[60vh] overflow-y-auto"
          >
            {moreNavItems.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  'cursor-pointer',
                  currentView === item.id && 'bg-primary/10 text-primary'
                )}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
