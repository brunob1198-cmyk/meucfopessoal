import { useState, useRef } from 'react';
import { read, utils } from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedRow {
  date: string;
  category: string;
  amount: number;
  comment: string;
  valid: boolean;
  error?: string;
}

export function ExcelUpload() {
  const { user } = useAuth();
  const { data: categories } = useCategories();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const categoryMap = new Map<string, string>();
  (categories || []).forEach(c => {
    categoryMap.set(c.name.toLowerCase().trim(), c.id);
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = read(evt.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = utils.sheet_to_json<any>(ws, { defval: '' });

      const parsed: ParsedRow[] = json.map((row: any) => {
        const rawDate = row['Data'] || row['data'] || '';
        const rawCat = String(row['Categoria'] || row['categoria'] || '').trim();
        const rawAmount = Number(row['Valor'] || row['valor'] || 0);
        const rawComment = String(row['Comentário'] || row['Comentario'] || row['comentario'] || row['comentário'] || '');

        let dateStr = '';
        if (typeof rawDate === 'number') {
          // Excel serial date
          const d = new Date((rawDate - 25569) * 86400 * 1000);
          dateStr = d.toISOString().split('T')[0];
        } else if (typeof rawDate === 'string' && rawDate.includes('/')) {
          const parts = rawDate.split('/');
          if (parts.length === 3) {
            dateStr = `${parts[2].length === 2 ? '20' + parts[2] : parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (typeof rawDate === 'string') {
          dateStr = rawDate;
        }

        const catId = categoryMap.get(rawCat.toLowerCase());
        const valid = !!dateStr && !!catId && rawAmount !== 0;
        return {
          date: dateStr,
          category: rawCat,
          amount: rawAmount,
          comment: rawComment,
          valid,
          error: !dateStr ? 'Data inválida' : !catId ? 'Categoria não encontrada' : rawAmount === 0 ? 'Valor zerado' : undefined,
        };
      });

      setRows(parsed);
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);

    const validRows = rows.filter(r => r.valid);
    const inserts = validRows.map(r => ({
      user_id: user.id,
      category_id: categoryMap.get(r.category.toLowerCase().trim())!,
      amount: r.amount,
      date: r.date,
      comment: r.comment || null,
    }));

    // batch insert in chunks of 100
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100);
      const { error } = await supabase.from('transactions').insert(chunk);
      if (error) {
        toast.error(`Erro no lote ${Math.floor(i / 100) + 1}: ${error.message}`);
        setImporting(false);
        return;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    toast.success(`${validRows.length} lançamentos importados com sucesso!`);
    setImporting(false);
    setDone(true);
  };

  const downloadTemplate = () => {
    const wb = utils.book_new();
    const sampleData = [
      { Data: '01/03/2026', Categoria: 'Salário', Valor: 5000, 'Comentário': 'Salário março' },
      { Data: '05/03/2026', Categoria: 'Supermercado', Valor: 450.50, 'Comentário': 'Compras do mês' },
      { Data: '10/03/2026', Categoria: 'Combustível', Valor: 200, 'Comentário': '' },
    ];
    const ws = utils.json_to_sheet(sampleData);
    ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 30 }];
    utils.book_append_sheet(wb, ws, 'Lançamentos');

    // Add categories reference sheet
    const catData = (categories || []).filter(c => c.parent_id).map(c => ({ 'Categorias disponíveis': c.name }));
    const wsCat = utils.json_to_sheet(catData);
    wsCat['!cols'] = [{ wch: 30 }];
    utils.book_append_sheet(wb, wsCat, 'Categorias');

    const { writeFile } = require('xlsx');
    writeFile(wb, 'modelo-lancamentos.xlsx');
  };

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows([]); setDone(false); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="h-4 w-4" /> Importar Planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Lançamentos via Planilha</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium">📋 Como usar:</p>
            <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
              <li>Baixe o modelo clicando no botão abaixo</li>
              <li>Preencha com suas informações: <strong>Data</strong> (dd/mm/aaaa), <strong>Categoria</strong> (nome exato da subcategoria), <strong>Valor</strong> (número) e <strong>Comentário</strong> (opcional)</li>
              <li>Use a aba "Categorias" do modelo para consultar os nomes disponíveis</li>
              <li>Faça o upload do arquivo preenchido</li>
            </ol>
            <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Baixar Modelo
            </Button>
          </div>

          <div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full gap-2">
              <Upload className="h-4 w-4" /> Selecionar arquivo Excel
            </Button>
          </div>

          {rows.length > 0 && !done && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-primary"><CheckCircle className="h-4 w-4" /> {validCount} válidos</span>
                {invalidCount > 0 && <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-4 w-4" /> {invalidCount} com erro</span>}
              </div>

              <div className="max-h-[300px] overflow-y-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Categoria</th>
                      <th className="text-right p-2">Valor</th>
                      <th className="text-left p-2">Comentário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className={r.valid ? '' : 'bg-destructive/5'}>
                        <td className="p-2">{r.valid ? <CheckCircle className="h-3.5 w-3.5 text-primary" /> : <span className="text-destructive text-[10px]">{r.error}</span>}</td>
                        <td className="p-2 tabular-nums">{r.date}</td>
                        <td className="p-2">{r.category}</td>
                        <td className="p-2 text-right tabular-nums">{r.amount.toFixed(2)}</td>
                        <td className="p-2 truncate max-w-[150px]">{r.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 100 && <p className="text-xs text-muted-foreground text-center py-2">Mostrando 100 de {rows.length} linhas</p>}
              </div>

              <Button onClick={handleImport} disabled={importing || validCount === 0} className="w-full gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar {validCount} lançamento(s)
              </Button>
            </>
          )}

          {done && (
            <div className="text-center py-6 space-y-2">
              <CheckCircle className="h-10 w-10 text-primary mx-auto" />
              <p className="text-sm font-medium">Importação concluída!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
