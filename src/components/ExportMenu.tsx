import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportData';

interface ExportMenuProps {
  getData: () => { [key: string]: string | number }[];
  filename: string;
  title: string;
}

export function ExportMenu({ getData, filename, title }: ExportMenuProps) {
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
        <DropdownMenuItem onClick={() => exportToPDF(getData(), filename, title)}>
          <FileText className="h-4 w-4 mr-2" /> PDF (impressão)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
