const commissionsRepository = require("../repositories/commissions.repository");

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

async function generateCommissionsForAppointment(req, res) {
  try {
    const { id } = req.params;

    const rows = await commissionsRepository.generateCommissionsForAppointment(id);

    return res.json({
      data: rows,
    });
  } catch (error) {
    console.error("generateCommissionsForAppointment error:", error);

    const message = error.message || "Failed to generate commissions";

    if (
      message.includes("not found") ||
      message.includes("PAID")
    ) {
      return sendError(res, 400, "VALIDATION_ERROR", message);
    }

    return sendError(res, 500, "INTERNAL_ERROR", "Failed to generate commissions");
  }
}

async function getCommissionsByAppointment(req, res) {
  try {
    const { id } = req.params;
    const rows = await commissionsRepository.getCommissionsByAppointment(id);

    return res.json({
      data: rows,
    });
  } catch (error) {
    console.error("getCommissionsByAppointment error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch commissions");
  }
}

async function getCommissionSummaryByStaff(req, res) {
  try {
    const { from, to, staffId } = req.query;

    if (!from || !to) {
      return sendError(res, 400, "VALIDATION_ERROR", "from and to are required");
    }

    const rows = await commissionsRepository.getCommissionSummaryByStaff({
      from,
      to,
      staffId: staffId || null,
    });

    return res.json({
      data: rows,
    });
  } catch (error) {
    console.error("getCommissionSummaryByStaff error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch commission summary");
  }
}

module.exports = {
  generateCommissionsForAppointment,
  getCommissionsByAppointment,
  getCommissionSummaryByStaff,
};