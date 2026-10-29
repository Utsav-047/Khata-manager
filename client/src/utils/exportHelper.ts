/**
 * Export Helper: CSV generation with Formula Injection Protection (OWASP compliant)
 */

function sanitizeForCSV(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // OWASP CSV Injection protection: prefix unsafe initial characters with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes and enclose in quotes if comma or newline present
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): void {
  const headerLine = headers.map(sanitizeForCSV).join(',');
  const rowLines = rows.map(row => row.map(sanitizeForCSV).join(','));
  const csvContent = [headerLine, ...rowLines].join('\r\n');

  // Add UTF-8 BOM for Microsoft Excel compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
