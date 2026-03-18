const express = require("express");
const router = express.Router();

const suppliesController = require("../controllers/supplies.controller");
const requireAuth = require("../middlewares/requireAuth");
const requireRoles = require("../middlewares/requireRoles");

router.use(requireAuth);

router.get(
  "/",
  requireRoles("OWNER", "MANAGER"),
  suppliesController.getSupplies
);

router.post(
  "/",
  requireRoles("OWNER", "MANAGER"),
  suppliesController.createSupply
);

router.patch(
  "/:supplyId",
  requireRoles("OWNER", "MANAGER"),
  suppliesController.updateSupply
);

router.post(
  "/service-usage",
  requireRoles("OWNER", "MANAGER"),
  suppliesController.createServiceSupplyUsage
);

router.get(
  "/summary",
  requireRoles("OWNER", "MANAGER"),
  suppliesController.getSupplySummary
);

module.exports = router;