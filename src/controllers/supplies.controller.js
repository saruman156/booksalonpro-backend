const suppliesRepository = require("../repositories/supplies.repository");

async function getSupplies(req, res, next) {
  try {
    const data = await suppliesRepository.getSupplies();
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function createSupply(req, res, next) {
  try {
    const data = await suppliesRepository.createSupply(req.body || {});
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

async function updateSupply(req, res, next) {
  try {
    const { supplyId } = req.params;
    const data = await suppliesRepository.updateSupply({
      supplyId,
      ...(req.body || {}),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function createServiceSupplyUsage(req, res, next) {
  try {
    const data = await suppliesRepository.createServiceSupplyUsage(req.body || {});
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
}

async function getSupplySummary(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await suppliesRepository.getSupplySummary({ from, to });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSupplies,
  createSupply,
  updateSupply,
  createServiceSupplyUsage,
  getSupplySummary,
};