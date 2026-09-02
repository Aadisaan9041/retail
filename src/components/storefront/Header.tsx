import { useState } from 'react';
import { ShoppingCart, Search, Menu, X, User, Store, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

interface HeaderProps {
  cartItemCount: number;
  onCartClick: () => void;
  onSearchChange: (query: string) => void;
  searchQuery: string;
  storeName?: string;
}

export function Header({
  cartItemCount,
  onCartClick,
  onSearchChange,
  searchQuery,
  storeName = 'My Store',
}: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="p-1.5 sm:p-2 rounded-lg bg-primary">
            <Store className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm sm:text-lg hidden xs:inline truncate max-w-[120px] sm:max-w-none">
            {storeName}
          </span>
        </Link>

        {/* Desktop Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 sm:h-10 sm:w-10"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            {searchOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Search className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>

          {/* Admin Link */}
          <Link to="/admin">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
              <User className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </Link>

          {/* Cart */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 sm:h-10 sm:w-10"
            onClick={onCartClick}
          >
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
            {cartItemCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-[10px] sm:text-xs"
                variant="destructive"
              >
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {searchOpen && (
        <div className="md:hidden border-t border-border p-3 sm:p-4 bg-background animate-slide-up">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-secondary border-border text-sm"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
