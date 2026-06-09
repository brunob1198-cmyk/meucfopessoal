import { useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/useCategories';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, CheckCircle, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'entrada' | 'saida';
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isDuplicate: boolean;
  selected: boolean;
}

// Default keyword-to-category mapping
const DEFAULT_KEYWORDS: Record<string, string[]> = {
  'Alimentação': ['ifood', 'uber eats', 'rappi', 'restaurante', 'lanchonete', 'padaria', 'pizzaria', 'mcdonalds', 'burger king', 'subway'],
  'Supermercado': ['supermercado', 'extra', 'carrefour', 'pao de acucar', 'atacadao', 'assai', 'hortifruti'],
  'Combustível': ['posto', 'shell', 'ipiranga', 'petrobras', 'br mania', 'combustivel', 'gasolina'],
  'Transporte': ['uber', '99', 'cabify', 'estacionamento', 'pedagio', 'sem parar'],
  'Assinaturas': ['netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'globoplay', 'youtube', 'apple'],
  'Farmácia': ['farmacia', 'droga', 'drogasil', 'drogaria', 'raia', 'pacheco'],
  'Vestuário': ['renner', 'riachuelo', 'c&a', 'zara', 'shein', 'centauro'],
  'Energia / Água': ['enel', 'cpfl', 'cemig', 'copasa', 'sabesp', 'energisa', 'luz', 'energia'],
  'Telefone celular': ['claro', 'vivo', 'tim', 'oi', 'celular'],
  'Salário': ['salario', 'folha', 'pagamento', 'remuneracao', 'holerite'],
};

function parseCSV(text: string): { date: string; description: string; amount: number }[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  const results: { date: string; description: string; amount: number }[] = [];
  
  // Try to detect separator
  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  
  // Find column indices
  const dateIdx = header.findIndex(h => h.includes('data') || h === 'date');
  const descIdx = header.findIndex(h => h.includes('descri') || h.includes('histórico') || h.includes('historico') || h === 'description' || h.includes('memo') || h.includes('lancamento'));
  const amountIdx = header.findIndex(h => h.includes('valor') || h === 'amount' || h === 'value' || h.includes('quantia'));
  
  // If no headers found, try positional (common bank format: date, description, amount)
  const useParsed = dateIdx >= 0 && descIdx >= 0 && amountIdx >= 0;
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ''));
    if (cols.length < 3) continue;
    
    const rawDate = cols[useParsed ? dateIdx : 0];
    const rawDesc = cols[useParsed ? descIdx : 1];
    const rawAmount = cols[useParsed ? amountIdx : 2];
    
    // Parse date (DD/MM/YYYY or YYYY-MM-DD)
    let dateStr = '';
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        dateStr = `${year}-${month}-${day}`;
      }
    } else if (rawDate.includes('-')) {
      dateStr = rawDate;
    }
    
    // Parse amount (handle BR format: 1.234,56 and US format: 1234.56)
    let cleanAmount = rawAmount;
    if (rawAmount.includes(',') && rawAmount.includes('.')) {
      if (rawAmount.lastIndexOf(',') > rawAmount.lastIndexOf('.')) {
        cleanAmount = rawAmount.replace(/\./g, '').replace(',', '.'); // 1.234,56
      } else {
        cleanAmount = rawAmount.replace(/,/g, ''); // 1,234.56
      }
    } else if (rawAmount.includes(',')) {
      cleanAmount = rawAmount.replace(',', '.'); // 1234,56
    }
    const amount = parseFloat(cleanAmount);
    
    if (dateStr && rawDesc && !isNaN(amount) && amount !== 0) {
      results.push({ date: dateStr, description: rawDesc, amount });
    }
  }
  
  return results;
}

function parseOFX(text: string): { date: string; description: string; amount: number }[] {
  const results: { date: string; description: string; amount: number }[] = [];
  
  // Simple OFX parser - extract STMTTRN blocks
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  
  while ((match = trnRegex.exec(text)) !== null) {
    const block = match[1];
    
    const dateMatch = block.match(/<DTPOSTED>(\d{8})/);
    const amountMatch = block.match(/<TRNAMT>([^<\n]+)/);
    const memoMatch = block.match(/<MEMO>([^<\n]+)/);
    const nameMatch = block.match(/<NAME>([^<\n]+)/);
    
    if (dateMatch && amountMatch) {
      const rawDate = dateMatch[1];
      const dateStr = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const amount = parseFloat(amountMatch[1].trim().replace(',', '.'));
      const description = (memoMatch?.[1] || nameMatch?.[1] || 'Sem descrição').trim();
      
      if (!isNaN(amount) && amount !== 0) {
        results.push({ date: dateStr, description, amount });
      }
    }
  }
  
  return results;
}

export function BankStatementUpload() {
  const { user } = useAuth();
  const { data: categories } = useCategories();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Load user's custom rules
  const { data: userRules } = useQuery({
    queryKey: ['category_rules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_rules')
        .select('keyword, category_id');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Build keyword → category mapping
  const keywordMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (!categories) return map;

    // Map category names for lookup
    const catById = new Map(categories.map(c => [c.id, c]));

    // Add default keywords
    for (const [catName, keywords] of Object.entries(DEFAULT_KEYWORDS)) {
      const cat = categories.find(c => c.name.toLowerCase() === catName.toLowerCase() && c.parent_id);
      if (cat) {
        keywords.forEach(kw => map.set(kw.toLowerCase(), { id: cat.id, name: cat.name }));
      }
    }

    // Override with user rules
    if (userRules) {
      for (const rule of userRules) {
        const cat = catById.get(rule.category_id);
        if (cat) {
          map.set(rule.keyword.toLowerCase(), { id: cat.id, name: cat.name });
        }
      }
    }

    return map;
  }, [categories, userRules]);

  // Subcategories for manual selection
  const subcategories = useMemo(() => {
    return (categories || []).filter(c => c.parent_id).sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  function classifyDescription(desc: string): { id: string; name: string } | null {
    const lower = desc.toLowerCase();
    for (const [keyword, cat] of keywordMap.entries()) {
      if (lower.includes(keyword)) return cat;
    }
    return null;
  }

  async function checkDuplicates(parsedTxs: { date: string; description: string; amount: number }[]): Promise<Set<string>> {
    if (!user) return new Set();
    
    const dates = [...new Set(parsedTxs.map(t => t.date))];
    if (dates.length === 0) return new Set();
    
    const { data: existing } = await supabase
      .from('transactions')
      .select('date, amount, comment')
      .gte('date', dates.sort()[0])
      .lte('date', dates.sort().reverse()[0]);
    
    const dupeKeys = new Set<string>();
    (existing || []).forEach(e => {
      dupeKeys.add(`${e.date}|${Math.abs(Number(e.amount))}|${(e.comment || '').toLowerCase()}`);
    });
    
    return dupeKeys;
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(false);
    setProcessing(true);

    const text = await file.text();
    let parsed: { date: string; description: string; amount: number }[] = [];
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'txt') {
      parsed = parseCSV(text);
    } else if (ext === 'ofx') {
      parsed = parseOFX(text);
    } else if (ext === 'pdf') {
      toast.error('Para importar PDFs, salve o extrato como CSV no seu banco.');
      setProcessing(false);
      return;
    }

    if (parsed.length === 0) {
      toast.error('Nenhuma transação encontrada no arquivo. Verifique o formato.');
      setProcessing(false);
      return;
    }

    // Check duplicates
    const dupeKeys = await checkDuplicates(parsed);

    const txs: ParsedTransaction[] = parsed.map(p => {
      const isEntry = p.amount > 0;
      const absAmount = Math.abs(p.amount);
      const suggested = classifyDescription(p.description);
      const dupeKey = `${p.date}|${absAmount}|${p.description.toLowerCase()}`;
      
      return {
        date: p.date,
        description: p.description,
        amount: absAmount,
        type: isEntry ? 'entrada' : 'saida',
        suggestedCategoryId: suggested?.id || null,
        suggestedCategoryName: suggested?.name || null,
        categoryId: suggested?.id || null,
        categoryName: suggested?.name || null,
        isDuplicate: dupeKeys.has(dupeKey),
        selected: !dupeKeys.has(dupeKey),
      };
    });

    setTransactions(txs);
    setProcessing(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const updateCategory = (index: number, categoryId: string) => {
    const cat = subcategories.find(c => c.id === categoryId);
    setTransactions(prev => prev.map((t, i) => 
      i === index ? { ...t, categoryId, categoryName: cat?.name || null } : t
    ));
  };

  const toggleSelect = (index: number) => {
    setTransactions(prev => prev.map((t, i) => 
      i === index ? { ...t, selected: !t.selected } : t
    ));
  };

  const removeTransaction = (index: number) => {
    setTransactions(prev => prev.filter((_, i) => i !== index));
  };

  const bulkUpdateCategory = (categoryId: string) => {
    const cat = subcategories.find(c => c.id === categoryId);
    setTransactions(prev => prev.map(t => 
      t.selected && !t.isDuplicate ? { ...t, categoryId, categoryName: cat?.name || null } : t
    ));
    toast.success('Categoria aplicada aos selecionados');
  };

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);

    const toImport = transactions.filter(t => t.selected && t.categoryId && !t.isDuplicate);
    
    if (toImport.length === 0) {
      toast.error('Nenhuma transação válida para importar. Atribua categorias às transações.');
      setImporting(false);
      return;
    }

    const inserts = toImport.map(t => ({
      user_id: user.id,
      category_id: t.categoryId!,
      amount: t.amount,
      date: t.date,
      payment_date: t.date,
      comment: t.description,
    }));

    // Batch insert
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const { error } = await supabase.from('transactions').insert(chunk);
      if (error) {
        toast.error(`Erro no lote ${Math.floor(i / 100) + 1}: ${error.message}`);
        setImporting(false);
        return;
      }
    }

    // Save new category rules for manually changed categories
    const newRules: { user_id: string; keyword: string; category_id: string }[] = [];
    for (const t of toImport) {
      if (t.categoryId && t.categoryId !== t.suggestedCategoryId && t.description) {
        // Extract first meaningful word as keyword
        const keyword = t.description.toLowerCase().split(/\s+/)[0];
        if (keyword.length >= 3) {
          newRules.push({ user_id: user.id, keyword, category_id: t.categoryId });
        }
      }
    }
    
    if (newRules.length > 0) {
      // Upsert rules (ignore conflicts)
      await supabase.from('category_rules').upsert(newRules, { onConflict: 'user_id,keyword' });
    }

    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['category_rules'] });
    toast.success(`${toImport.length} transações importadas com sucesso!`);
    setImporting(false);
    setDone(true);
  };

  const validCount = transactions.filter(t => t.selected && t.categoryId && !t.isDuplicate).length;
  const dupeCount = transactions.filter(t => t.isDuplicate).length;
  const noCatCount = transactions.filter(t => t.selected && !t.categoryId && !t.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setTransactions([]); setDone(false); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-4 w-4" /> Importar Extrato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Extrato Bancário</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">📋 Formatos aceitos:</p>
            <ul className="list-disc ml-4 space-y-1 text-muted-foreground">
              <li><strong>CSV</strong> — Extrato exportado do banco ou cartão (colunas: Data, Descrição, Valor)</li>
              <li><strong>OFX</strong> — Formato padrão de extrato bancário (Money, Quicken)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-1">
              💡 O sistema identifica automaticamente entradas e saídas pelo sinal do valor, e sugere categorias por palavras-chave.
            </p>
          </div>

          <div>
            <input ref={fileRef} type="file" accept=".csv,.ofx,.txt" className="hidden" onChange={handleFile} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={processing} className="w-full gap-2">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {processing ? 'Processando...' : 'Selecionar arquivo de extrato'}
            </Button>
          </div>

          {transactions.length > 0 && !done && (
            <>
              <div className="flex items-center justify-between gap-3 text-sm flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 text-primary">
                    <CheckCircle className="h-4 w-4" /> {validCount} prontas
                  </span>
                  {noCatCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <AlertCircle className="h-4 w-4" /> {noCatCount} sem categoria
                    </span>
                  )}
                  {dupeCount > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      {dupeCount} duplicada{dupeCount > 1 ? 's' : ''} (ignoradas)
                    </span>
                  )}
                </div>

                {transactions.some(t => t.selected && !t.isDuplicate) && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Categorizar selecionados:</span>
                    <Select onValueChange={bulkUpdateCategory}>
                      <SelectTrigger className="h-8 text-xs w-48 bg-primary/10 border-primary/20 hover:bg-primary/20 transition-colors">
                        <SelectValue placeholder="Escolher categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        {subcategories.map(c => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto border rounded-md min-h-0">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-2 w-8 text-center" title="Marcar/Desmarcar Todos">
                        <input
                          type="checkbox"
                          className="rounded cursor-pointer"
                          checked={transactions.length > 0 && transactions.every(t => t.isDuplicate || t.selected)}
                          ref={el => {
                            if (el) {
                              const some = transactions.some(t => t.selected && !t.isDuplicate);
                              const all = transactions.every(t => t.isDuplicate || t.selected);
                              if (some && !all) el.indeterminate = true;
                              else el.indeterminate = false;
                            }
                          }}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setTransactions(prev => prev.map(t => t.isDuplicate ? t : { ...t, selected: isChecked }));
                          }}
                        />
                      </th>
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Descrição</th>
                      <th className="text-left p-2">Tipo</th>
                      <th className="text-right p-2">Valor</th>
                      <th className="text-left p-2">Categoria</th>
                      <th className="text-center p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr
                        key={i}
                        className={`${t.isDuplicate ? 'bg-muted/30 opacity-50' : !t.categoryId ? 'bg-amber-500/5' : ''}`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={t.selected && !t.isDuplicate}
                            disabled={t.isDuplicate}
                            onChange={() => toggleSelect(i)}
                            className="rounded"
                          />
                        </td>
                        <td className="p-2 tabular-nums whitespace-nowrap">{t.date}</td>
                        <td className="p-2 max-w-[180px] truncate" title={t.description}>{t.description}</td>
                        <td className="p-2">
                          <Badge variant={t.type === 'entrada' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                            {t.type === 'entrada' ? 'Entrada' : 'Saída'}
                          </Badge>
                          {t.isDuplicate && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1 border-muted-foreground/30">
                              Duplicada
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 text-right tabular-nums font-medium">
                          R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2">
                          <Select
                            value={t.categoryId || ''}
                            onValueChange={(v) => updateCategory(i, v)}
                            disabled={t.isDuplicate}
                          >
                            <SelectTrigger className="h-7 text-xs w-40">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {subcategories.map(c => (
                                <SelectItem key={c.id} value={c.id} className="text-xs">
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-center">
                          <button onClick={() => removeTransaction(i)} className="p-1 hover:bg-destructive/10 rounded">
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button onClick={handleImport} disabled={importing || validCount === 0} className="w-full gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar {validCount} transação(ões)
              </Button>
            </>
          )}

          {done && (
            <div className="text-center py-6 space-y-2">
              <CheckCircle className="h-10 w-10 text-primary mx-auto" />
              <p className="text-sm font-medium">Importação concluída!</p>
              <p className="text-xs text-muted-foreground">As transações já estão disponíveis no DRE, Dashboard e Fluxo de Caixa.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
