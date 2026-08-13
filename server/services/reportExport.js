// Report export layer (owner: Armaan)
//
// Every report — participation history, service activity, usage statistics —
// arrives in the same payload shape (Shared Contract #1 in the work plan), so
// one exporter covers all of them in every format. Nothing in this file may
// reference a specific report's fields: the moment it does, the next report
// needs its own exporter and the contract has stopped paying for itself.
//
//   { title, generatedAt, filters, columns, rows, summary }
//
// `columns` is the source of truth for both the header text and the column
// order. `rows` are plain objects keyed by `column.key`.

import { createArrayCsvStringifier, createObjectCsvStringifier } from 'csv-writer';
import PDFDocument from 'pdfkit';

// Renders a report as a CSV string: the header row from the column labels,
// one line per row in column order, then a blank line and the summary
// label/value pairs.
//
// Escaping is RFC 4180 and comes from csv-writer — a value holding a comma, a
// double quote, or a newline is wrapped in quotes with its own quotes doubled,
// so a service named `Advising, North` cannot split into two columns.
export function toCsv(report) {
  const columns = report?.columns ?? [];
  const rows = report?.rows ?? [];
  const summary = report?.summary ?? [];

  let csv = '';

  if (columns.length > 0) {
    const table = createObjectCsvStringifier({
      header: columns.map(({ key, label }) => ({ id: key, title: label })),
    });

    // An empty result set still emits the header row, so the downloaded file
    // says which report it is instead of being a zero-byte puzzle.
    csv += table.getHeaderString();

    // Guarded because stringifyRecords([]) returns a bare newline, which would
    // read as a blank data row in a spreadsheet. A row missing one of the keys
    // renders as an empty field rather than shifting every value after it one
    // column to the left.
    if (rows.length > 0) {
      csv += table.stringifyRecords(rows);
    }
  }

  if (summary.length > 0) {
    // Blank line so a spreadsheet reads the footer stats as their own block
    // instead of as two more rows of the table.
    csv += '\n';
    csv += createArrayCsvStringifier({}).stringifyRecords(
      summary.map(({ label, value }) => [label, value]),
    );
  }

  return csv;
}

// A human-readable version of the filters the admin actually applied, for the
// line under the title. `filters` is all-nulls when nothing was narrowed, and
// "All time, all services" reads better on a printed report than four nulls.
export function describeFilters(filters) {
  const parts = [];

  if (filters?.from && filters?.to) parts.push(`${filters.from} to ${filters.to}`);
  else if (filters?.from) parts.push(`From ${filters.from}`);
  else if (filters?.to) parts.push(`Up to ${filters.to}`);
  else parts.push('All time');

  parts.push(filters?.serviceName ? `Service: ${filters.serviceName}` : 'All services');

  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
//
// Same contract as toCsv: this never names a field from a specific report, it
// only walks `columns` and `rows`.
//
// pdfkit is stream-based, so this resolves a Buffer once the document has
// finished writing rather than returning one synchronously.

const PAGE_MARGIN = 40;
const CELL_PADDING = 6;
const FONT_SIZE = 8;
const HEADER_FILL = '#eceffb';

// Column widths are proportional to how wide each column's content actually
// is, so a "Description" column gets more room than "Served" instead of every
// column being an equal slice. Measured against the longest cell in each
// column, then clamped so one long value can't starve the rest.
function columnWidths(doc, columns, rows, available) {
  const weights = columns.map((column) => {
    const widest = rows.reduce((max, row) => {
      const text = cellText(row[column.key]);
      return Math.max(max, doc.widthOfString(text));
    }, doc.widthOfString(column.label));

    return Math.min(Math.max(widest, 40), 180);
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (weight / total) * available);
}

// null/undefined render as an empty cell rather than the strings "null" or
// "undefined" — a participation row that was canceled has no wait to report.
function cellText(value) {
  return value === null || value === undefined ? '' : String(value);
}

function drawRow(doc, cells, widths, top, { bold = false, fill = null } = {}) {
  const height = cells.reduce((max, text, index) => {
    const textHeight = doc.heightOfString(text, { width: widths[index] - CELL_PADDING * 2 });
    return Math.max(max, textHeight);
  }, 0) + CELL_PADDING * 2;

  if (fill) {
    doc.rect(PAGE_MARGIN, top, widths.reduce((a, b) => a + b, 0), height).fill(fill);
  }

  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#1a1b2e');

  let x = PAGE_MARGIN;
  cells.forEach((text, index) => {
    doc.text(text, x + CELL_PADDING, top + CELL_PADDING, {
      width: widths[index] - CELL_PADDING * 2,
      lineBreak: true,
    });
    x += widths[index];
  });

  // Bottom rule. Drawn per row rather than as a full grid: vertical rules on a
  // wrapping table need every cell to be the same height, which forces
  // truncation, and a truncated report is a wrong report.
  doc
    .moveTo(PAGE_MARGIN, top + height)
    .lineTo(PAGE_MARGIN + widths.reduce((a, b) => a + b, 0), top + height)
    .strokeColor('#d3d6e8')
    .lineWidth(0.5)
    .stroke();

  return height;
}

export function toPdf(report) {
  const columns = report?.columns ?? [];
  const rows = report?.rows ?? [];
  const summary = report?.summary ?? [];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: PAGE_MARGIN, layout: 'landscape' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const available = doc.page.width - PAGE_MARGIN * 2;

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1a1b2e');
    doc.text(report?.title ?? 'QueueSmart Report', PAGE_MARGIN, PAGE_MARGIN);

    doc.font('Helvetica').fontSize(9).fillColor('#63667e');
    doc.text(`Generated ${new Date(report?.generatedAt ?? Date.now()).toUTCString()}`);
    doc.text(describeFilters(report?.filters));
    doc.moveDown(1);

    doc.fontSize(FONT_SIZE);

    if (columns.length > 0) {
      const widths = columnWidths(doc, columns, rows, available);
      const bottom = doc.page.height - PAGE_MARGIN;
      let y = doc.y;

      const drawHeader = () => {
        y += drawRow(doc, columns.map((column) => column.label), widths, y, {
          bold: true,
          fill: HEADER_FILL,
        });
      };

      drawHeader();

      for (const row of rows) {
        const cells = columns.map((column) => cellText(row[column.key]));

        // Measured before drawing, so a row never starts near the bottom of a
        // page and spills off the edge. The header repeats on the new page,
        // otherwise page 2 onward is a wall of unlabeled columns.
        const projected = cells.reduce((max, text, index) => {
          return Math.max(max, doc.heightOfString(text, { width: widths[index] - CELL_PADDING * 2 }));
        }, 0) + CELL_PADDING * 2;

        if (y + projected > bottom) {
          doc.addPage();
          y = PAGE_MARGIN;
          drawHeader();
        }

        y += drawRow(doc, cells, widths, y, {});
      }

      doc.y = y;
    }

    if (rows.length === 0) {
      doc.moveDown(1);
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#63667e');
      doc.text('No activity in this range.', PAGE_MARGIN, doc.y);
    }

    if (summary.length > 0) {
      doc.moveDown(1.5);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1b2e');
      doc.text('Summary', PAGE_MARGIN, doc.y);
      doc.moveDown(0.5);

      doc.font('Helvetica').fontSize(9).fillColor('#1a1b2e');
      for (const { label, value } of summary) {
        doc.text(`${label}: ${cellText(value)}`, PAGE_MARGIN, doc.y);
      }
    }

    doc.end();
  });
}
