import { useState } from 'react';
import { LayoutDashboard, ShoppingCart, Package, Receipt, BarChart3, Settings, LogOut, Users, RefreshCw, Menu, X, Crown, PieChart, ClipboardList, Sparkles } from 'lucide-react';
import { ViewType, UserProfile, AppRole } from '@/types/retail';
import { cn } from '@/lib/utils';
import { useStoreName } from '@/hooks/useStoreName';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface MobileSidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  profile: UserProfile | null;
  roles: AppRole[];
  onSignOut: () => void;
}

const navItems: { id: ViewType; label: string; icon: React.ElementType; requiresAdmin?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'orders', label: 'Order Management', icon: ClipboardList, requiresAdmin: true },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'loyalty', label: 'Loyalty Program', icon: Crown },
  { id: 'loyalty-analytics', label: 'Loyalty Analytics', icon: PieChart, requiresAdmin: true },
  { id: 'reorders', label: 'Reorders', icon: RefreshCw },
  { id: 'ai-recommendations', label: 'AI Insights', icon: Sparkles, requiresAdmin: true },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

export function MobileSidebar({ currentView, onViewChange, profile, roles, onSignOut }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const isAdmin = roles.includes('admin');
  const isManager = roles.includes('manager');
  const { storeName, tagline } = useStoreName();

  const handleNavClick = (view: ViewType) => {
    onViewChange(view);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden fixed top-4 left-4 z-50 bg-background/80 backdrop-blur-sm shadow-lg">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{storeName}</h1>
              <p className="text-xs text-muted-foreground">{tagline}</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        {profile && (
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground capitalize">{roles[0] || 'Staff'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation - Scrollable */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0">
          {navItems.map((item) => {
            if (item.requiresAdmin && !isAdmin && !isManager) return null;
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  'nav-item w-full',
                  isActive && 'nav-item-active'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border space-y-1 mt-auto">
          <button 
            onClick={() => handleNavClick('settings')}
            className={cn('nav-item w-full', currentView === 'settings' && 'nav-item-active')}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
          <button 
            onClick={() => {
              onSignOut();
              setOpen(false);
            }}
            className="nav-item w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
