import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, FileDown, Camera } from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportData';
import { chartToBase64 } from '@/lib/exportChart';
import { RefObject } from 'react';
import html2canvas from 'html2canvas';

interface ExportMenuProps {
  getData: () => { [key: string]: string | number }[];
  filename: string;
  title: string;
  colorRows?: boolean;
  chartRefs?: RefObject<HTMLDivElement | null>[];
  screenshotRef?: RefObject<HTMLDivElement | null>;
}

export function ExportMenu({ getData, filename, title, colorRows = true, chartRefs, screenshotRef }: ExportMenuProps) {
  const handlePDF = async () => {
    const data = getData();
    let chartImages: string[] = [];
    if (chartRefs && chartRefs.length > 0) {
      const results = await Promise.all(chartRefs.map(ref => chartToBase64(ref.current)));
      chartImages = results.filter((r): r is string => !!r);
    }
    exportToPDF(data, filename, title, { colorRows, chartImages });
  };

  const handleScreenshotPDF = async () => {
    if (!screenshotRef?.current) return;
    const el = screenshotRef.current;
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });
    const imgData = canvas.toDataURL('image/png');
    const html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body { margin: 0; padding: 0; }
        img { width: 100%; height: auto; }
        @media print { @page { margin: 10mm; size: A4 landscape; } }
      </style></head><body>
      <img src="${imgData}" />
      </body></html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 600);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {screenshotRef && (
          <DropdownMenuItem onClick={handleScreenshotPDF}>
            <Camera className="h-4 w-4 mr-2" /> PDF (como na tela)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handlePDF}>
          <FileText className="h-4 w-4 mr-2" /> PDF (tabela + gráficos)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToExcel(getData(), filename)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToCSV(getData(), filename)}>
          <FileDown className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
