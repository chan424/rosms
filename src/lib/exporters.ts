export interface ExportColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportExcel<T>(filename: string, columns: ExportColumn<T>[], rows: T[], sheet = 'Data') {
  const XLSX = await import('xlsx');
  const data = [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => c.value(r) ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(10, c.label.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  XLSX.writeFile(wb, `${filename}-${stamp()}.xlsx`);
}

export async function exportPdf<T>(filename: string, title: string, columns: ExportColumn<T>[], rows: T[]) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text('RGUKT Ongole — ROSMS', 14, 14);
  doc.setFontSize(11);
  doc.text(title, 14, 21);
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, 14, 26);
  autoTable(doc, {
    startY: 30,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => String(c.value(r) ?? ''))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [21, 67, 130] },
  });
  doc.save(`${filename}-${stamp()}.pdf`);
}

/** Reads the first sheet of an .xlsx/.xls/.csv file into row objects keyed by header. */
export async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}
