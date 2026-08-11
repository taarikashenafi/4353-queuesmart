// The exporter is the one piece of the reporting module that every report and
// every format runs through, so it is tested on its own against the shared
// payload contract — no database, no routes, no report-specific knowledge.

import { describe, expect, it } from 'vitest';
import { toCsv } from '../services/reportExport.js';

const REPORT = {
  title: 'Queue Participation History',
  generatedAt: '2026-08-13T18:04:00.000Z',
  filters: { from: null, to: null, serviceId: null, serviceName: null },
  columns: [
    { key: 'userEmail', label: 'User' },
    { key: 'serviceName', label: 'Service' },
    { key: 'waitMinutes', label: 'Wait (min)' },
  ],
  rows: [
    { userEmail: 'student@uh.edu', serviceName: 'Advising', waitMinutes: 12 },
    { userEmail: 'other@uh.edu', serviceName: 'Registrar', waitMinutes: 4 },
  ],
  summary: [
    { label: 'Total entries', value: 2 },
    { label: 'Average wait', value: 8 },
  ],
};

function lines(csv) {
  return csv.split('\n');
}

describe('toCsv', () => {
  it('writes the header row from the column labels, in column order', () => {
    expect(lines(toCsv(REPORT))[0]).toBe('User,Service,Wait (min)');
  });

  it('writes one line per row, with values in column order', () => {
    const [, first, second] = lines(toCsv(REPORT));

    expect(first).toBe('student@uh.edu,Advising,12');
    expect(second).toBe('other@uh.edu,Registrar,4');
  });

  it('separates the summary from the table with a blank line', () => {
    const output = lines(toCsv(REPORT));

    expect(output[3]).toBe('');
    expect(output[4]).toBe('Total entries,2');
    expect(output[5]).toBe('Average wait,8');
  });

  it('omits the summary block entirely when there are no footer stats', () => {
    const csv = toCsv({ ...REPORT, summary: [] });

    expect(csv).not.toContain('\n\n');
    expect(lines(csv).filter((line) => line === '')).toHaveLength(1); // trailing newline only
  });

  it('quotes a value containing a comma so it stays in one column', () => {
    const csv = toCsv({
      ...REPORT,
      rows: [{ userEmail: 'student@uh.edu', serviceName: 'Advising, North', waitMinutes: 12 }],
    });

    expect(lines(csv)[1]).toBe('student@uh.edu,"Advising, North",12');
  });

  it('doubles an embedded double quote', () => {
    const csv = toCsv({
      ...REPORT,
      rows: [{ userEmail: 'student@uh.edu', serviceName: 'The "Fast" Lane', waitMinutes: 12 }],
    });

    expect(lines(csv)[1]).toBe('student@uh.edu,"The ""Fast"" Lane",12');
  });

  it('quotes a value containing a newline instead of breaking the row', () => {
    const csv = toCsv({
      ...REPORT,
      rows: [{ userEmail: 'student@uh.edu', serviceName: 'Advising\nAnnex', waitMinutes: 12 }],
    });

    expect(csv).toContain('"Advising\nAnnex"');
  });

  it('escapes a summary label too, not just the table', () => {
    // The summary block goes through a separate stringifier from the table,
    // so it needs its own escaping check.
    const csv = toCsv({
      ...REPORT,
      rows: [],
      summary: [{ label: 'Total served, all services', value: 5 }],
    });

    expect(lines(csv)[2]).toBe('"Total served, all services",5');
  });

  it('still emits the header row when the result set is empty', () => {
    const csv = toCsv({ ...REPORT, rows: [], summary: [] });

    expect(csv).toBe('User,Service,Wait (min)\n');
  });

  it('renders a missing or null value as an empty field without shifting columns', () => {
    const csv = toCsv({
      ...REPORT,
      rows: [{ userEmail: 'student@uh.edu', waitMinutes: null }],
    });

    expect(lines(csv)[1]).toBe('student@uh.edu,,');
  });

  it('exports a completely different report without changes', () => {
    // Proves the exporter is driven by the payload, not by the participation
    // report it was first written against.
    const csv = toCsv({
      title: 'Service Activity',
      generatedAt: '2026-08-13T18:04:00.000Z',
      filters: {},
      columns: [
        { key: 'name', label: 'Service' },
        { key: 'totalServed', label: 'Served' },
      ],
      rows: [{ name: 'Financial Aid', totalServed: 31 }],
      summary: [],
    });

    expect(csv).toBe('Service,Served\nFinancial Aid,31\n');
  });

  it('survives a report with no columns rather than throwing', () => {
    expect(toCsv({ columns: [], rows: [], summary: [{ label: 'Total entries', value: 0 }] }))
      .toBe('\nTotal entries,0\n');
  });
});
