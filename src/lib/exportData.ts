import * as XLSX from 'xlsx';
import { formatBRL } from './dre';

interface ExportRow {
  [key: string]: string | number;
}

export function exportToCSV(data: ExportRow[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(';'),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      return typeof val === 'string' && val.includes(';') ? `"${val}"` : val;
    }).join(';')),
  ];
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export function exportToExcel(data: ExportRow[], filename: string) {
  if (data.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(data: ExportRow[], filename: string, title: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
      h1 { font-size: 16px; margin-bottom: 10px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; }
      td:not(:first-child) { text-align: right; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <h1>${title}</h1>
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${data.map(row => `<tr>${headers.map(h => `<td>${row[h]}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    </body></html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
