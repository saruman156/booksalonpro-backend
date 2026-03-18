const express = require("express");
const router = express.Router();

const appointmentsController = require("../controllers/appointments.controller");

router.get("/calendar", appointmentsController.getCalendarAppointments);
router.get("/:id", appointmentsController.getAppointmentById);
router.post("/", appointmentsController.createAppointment);

router.post("/:id/check-in", appointmentsController.checkInAppointment);
router.post("/:id/start", appointmentsController.startAppointment);
router.post("/:id/complete", appointmentsController.completeAppointment);

router.post(
  "/participants/:id/services",
  appointmentsController.addServiceToParticipant
);

router.patch(
  "/service-lines/:id",
  appointmentsController.updateAppointmentServiceLine
);

router.post(
  "/service-lines/:id/reassign",
  appointmentsController.reassignAppointmentService
);

router.post(
  "/service-lines/:id/complete",
  appointmentsController.completeAppointmentService
);

router.post(
  "/service-lines/:id/cancel",
  appointmentsController.cancelAppointmentServiceLine
);

router.post("/:id/checkout", appointmentsController.checkoutAppointmentV2);

module.exports = router;