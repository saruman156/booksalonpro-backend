const payrollRepository = require("../repositories/payroll.repository");

async function createPayrollPeriod(req, res, next) {
  try {
    const { startDate, endDate, note } = req.body || {};

    const data = await payrollRepository.createPayrollPeriod({
      startDate,
      endDate,
      note: note || null,
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

async function getPayrollPeriods(req, res, next) {
  try {
    const data = await payrollRepository.getPayrollPeriods();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function generatePayroll(req, res, next) {
  try {
    const { payrollPeriodId } = req.body || {};

    const data = await payrollRepository.generatePayroll({
      payrollPeriodId,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getPayrollSummary(req, res, next) {
  try {
    const { payrollPeriodId } = req.params;

    const data = await payrollRepository.getPayrollSummary({
      payrollPeriodId,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getPayrollStaffDetail(req, res, next) {
  try {
    const { payrollStaffId } = req.params;

    const data = await payrollRepository.getPayrollStaffDetail({
      payrollStaffId,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function updatePayrollStaffAdjustment(req, res, next) {
  try {
    const { payrollStaffId } = req.params;
    const { tipAmount, bonus, deduction } = req.body || {};

    const data = await payrollRepository.updatePayrollStaffAdjustment({
      payrollStaffId,
      tipAmount,
      bonus,
      deduction,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function markPayrollPaid(req, res, next) {
  try {
    const { payrollStaffId } = req.params;
    const { paymentMethod, paymentNote } = req.body || {};

    const data = await payrollRepository.markPayrollPaid({
      payrollStaffId,
      paymentMethod,
      paymentNote,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function markPayrollPeriodPaid(req, res, next) {
  try {
    const { payrollPeriodId } = req.params;

    const data = await payrollRepository.markPayrollPeriodPaid({
      payrollPeriodId,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createPayrollPeriod,
  getPayrollPeriods,
  generatePayroll,
  getPayrollSummary,
  getPayrollStaffDetail,
  updatePayrollStaffAdjustment,
  markPayrollPaid,
  markPayrollPeriodPaid,
};