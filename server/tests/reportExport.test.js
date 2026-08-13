// The exporter is the one piece of the reporting module that every report and
// every format runs through, so it is tested on its own against the shared
// payload contract — no database, no routes, no report-specific knowledge.

import { describe, expect, it } from 'vitest';
import { describeFilters, toCsv, toPdf } from '../services/reportExport.js';

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

// The page tree in a PDF records its own size, which is the cheapest way to
// assert pagination without pulling in a parser just for one test.
function pageCount(pdf) {
  return Number(pdf.toString('latin1').match(/\/Count (\d+)/)?.[1]);
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

describe('describeFilters', () => {
  it('reads as a sentence when nothing was narrowed', () => {
    expect(describeFilters(REPORT.filters)).toBe('All time · All services');
  });

  it('states both ends of a date range', () => {
    expect(describeFilters({ from: '2026-08-01', to: '2026-08-31' }))
      .toBe('2026-08-01 to 2026-08-31 · All services');
  });

  it('states an open-ended range from only one bound', () => {
    expect(describeFilters({ from: '2026-08-01' })).toBe('From 2026-08-01 · All services');
    expect(describeFilters({ to: '2026-08-31' })).toBe('Up to 2026-08-31 · All services');
  });

  it('names the service rather than echoing its id', () => {
    expect(describeFilters({ serviceId: 4, serviceName: 'Financial Aid' }))
      .toBe('All time · Service: Financial Aid');
  });

  it('does not throw on a missing filters object', () => {
    expect(describeFilters(undefined)).toBe('All time · All services');
  });
});

describe('toPdf', () => {
  it('produces a readable PDF document', async () => {
    const pdf = await toPdf(REPORT);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-6).toString()).toContain('%%EOF');
  });

  it('exports a completely different report without changes', async () => {
    // Same guarantee the CSV exporter gives: driven by columns/rows, never by
    // the field names of one particular report.
    const pdf = await toPdf({
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

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('paginates a long report instead of running off the page', async () => {
    const rows = Array.from({ length: 400 }, (_, index) => ({
      userEmail: `student${index}@uh.edu`,
      serviceName: 'Advising',
      waitMinutes: index,
    }));

    const short = await toPdf(REPORT);
    const long = await toPdf({ ...REPORT, rows });

    expect(pageCount(short)).toBe(1);
    expect(pageCount(long)).toBeGreaterThan(1);
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('renders an empty report rather than throwing', async () => {
    const pdf = await toPdf({ columns: [], rows: [], summary: [] });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('leaves a null cell blank instead of printing "null"', async () => {
    const pdf = await toPdf({
      ...REPORT,
      summary: [],
      rows: [{ userEmail: 'student@uh.edu', serviceName: 'Advising', waitMinutes: null }],
    });

    expect(pdf.toString('latin1')).not.toContain('null');
  });
});
