import { cn } from '@/lib/utils';

interface ReportTabsProps {
  mode: 'period' | 'monthly';
  onModeChange: (mode: 'period' | 'monthly') => void;
}

export function ReportTabs({ mode, onModeChange }: ReportTabsProps) {
  return (
    <div className="flex gap-2 border-b">
      <button
        onClick={() => onModeChange('monthly')}
        className={cn(
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
          mode === 'monthly'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        )}
      >
        Monthly
      </button>
      <button
        onClick={() => onModeChange('period')}
        className={cn(
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
          mode === 'period'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        )}
      >
        Period
      </button>
    </div>
  );
}
