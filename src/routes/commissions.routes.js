const express = require("express");
const router = express.Router();

const commissionsController = require("../controllers/commissions.controller");

router.post("/appointments/:id/generate", commissionsController.generateCommissionsForAppointment);
router.get("/appointments/:id", commissionsController.getCommissionsByAppointment);
router.get("/summary", commissionsController.getCommissionSummaryByStaff);

module.exports = router;