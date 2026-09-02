import { Crown, Star, Award, Gift } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LoyaltyTier {
  id: string;
  name: string;
  min_points: number;
  discount_percentage: number;
  benefits: string[] | null;
  color: string | null;
}

interface LoyaltyTierBadgeProps {
  tier: LoyaltyTier;
  points?: number;
  showBenefits?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const tierIcons: Record<string, typeof Crown> = {
  Bronze: Award,
  Silver: Star,
  Gold: Crown,
  Platinum: Gift,
};

export function LoyaltyTierBadge({ tier, points, showBenefits = false, size = 'md' }: LoyaltyTierBadgeProps) {
  const Icon = tierIcons[tier.name] || Star;
  const tierColor = tier.color || '#667eea';
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div className="space-y-2">
      <Badge
        className={cn(
          'inline-flex items-center gap-1.5 font-semibold border-0',
          sizeClasses[size]
        )}
        style={{ 
          backgroundColor: `${tierColor}20`,
          color: tierColor,
        }}
      >
        <Icon className={iconSizes[size]} />
        {tier.name} Member
      </Badge>
      
      {points !== undefined && (
        <p className="text-xs text-muted-foreground">
          {points.toLocaleString()} loyalty points
        </p>
      )}

      {showBenefits && tier.benefits && tier.benefits.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Your benefits:</p>
          <ul className="text-xs space-y-0.5">
            {tier.benefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-1.5">
                <span 
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: tierColor }}
                />
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {tier.discount_percentage > 0 && (
        <p 
          className="text-xs font-medium"
          style={{ color: tierColor }}
        >
          {tier.discount_percentage}% discount on all orders!
        </p>
      )}
    </div>
  );
}
