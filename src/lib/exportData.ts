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

export function exportToPDF(data: ExportRow[], filename: string, title: string, options?: { colorRows?: boolean; chartImages?: string[] }) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const useColors = options?.colorRows ?? false;

  const rowHtml = data.map((row, idx) => {
    const desc = String(row[headers[0]] || '');
    const isTotal = desc.includes('TOTAL') || desc.includes('EBITDA') || desc.includes('Lucro') || desc.includes('Margem') || desc.includes('Patrimônio');
    const isGroup = desc === desc.toUpperCase() && desc.length > 2 && !isTotal;
    
    let bgColor = '';
    let fontWeight = '';
    let color = '';
    
    if (useColors) {
      if (isTotal) {
        bgColor = '#1a365d'; fontWeight = 'bold'; color = '#fff';
      } else if (isGroup) {
        bgColor = '#2d4a7a'; fontWeight = '600'; color = '#e8edf5';
      } else if (idx % 2 === 0) {
        bgColor = '#f7f9fc';
      } else {
        bgColor = '#ffffff';
      }
    } else {
      if (isTotal) {
        bgColor = '#e8edf5'; fontWeight = 'bold';
      } else if (idx % 2 === 0) {
        bgColor = '#fafafa';
      }
    }

    return `<tr style="background:${bgColor};font-weight:${fontWeight};color:${color}">
      ${headers.map((h, i) => `<td style="border:1px solid ${useColors ? '#c5d1e0' : '#ddd'};padding:5px 10px;${i > 0 ? 'text-align:right;' : ''}">${row[h]}</td>`).join('')}
    </tr>`;
  }).join('');

  const chartsHtml = (options?.chartImages || []).map((src, i) =>
    `<div style="page-break-inside:avoid;margin:20px 0;text-align:center;"><img src="${src}" style="max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:6px;" /></div>`
  ).join('');

  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; font-size: 11px; color: #1a202c; }
      h1 { font-size: 18px; margin-bottom: 4px; color: #1a365d; font-weight: 700; }
      .subtitle { font-size: 11px; color: #718096; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; border: 1px solid ${useColors ? '#1a365d' : '#ddd'}; }
      th { background: #1a365d; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 11px; border: 1px solid #1a365d; }
      th:not(:first-child) { text-align: right; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <h1>${title}</h1>
    <div class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-BR')} — Sistema Operacional da Vida Financeira</div>
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
    ${chartsHtml}
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
