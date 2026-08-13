// Reporting module routes (owner: Armaan)
//
// Three reports, one shape. Every report function returns the same payload
// (Shared Contract #1), so these handlers are identical apart from which
// query they call and what the downloaded file is named — the format and
// filter handling is written once.
//
//   GET /api/reports/participation  — users and their queue participation
//   GET /api/reports/services       — service details and queue activity
//   GET /api/reports/summary        — usage statistics
//
// All three are administrator-only: they read across every user's history.
// Query params on all three: from, to (YYYY-MM-DD), serviceId, and
// format (json | csv).

import { Router } from 'express';
import { adminOnly } from '../middleware/auth.js';
import { toCsv, toPdf } from '../services/reportExport.js';
import {
  ApiError,
  optionalIsoDate,
  optionalPositiveId,
  requireOneOf,
} from '../validators.js';

const router = Router();

const FORMATS = ['json', 'csv', 'pdf'];

function parseFilters(query) {
  const from = optionalIsoDate(query.from, 'from');
  const to = optionalIsoDate(query.to, 'to');

  // Compared as strings, which is safe for YYYY-MM-DD. A backwards range
  // returns nothing at all, so telling the admin beats an empty report they
  // have to debug.
  if (from && to && from > to) {
    throw new ApiError(400, 'from must be on or before to');
  }

  return { from, to, serviceId: optionalPositiveId(query.serviceId, 'serviceId') };
}

function parseFormat(query) {
  const format = query.format === undefined || query.format === '' ? 'json' : query.format;
  requireOneOf(format, 'format', FORMATS);
  return format;
}

// Exported for testing: the frontend's apiDownload() reads this name back out
// of the Content-Disposition header, so both ends of that contract are pinned
// by one assertion.
export function downloadName(slug, extension) {
  const today = new Date().toISOString().slice(0, 10);
  return `queuesmart-${slug}-${today}.${extension}`;
}

// The report queries live in server/services/reportService.js (owner:
// Uchenna). They are loaded on demand rather than imported at the top of the
// file so that, until that module merges, these routes fail on their own
// instead of stopping the whole server from booting and taking everyone
// else's work down with it. Nothing here is stubbed with sample data — a fake
// that quietly diverges from the real queries is worse than a clear failure.
//
// Once reportService.js lands this resolves normally and the 503 disappears
// with no change here.
async function loadReportService() {
  try {
    return await import('../services/reportService.js');
  } catch (error) {
    const missing =
      error.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find module|Failed to load/.test(error.message);
    if (missing) {
      throw new ApiError(503, 'Report data layer is not available yet');
    }
    // A real fault inside the module is not the same thing as the module being
    // absent, and must not be reported as if we were still waiting on it.
    throw error;
  }
}

function reportHandler(reportName, slug) {
  return async (req, res) => {
    // Validation runs before the data layer is touched, so a bad filter is a
    // 400 rather than a query that quietly returns the wrong rows.
    const filters = parseFilters(req.query);
    const format = parseFormat(req.query);

    const reportService = await loadReportService();
    const report = reportService[reportName](filters);

    if (format === 'json') {
      return res.json(report);
    }

    if (format === 'pdf') {
      // Awaited here rather than piped straight to the response so that a
      // failure mid-render is still a JSON error, not a truncated file the
      // browser has already started saving.
      const pdf = await toPdf(report);

      res.type('application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName(slug, 'pdf')}"`);
      return res.send(pdf);
    }

    res.type('text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName(slug, 'csv')}"`);
    return res.send(toCsv(report));
  };
}

router.get('/participation', adminOnly, reportHandler('participationReport', 'participation'));
router.get('/services', adminOnly, reportHandler('serviceActivityReport', 'services'));
router.get('/summary', adminOnly, reportHandler('usageStatisticsReport', 'summary'));

export default router;
