import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportData';
import { chartToBase64 } from '@/lib/exportChart';
import { RefObject } from 'react';

interface ExportMenuProps {
  getData: () => { [key: string]: string | number }[];
  filename: string;
  title: string;
  colorRows?: boolean;
  chartRefs?: RefObject<HTMLDivElement | null>[];
}

export function ExportMenu({ getData, filename, title, colorRows = true, chartRefs }: ExportMenuProps) {
  const handlePDF = async () => {
    const data = getData();
    let chartImages: string[] = [];
    if (chartRefs && chartRefs.length > 0) {
      const results = await Promise.all(chartRefs.map(ref => chartToBase64(ref.current)));
      chartImages = results.filter((r): r is string => !!r);
    }
    exportToPDF(data, filename, title, { colorRows, chartImages });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportToExcel(getData(), filename)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToCSV(getData(), filename)}>
          <FileDown className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDF}>
          <FileText className="h-4 w-4 mr-2" /> PDF (com gráficos)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
