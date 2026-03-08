import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ImageDown, Filter } from 'lucide-react';
import { exportChartAsPNG } from '@/lib/exportChart';
import { formatBRL } from '@/lib/dre';
import { Category, useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';

/* 3D stacked bar shape */
const Bar3DShape = (color: string) => (props: any) => {
  const { x, y, width, height } = props;
  if (!height || height <= 0) return null;
  const depth = Math.min(width * 0.35, 14);
  const topColor = color;
  // lighter shade for top face
  const sideColor = color.replace(/[\d.]+\)$/, (m: string) => `${Math.max(0, parseFloat(m) - 15)}%)`);
  const topFaceColor = color.replace(/[\d.]+\)$/, (m: string) => `${Math.min(100, parseFloat(m) + 12)}%)`);
  return (
    <g>
      {/* front face */}
      <rect x={x} y={y} width={width} height={height} fill={topColor} />
      {/* top face */}
      <polygon
        points={`${x},${y} ${x + depth},${y - depth} ${x + width + depth},${y - depth} ${x + width},${y}`}
        fill={topFaceColor}
      />
      {/* right side face */}
      <polygon
        points={`${x + width},${y} ${x + width + depth},${y - depth} ${x + width + depth},${y + height - depth} ${x + width},${y + height}`}
        fill={sideColor}
      />
    </g>
  );
};

const COLORS = [
  'hsl(220, 70%, 45%)', 'hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)',
  'hsl(38, 92%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(180, 60%, 40%)',
  'hsl(330, 60%, 50%)', 'hsl(60, 70%, 45%)', 'hsl(200, 70%, 50%)',
  'hsl(10, 80%, 55%)', 'hsl(120, 50%, 40%)', 'hsl(300, 50%, 45%)',
];

type ViewOption = {
  label: string;
  dreTypes: string[];
  parentFilter?: string;
};

const VIEW_OPTIONS: ViewOption[] = [
  { label: 'Visão Geral (Clusters)', dreTypes: ['receita', 'desconto', 'custo', 'despesa', 'investimento', 'depreciacao', 'resultado_financeiro', 'outras_receitas', 'impostos'] },
  { label: 'Renda Familiar', dreTypes: ['receita'] },
  { label: 'Somente Despesas', dreTypes: ['despesa'] },
  { label: 'Habitação', dreTypes: ['despesa'], parentFilter: 'HABITAÇÃO' },
  { label: 'Saúde', dreTypes: ['despesa'], parentFilter: 'SAÚDE' },
  { label: 'Automóvel', dreTypes: ['despesa'], parentFilter: 'AUTOMÓVEL' },
  { label: 'Despesas Pessoais', dreTypes: ['despesa'], parentFilter: 'DESPESAS PESSOAIS' },
  { label: 'Restaurante', dreTypes: ['despesa'], parentFilter: 'RESTAURANTE' },
  { label: 'Lazer', dreTypes: ['despesa'], parentFilter: 'LAZER' },
  { label: 'Estudos', dreTypes: ['despesa'], parentFilter: 'ESTUDOS' },
  { label: 'Investimentos', dreTypes: ['investimento'] },
  { label: 'Custos', dreTypes: ['custo'] },
  { label: 'Descontos', dreTypes: ['desconto'] },
];

function generateYearRange(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 15; y--) years.push(y);
  return years;
}

const ALL_YEARS = generateYearRange();

export function YearlyEvolution() {
  const currentYear = new Date().getFullYear();
  const [viewIndex, setViewIndex] = useState(0);
  const [startYear, setStartYear] = useState(currentYear - 4);
  const [endYear, setEndYear] = useState(currentYear);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set()); // empty = all
  const chartRef = useRef<HTMLDivElement>(null);
  const view = VIEW_OPTIONS[viewIndex];

  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-12-31`;
  const { data: transactions } = useTransactions(startDate, endDate);
  const { data: categories } = useCategories();

  const years = useMemo(() => {
    const result: number[] = [];
    for (let y = endYear; y >= startYear; y--) result.push(y);
    return result;
  }, [startYear, endYear]);

  // All rows (unfiltered by category selection)
  const allRows = useMemo(() => {
    if (!categories || categories.length === 0) return [];

    if (view.parentFilter) {
      const parent = categories.find(c => !c.parent_id && c.name.toUpperCase() === view.parentFilter!.toUpperCase());
      if (!parent) return [];
      const children = categories.filter(c => c.parent_id === parent.id);
      return children.map(child => {
        const yearTotals: Record<string, number> = {};
        years.forEach(y => {
          yearTotals[String(y)] = (transactions || [])
            .filter((t: any) => t.category_id === child.id && t.date?.startsWith(String(y)))
            .reduce((s: number, t: any) => s + Number(t.amount), 0);
        });
        return { name: child.name, ...yearTotals };
      });
    }

    const parentCats = categories.filter(c => !c.parent_id && view.dreTypes.includes(c.dre_type));
    return parentCats.map(parent => {
      const childIds = new Set(categories.filter(c => c.parent_id === parent.id).map(c => c.id));
      childIds.add(parent.id);
      const yearTotals: Record<string, number> = {};
      years.forEach(y => {
        yearTotals[String(y)] = (transactions || [])
          .filter((t: any) => childIds.has(t.category_id) && t.date?.startsWith(String(y)))
          .reduce((s: number, t: any) => s + Number(t.amount), 0);
      });
      return { name: parent.name, ...yearTotals };
    }).filter(r => years.some(y => r[String(y)] > 0));
  }, [categories, transactions, years, view]);

  // Reset category selection when view changes
  const prevViewRef = useRef(viewIndex);
  if (prevViewRef.current !== viewIndex) {
    prevViewRef.current = viewIndex;
    setSelectedCategories(new Set());
  }

  // Filtered rows
  const rows = useMemo(() => {
    if (selectedCategories.size === 0) return allRows;
    return allRows.filter(r => selectedCategories.has(r.name));
  }, [allRows, selectedCategories]);

  const toggleCategory = (name: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelectedCategories(new Set());

  // Year-over-year percentages
  const yearPercentages = useMemo(() => {
    const pcts: Record<string, string> = {};
    for (let i = 0; i < years.length - 1; i++) {
      const curr = years[i];
      const prev = years[i + 1];
      const currTotal = rows.reduce((s, r) => s + (r[String(curr)] || 0), 0);
      const prevTotal = rows.reduce((s, r) => s + (r[String(prev)] || 0), 0);
      if (prevTotal > 0) {
        pcts[String(curr)] = `${Math.round((currTotal / prevTotal) * 100)}%`;
      }
    }
    return pcts;
  }, [rows, years]);

  // Chart data
  const chartData = useMemo(() => {
    return [...years].reverse().map(y => {
      const entry: any = { ano: String(y) };
      rows.forEach(r => { entry[r.name] = r[String(y)] || 0; });
      return entry;
    });
  }, [years, rows]);

  const chartKeys = rows.map(r => r.name).filter(name => chartData.some(d => d[name] > 0));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-3 flex-wrap">
          <CardTitle className="text-base">Evolução Anual por Categoria</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span>De</span>
              <Select value={String(startYear)} onValueChange={(v) => setStartYear(Number(v))}>
                <SelectTrigger className="w-[82px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_YEARS.filter(y => y <= endYear).map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>até</span>
              <Select value={String(endYear)} onValueChange={(v) => setEndYear(Number(v))}>
                <SelectTrigger className="w-[82px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_YEARS.filter(y => y >= startYear).map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={String(viewIndex)} onValueChange={(v) => setViewIndex(Number(v))}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_OPTIONS.map((opt, i) => (
                  <SelectItem key={i} value={String(i)}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Category multi-select filter */}
            {allRows.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    <Filter className="h-3.5 w-3.5" />
                    {selectedCategories.size === 0 ? 'Todas' : `${selectedCategories.size} selecionadas`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 pointer-events-auto" align="end">
                  <div className="space-y-2">
                    <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs" onClick={selectAll}>
                      Mostrar todas
                    </Button>
                    <div className="border-t border-border pt-2 space-y-1.5 max-h-60 overflow-y-auto">
                      {allRows.map((r, i) => (
                        <label key={r.name} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5">
                          <Checkbox
                            checked={selectedCategories.size === 0 || selectedCategories.has(r.name)}
                            onCheckedChange={() => {
                              if (selectedCategories.size === 0) {
                                // Switching from "all" to specific: select all except this one
                                const allExcept = new Set(allRows.map(x => x.name));
                                allExcept.delete(r.name);
                                setSelectedCategories(allExcept);
                              } else {
                                toggleCategory(r.name);
                              }
                            }}
                          />
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="truncate">{r.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados para esta visão</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground sticky left-0 bg-card z-10 min-w-[160px]">CLUSTER</th>
                  {years.map(y => (
                    <th key={y} className="text-right py-1.5 px-2 font-semibold text-muted-foreground whitespace-nowrap">
                      <div>{y}</div>
                      {yearPercentages[String(y)] && (
                        <div className="text-[10px] font-normal text-primary">{yearPercentages[String(y)]}</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-1 px-2 font-medium text-foreground sticky left-0 bg-card z-10 text-xs">{row.name}</td>
                    {years.map(y => (
                      <td key={y} className="py-1 px-2 text-right tabular-nums text-foreground text-xs whitespace-nowrap">
                        {row[String(y)] > 0 ? formatBRL(row[String(y)]) : '–'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-1.5 px-2 text-foreground sticky left-0 bg-card z-10 text-xs">TOTAL</td>
                  {years.map(y => {
                    const total = rows.reduce((s, r) => s + (r[String(y)] || 0), 0);
                    return (
                      <td key={y} className="py-1.5 px-2 text-right tabular-nums text-foreground text-xs whitespace-nowrap">
                        {total > 0 ? formatBRL(total) : '–'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {chartKeys.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Evolução Anual — {view.label}</CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportChartAsPNG(chartRef.current, `evolucao-anual-${view.label}`)} title="Exportar gráfico">
              <ImageDown className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div ref={chartRef}>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={chartData} barCategoryGap="20%" barGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {chartKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="yearly" fill={COLORS[i % COLORS.length]}>
                      <LabelList
                        dataKey={key}
                        position="inside"
                        style={{ fontSize: 9, fill: '#fff', fontWeight: 500 }}
                        formatter={(v: number) => v > 0 ? `${(v / 1000).toFixed(1)}k` : ''}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
