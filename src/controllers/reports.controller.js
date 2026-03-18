const reportsRepository = require('../repositories/reports.repository');

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

async function getDashboardSummary(req, res) {
  try {
    const data = await reportsRepository.getDashboardSummary({
      date: req.query.date || null,
    });

    return res.json({ data });
  } catch (error) {
    console.error('getDashboardSummary error:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', error.message || 'Failed to fetch dashboard summary');
  }
}

async function getOwnerReport(req, res) {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'from and to are required');
    }

    const data = await reportsRepository.getOwnerReport({ from, to });
    return res.json({ data });
  } catch (error) {
    console.error('getOwnerReport error:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', error.message || 'Failed to fetch owner report');
  }
}

module.exports = {
  getDashboardSummary,
  getOwnerReport,
};
