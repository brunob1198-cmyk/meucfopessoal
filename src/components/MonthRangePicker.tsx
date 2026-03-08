import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

interface MonthRangePickerProps {
  startMonth: string;
  endMonth: string;
  onStartChange: (m: string) => void;
  onEndChange: (m: string) => void;
  onYearClick?: () => void;
}

export function MonthRangePicker({
  startMonth,
  endMonth,
  onStartChange,
  onEndChange,
  onYearClick,
}: MonthRangePickerProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {onYearClick && (
        <Button variant="outline" size="sm" onClick={onYearClick} className="text-xs">
          <Calendar className="h-3.5 w-3.5 mr-1" />
          Ano todo
        </Button>
      )}
      <div className="flex items-center gap-1">
        <Input
          type="month"
          value={startMonth}
          onChange={(e) => onStartChange(e.target.value)}
          className="w-36 h-8 text-xs"
        />
        <span className="text-xs text-muted-foreground">a</span>
        <Input
          type="month"
          value={endMonth}
          onChange={(e) => onEndChange(e.target.value)}
          className="w-36 h-8 text-xs"
        />
      </div>
    </div>
  );
}
