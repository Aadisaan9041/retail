import { LucideIcon } from 'lucide-react';

interface SettingsTileProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  color?: 'primary' | 'accent' | 'success' | 'warning' | 'destructive';
}

export function SettingsTile({ title, description, icon: Icon, onClick, color = 'primary' }: SettingsTileProps) {
  const colorClasses = {
    primary: 'bg-primary/20 text-primary hover:shadow-[0_0_30px_hsl(var(--glow-primary))]',
    accent: 'bg-accent/20 text-accent hover:shadow-[0_0_30px_hsl(var(--glow-accent))]',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
    destructive: 'bg-destructive/20 text-destructive',
  };

  return (
    <button
      onClick={onClick}
      className="glass-card rounded-xl p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:border-primary/30 group w-full"
    >
      <div className={`p-3 rounded-lg w-fit mb-4 ${colorClasses[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
