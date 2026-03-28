import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

// Escapes text for safe inclusion in HTML
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Normalise notes to a string regardless of stored type
function notesToString(notes) {
  if (Array.isArray(notes)) return notes.join('; ');
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes);
      if (Array.isArray(parsed)) return parsed.join('; ');
      return notes;
    } catch {
      return notes;
    }
  }
  return '';
}

// CSV Export
export async function exportToCSV(receipts) {
  const headers = ['Date', 'Vendor', 'Category', 'Total', 'Tax', 'Notes'];
  const rows = receipts.map(r => [
    r.date || '',
    r.vendor || '',
    r.category || 'Other',
    parseFloat(r.total || 0).toFixed(2),
    parseFloat(r.tax || 0).toFixed(2),
    notesToString(r.notes),
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const filename = `receipts_${new Date().toISOString().split('T')[0]}.csv`;
  const filepath = FileSystem.documentDirectory + filename;

  await FileSystem.writeAsStringAsync(filepath, csv);
  return filepath;
}

// PDF Export
export async function exportToPDF(receipts) {
  const totalAmount = receipts.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
  const totalTax    = receipts.reduce((sum, r) => sum + parseFloat(r.tax || 0), 0);

  const html = `
    <html>
      <head>
        <style>
          body { font-family: Arial; margin: 20px; }
          h1 { text-align: center; color: #111827; }
          p { color: #6B7280; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #E5E7EB; padding: 12px; text-align: left; }
          th { background-color: #F3F4F6; font-weight: bold; color: #111827; }
          .total-row { font-weight: bold; background-color: #F9FAFB; }
        </style>
      </head>
      <body>
        <h1>Receipt Summary</h1>
        <p>Generated: ${escapeHtml(new Date().toLocaleString())}</p>
        <table>
          <tr>
            <th>Date</th>
            <th>Vendor</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Tax</th>
          </tr>
          ${receipts.map(r => `
            <tr>
              <td>${escapeHtml(r.date || '')}</td>
              <td>${escapeHtml(r.vendor || '')}</td>
              <td>${escapeHtml(r.category || 'Other')}</td>
              <td>$${parseFloat(r.total || 0).toFixed(2)}</td>
              <td>$${parseFloat(r.tax || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="3">TOTAL</td>
            <td>$${totalAmount.toFixed(2)}</td>
            <td>$${totalTax.toFixed(2)}</td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

// Share functionality
export async function shareReceipts(receipts, format = 'csv') {
  let filepath;
  let mimeType;

  if (format === 'csv') {
    filepath = await exportToCSV(receipts);
    mimeType = 'text/csv';
  } else if (format === 'pdf') {
    filepath = await exportToPDF(receipts);
    mimeType = 'application/pdf';
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filepath, {
      mimeType,
      dialogTitle: 'Share Receipts',
    });
  } else {
    throw new Error('Sharing not available on this device');
  }
}
