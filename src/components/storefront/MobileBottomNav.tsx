import { Home, Search, ShoppingCart, User, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';

interface MobileBottomNavProps {
  cartItemCount: number;
  onCartClick: () => void;
  onSearchClick?: () => void;
}

const navItems = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'search', label: 'Search', icon: Search, action: 'search' },
  { id: 'cart', label: 'Cart', icon: ShoppingCart, action: 'cart' },
  { id: 'track', label: 'Track', icon: Package, path: '/track-order' },
  { id: 'account', label: 'Account', icon: User, path: '/auth' },
];

export function MobileBottomNav({ cartItemCount, onCartClick, onSearchClick }: MobileBottomNavProps) {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.path ? location.pathname === item.path : false;
          
          // Handle action items (search, cart)
          if (item.action === 'cart') {
            return (
              <button
                key={item.id}
                onClick={onCartClick}
                className="flex flex-col items-center justify-center flex-1 h-full relative group"
              >
                <div className="relative">
                  <Icon className={cn(
                    'w-5 h-5 transition-colors',
                    'text-muted-foreground group-hover:text-primary'
                  )} />
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] mt-1 transition-colors',
                  'text-muted-foreground group-hover:text-primary'
                )}>
                  {item.label}
                </span>
              </button>
            );
          }
          
          if (item.action === 'search') {
            return (
              <button
                key={item.id}
                onClick={onSearchClick}
                className="flex flex-col items-center justify-center flex-1 h-full group"
              >
                <Icon className={cn(
                  'w-5 h-5 transition-colors',
                  'text-muted-foreground group-hover:text-primary'
                )} />
                <span className={cn(
                  'text-[10px] mt-1 transition-colors',
                  'text-muted-foreground group-hover:text-primary'
                )}>
                  {item.label}
                </span>
              </button>
            );
          }
          
          // Regular link items
          return (
            <Link
              key={item.id}
              to={item.path!}
              className="flex flex-col items-center justify-center flex-1 h-full group"
            >
              <Icon className={cn(
                'w-5 h-5 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
              )} />
              <span className={cn(
                'text-[10px] mt-1 transition-colors',
                isActive ? 'text-primary font-medium' : 'text-muted-foreground group-hover:text-primary'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
