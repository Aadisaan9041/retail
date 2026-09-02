import { useState } from 'react';
import { Search, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types/retail';

interface AISearchResult {
  products: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    quantity: number;
    image_url?: string;
    category: string;
  }>;
  interpretation: string;
  suggestions?: string;
}

interface AISearchAssistantProps {
  onProductSelect: (product: Product) => void;
  onClose?: () => void;
}

export function AISearchAssistant({ onProductSelect, onClose }: AISearchAssistantProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<AISearchResult | null>(null);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-product-search', {
        body: { query: query.trim() }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: 'Search Error',
          description: data.error,
          variant: 'destructive'
        });
        return;
      }

      setResults(data);

      if (data.products.length === 0) {
        toast({
          title: 'No Results',
          description: 'No products matched your search. Try different keywords.',
        });
      }
    } catch (error) {
      console.error('AI search error:', error);
      toast({
        title: 'Search Failed',
        description: 'Unable to perform AI search. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleProductClick = (product: AISearchResult['products'][0]) => {
    onProductSelect({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity: product.quantity,
      image_url: product.image_url,
      category: product.category,
      cost: 0,
      low_stock_threshold: 10,
      created_at: '',
      updated_at: ''
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          <Input
            type="text"
            placeholder="Ask me anything... e.g., 'something for a headache' or 'gifts under $50'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10 pr-4"
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {results && (
        <div className="space-y-4">
          {/* AI Interpretation */}
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-foreground">{results.interpretation}</p>
                {results.suggestions && (
                  <p className="text-xs text-muted-foreground mt-1">{results.suggestions}</p>
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          {results.products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.products.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleProductClick(product)}
                >
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                          <Search className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{product.name}</h4>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {product.category}
                        </Badge>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-bold text-primary">
                            ₹{product.price.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {product.quantity} in stock
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!results && !isSearching && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            Use natural language to find products.<br />
            Try: "birthday gift for mom" or "healthy snacks under $20"
          </p>
        </div>
      )}
    </div>
  );
}
