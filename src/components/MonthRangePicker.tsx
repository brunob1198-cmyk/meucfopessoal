import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, setMonth, setYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MonthRangePickerProps {
  startMonth: string;
  endMonth: string;
  onStartChange: (m: string) => void;
  onEndChange: (m: string) => void;
  onYearClick?: () => void;
}

const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

function MonthCalendar({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (m: string) => void;
  label: string;
}) {
  const [year, month] = value ? value.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const [viewYear, setViewYear] = useState(year || new Date().getFullYear());

  const handleMonthClick = (monthIdx: number) => {
    const newMonth = `${viewYear}-${String(monthIdx + 1).padStart(2, '0')}`;
    onChange(newMonth);
  };

  return (
    <div className="p-3">
      <div className="text-xs font-medium text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewYear(viewYear - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold">{viewYear}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewYear(viewYear + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MONTHS.map((m, idx) => {
          const isSelected = year === viewYear && month === idx + 1;
          return (
            <button
              key={m}
              onClick={() => handleMonthClick(idx)}
              className={cn(
                'px-2 py-1.5 text-xs rounded-md transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
              )}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthRangePicker({
  startMonth,
  endMonth,
  onStartChange,
  onEndChange,
  onYearClick,
}: MonthRangePickerProps) {
  const [open, setOpen] = useState(false);

  const formatMonth = (m: string) => {
    if (!m || m.length < 7) return '---';
    const [y, mo] = m.split('-').map(Number);
    if (!y || !mo) return '---';
    return format(new Date(y, mo - 1, 1), 'MMM/yy', { locale: ptBR });
  };

  const displayLabel = startMonth === endMonth
    ? formatMonth(startMonth)
    : `${formatMonth(startMonth)} a ${formatMonth(endMonth)}`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {onYearClick && (
        <Button variant="outline" size="sm" onClick={onYearClick} className="text-xs h-8">
          <Calendar className="h-3.5 w-3.5 mr-1" />
          Ano todo
        </Button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs h-8 min-w-[140px] justify-start">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            <span className="capitalize">{displayLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex divide-x divide-border">
            <MonthCalendar
              value={startMonth}
              onChange={(m) => {
                onStartChange(m);
                if (m > endMonth) {
                  onEndChange(m);
                }
              }}
              label="Início"
            />
            <MonthCalendar
              value={endMonth}
              onChange={(m) => {
                if (m < startMonth) {
                  onStartChange(m);
                }
                onEndChange(m);
              }}
              label="Fim"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
