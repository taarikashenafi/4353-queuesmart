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
