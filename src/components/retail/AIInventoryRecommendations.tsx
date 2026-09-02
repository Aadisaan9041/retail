import { useState } from 'react';
import { 
  Sparkles, 
  Loader2, 
  AlertTriangle, 
  Package, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface UrgentReorder {
  productId: string;
  productName: string;
  currentStock: number;
  recommendedQuantity: number;
  reason: string;
  priority: 'critical' | 'high';
}

interface RecommendedReorder {
  productId: string;
  productName: string;
  currentStock: number;
  recommendedQuantity: number;
  reason: string;
  estimatedDaysUntilStockout?: number;
}

interface OptimizationSuggestion {
  type: 'slow_mover' | 'overstock' | 'pricing' | 'discontinue';
  productName: string;
  suggestion: string;
  potentialSavings?: string;
}

interface HealthSummary {
  overallScore: number;
  outOfStockCount: number;
  lowStockCount: number;
  healthyStockCount: number;
  overstockedCount: number;
  insights: string[];
}

interface Recommendations {
  urgentReorders: UrgentReorder[];
  recommendedReorders: RecommendedReorder[];
  optimizationSuggestions: OptimizationSuggestion[];
  healthSummary: HealthSummary;
}

export function AIInventoryRecommendations() {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const { toast } = useToast();

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-inventory-recommendations');

      if (error) throw error;

      if (data.error) {
        toast({
          title: 'Analysis Error',
          description: data.error,
          variant: 'destructive'
        });
        return;
      }

      setRecommendations(data);
    } catch (error) {
      console.error('AI recommendations error:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Unable to generate AI recommendations. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getOptimizationIcon = (type: OptimizationSuggestion['type']) => {
    switch (type) {
      case 'slow_mover': return <TrendingDown className="h-4 w-4 text-yellow-500" />;
      case 'overstock': return <Package className="h-4 w-4 text-blue-500" />;
      case 'pricing': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'discontinue': return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Inventory Recommendations
          </h2>
          <p className="text-muted-foreground">
            Intelligent analysis of your inventory based on sales trends
          </p>
        </div>
        <Button onClick={fetchRecommendations} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Recommendations
            </>
          )}
        </Button>
      </div>

      {!recommendations && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
            <p className="text-muted-foreground mb-4">
              Click "Generate Recommendations" to get AI-powered inventory insights
            </p>
          </CardContent>
        </Card>
      )}

      {recommendations && (
        <div className="grid gap-6">
          {/* Health Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Inventory Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-muted"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(recommendations.healthSummary.overallScore / 100) * 251.2} 251.2`}
                      className={getHealthColor(recommendations.healthSummary.overallScore)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn(
                      "text-2xl font-bold",
                      getHealthColor(recommendations.healthSummary.overallScore)
                    )}>
                      {recommendations.healthSummary.overallScore}
                    </span>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {recommendations.healthSummary.outOfStockCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Out of Stock</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">
                      {recommendations.healthSummary.lowStockCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Low Stock</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {recommendations.healthSummary.healthyStockCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Healthy</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">
                      {recommendations.healthSummary.overstockedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Overstocked</div>
                  </div>
                </div>
              </div>

              {recommendations.healthSummary.insights.length > 0 && (
                <div className="mt-4 space-y-2">
                  {recommendations.healthSummary.insights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Urgent Reorders */}
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Urgent Reorders
                </CardTitle>
                <CardDescription>Items requiring immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {recommendations.urgentReorders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      No urgent reorders needed
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recommendations.urgentReorders.map((item, i) => (
                        <div key={i} className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{item.productName}</h4>
                              <p className="text-xs text-muted-foreground">{item.reason}</p>
                            </div>
                            <Badge variant={item.priority === 'critical' ? 'destructive' : 'secondary'}>
                              {item.priority}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-sm">
                            <span>Current: <strong>{item.currentStock}</strong></span>
                            <span>→</span>
                            <span>Order: <strong className="text-primary">{item.recommendedQuantity}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recommended Reorders */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-500" />
                  Recommended Reorders
                </CardTitle>
                <CardDescription>Items to reorder soon</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {recommendations.recommendedReorders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      Stock levels are healthy
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recommendations.recommendedReorders.map((item, i) => (
                        <div key={i} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium">{item.productName}</h4>
                            {item.estimatedDaysUntilStockout && (
                              <Badge variant="outline">
                                ~{item.estimatedDaysUntilStockout} days left
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                          <div className="mt-2 flex items-center gap-4 text-sm">
                            <span>Current: <strong>{item.currentStock}</strong></span>
                            <span>→</span>
                            <span>Order: <strong className="text-primary">{item.recommendedQuantity}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Optimization Suggestions */}
          {recommendations.optimizationSuggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Optimization Suggestions
                </CardTitle>
                <CardDescription>Ways to improve inventory efficiency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3">
                  {recommendations.optimizationSuggestions.map((item, i) => (
                    <div key={i} className="p-3 border rounded-lg">
                      <div className="flex items-start gap-2">
                        {getOptimizationIcon(item.type)}
                        <div>
                          <h4 className="font-medium text-sm">{item.productName}</h4>
                          <p className="text-xs text-muted-foreground mt-1">{item.suggestion}</p>
                          {item.potentialSavings && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              Potential savings: {item.potentialSavings}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
