import { Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceAssistantButtonProps {
  onClick: () => void;
  isActive?: boolean;
  isProcessing?: boolean;
}

export function VoiceAssistantButton({ onClick, isActive, isProcessing }: VoiceAssistantButtonProps) {
  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Pulsing rings when active */}
      {isActive && (
        <>
          <div className="absolute inset-0 w-14 h-14 rounded-full bg-primary/30 animate-ping" />
          <div className="absolute inset-0 w-14 h-14 rounded-full bg-primary/20 animate-pulse" />
        </>
      )}
      <Button
        onClick={onClick}
        size="icon"
        className={cn(
          "relative w-14 h-14 rounded-full shadow-lg transition-all hover:scale-105",
          isActive && "bg-primary ring-4 ring-primary/30",
          isProcessing && "animate-pulse"
        )}
      >
        {isProcessing ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}
