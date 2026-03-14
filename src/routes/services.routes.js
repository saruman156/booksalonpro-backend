const express = require("express");
const servicesController = require("../controllers/services.controller");

const router = express.Router();

router.get("/", servicesController.listServices);
router.get("/:id", servicesController.getServiceById);
router.post("/", servicesController.createService);
router.patch("/:id", servicesController.updateService);
router.post("/:id/archive", servicesController.archiveService);

module.exports = router;