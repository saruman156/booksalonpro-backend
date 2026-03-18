const express = require("express");
const router = express.Router();

const payrollController = require("../controllers/payroll.controller");
const requireAuth = require("../middlewares/requireAuth");
const requireRoles = require("../middlewares/requireRoles");

router.use(requireAuth);

router.get(
  "/periods",
  requireRoles("OWNER", "MANAGER"),
  payrollController.getPayrollPeriods
);

router.post(
  "/periods",
  requireRoles("OWNER"),
  payrollController.createPayrollPeriod
);

router.post(
  "/generate",
  requireRoles("OWNER"),
  payrollController.generatePayroll
);

router.get(
  "/:payrollPeriodId",
  requireRoles("OWNER", "MANAGER"),
  payrollController.getPayrollSummary
);

router.get(
  "/staff/:payrollStaffId",
  requireRoles("OWNER", "MANAGER"),
  payrollController.getPayrollStaffDetail
);

router.patch(
  "/staff/:payrollStaffId/adjustment",
  requireRoles("OWNER"),
  payrollController.updatePayrollStaffAdjustment
);

router.post(
  "/staff/:payrollStaffId/mark-paid",
  requireRoles("OWNER"),
  payrollController.markPayrollPaid
);

router.post(
  "/:payrollPeriodId/mark-paid",
  requireRoles("OWNER"),
  payrollController.markPayrollPeriodPaid
);

module.exports = router;