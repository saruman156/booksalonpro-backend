const appointmentsRepository = require("../repositories/appointments.repository");

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

async function createAppointment(req, res) {
  try {
    const {
      appointmentDate,
      startAt,
      endAt,
      participants,
    } = req.body || {};

    if (!appointmentDate) {
      return sendError(res, 400, "VALIDATION_ERROR", "appointmentDate is required");
    }

    if (!startAt || !endAt) {
      return sendError(res, 400, "VALIDATION_ERROR", "startAt and endAt are required");
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      return sendError(res, 400, "VALIDATION_ERROR", "participants are required");
    }

    for (const participant of participants) {
      if (!participant.customerName || !String(participant.customerName).trim()) {
        return sendError(res, 400, "VALIDATION_ERROR", "participant.customerName is required");
      }

      if (!Array.isArray(participant.services) || participant.services.length === 0) {
        return sendError(res, 400, "VALIDATION_ERROR", "participant.services are required");
      }

      for (const line of participant.services) {
        if (!line.serviceId) {
          return sendError(res, 400, "VALIDATION_ERROR", "serviceId is required");
        }
      }
    }

    const created = await appointmentsRepository.createAppointment(req.body);

    return res.status(201).json({
      data: created,
    });
  } catch (error) {
    console.error("createAppointment error:", error);
    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      error.message || "Failed to create appointment"
    );
  }
}

async function getAppointmentById(req, res) {
  try {
    const { id } = req.params;
    const appointment = await appointmentsRepository.getAppointmentById(id);

    if (!appointment) {
      return sendError(res, 404, "NOT_FOUND", "Appointment not found");
    }

    return res.json({
      data: appointment,
    });
  } catch (error) {
    console.error("getAppointmentById error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch appointment");
  }
}

async function getCalendarAppointments(req, res) {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return sendError(res, 400, "VALIDATION_ERROR", "from and to are required");
    }

    const rows = await appointmentsRepository.getCalendarAppointments(from, to);

    return res.json({
      data: rows,
    });
  } catch (error) {
    console.error("getCalendarAppointments error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch calendar appointments");
  }
}

async function reassignAppointmentService(req, res) {
  try {
    const { id } = req.params;
    const {
      assignedStaffId,
      assignedStaffName,
      overrideReason,
      overrideByStaffId,
    } = req.body || {};

    if (!assignedStaffId || !String(assignedStaffId).trim()) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "assignedStaffId is required"
      );
    }

    if (!assignedStaffName || !String(assignedStaffName).trim()) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "assignedStaffName is required"
      );
    }

    const existing = await appointmentsRepository.getAppointmentServiceById(id);
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Appointment service not found");
    }

    const updated = await appointmentsRepository.reassignAppointmentService(id, {
      assignedStaffId: String(assignedStaffId).trim(),
      assignedStaffName: String(assignedStaffName).trim(),
      overrideReason: overrideReason ? String(overrideReason).trim() : null,
      overrideByStaffId: overrideByStaffId
        ? String(overrideByStaffId).trim()
        : null,
    });

    return res.json({
      data: updated,
    });
  } catch (error) {
    console.error("reassignAppointmentService error:", error);
    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to reassign appointment service"
    );
  }
}

async function completeAppointmentService(req, res) {
  try {
    const { id } = req.params;

    const existing = await appointmentsRepository.getAppointmentServiceById(id);
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Appointment service not found");
    }

    const updated = await appointmentsRepository.completeAppointmentService(id);

    return res.json({
      data: updated,
    });
  } catch (error) {
    console.error("completeAppointmentService error:", error);
    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to complete appointment service"
    );
  }
}

async function checkInAppointment(req, res) {
  try {
    const { id } = req.params;

    const existing = await appointmentsRepository.getAppointmentById(id);
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Appointment not found");
    }

    const updated = await appointmentsRepository.checkInAppointment(id);

    return res.json({
      data: updated,
    });
  } catch (error) {
    console.error("checkInAppointment error:", error);
    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to check in appointment"
    );
  }
}

async function startAppointment(req, res) {
  try {
    const { id } = req.params;

    const existing = await appointmentsRepository.getAppointmentById(id);
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Appointment not found");
    }

    const updated = await appointmentsRepository.startAppointment(id);

    return res.json({
      data: updated,
    });
  } catch (error) {
    console.error("startAppointment error:", error);
    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to start appointment"
    );
  }
}

async function completeAppointment(req, res) {
  try {
    const { id } = req.params;

    const existing = await appointmentsRepository.getAppointmentById(id);
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Appointment not found");
    }

    const check = await appointmentsRepository.canCompleteAppointment(id);

    if (!check || Number(check.total) === 0) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Appointment has no service lines"
      );
    }

    if (Number(check.incomplete) > 0) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Cannot complete appointment while service lines are still active"
      );
    }

    const updated = await appointmentsRepository.completeAppointment(id);

    return res.json({
      data: updated,
    });
  } catch (error) {
    console.error("completeAppointment error:", error);
    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to complete appointment"
    );
  }
}

async function addServiceToParticipant(req, res) {
  try {
    const { id } = req.params;
    const {
      serviceId,
      assignedStaffId,
      assignedStaffName,
      isPrivateBooking,
      privateBookingStaffId,
      sequenceNo,
      parallelGroup,
      notes,
      durationMin,
      price,
      supplyCharge,
      status,
    } = req.body || {};

    if (!serviceId || !String(serviceId).trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "serviceId is required");
    }

    const participant = await appointmentsRepository.getAppointmentParticipantById(id);

    if (!participant) {
      return sendError(res, 404, "NOT_FOUND", "Appointment participant not found");
    }

    const created = await appointmentsRepository.addServiceToParticipant(id, {
      serviceId: String(serviceId).trim(),
      assignedStaffId: assignedStaffId ? String(assignedStaffId).trim() : null,
      assignedStaffName: assignedStaffName
        ? String(assignedStaffName).trim()
        : null,
      isPrivateBooking: Boolean(isPrivateBooking),
      privateBookingStaffId: privateBookingStaffId
        ? String(privateBookingStaffId).trim()
        : null,
      sequenceNo,
      parallelGroup,
      notes: notes ? String(notes).trim() : null,
      durationMin,
      price,
      supplyCharge,
      status: status || "SCHEDULED",
    });

    return res.status(201).json({
      data: created,
    });
  } catch (error) {
    console.error("addServiceToParticipant error:", error);

    const message = error.message || "Failed to add service to participant";

    if (
      message.includes("Cannot add service when appointment status is") ||
      message.includes("Service not found") ||
      message.includes("Appointment participant not found")
    ) {
      return sendError(res, 400, "VALIDATION_ERROR", message);
    }

    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to add service to participant"
    );
  }
}

async function updateAppointmentServiceLine(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const existing = await appointmentsRepository.getAppointmentServiceById(id);
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Appointment service not found");
    }

    if (body.durationMin !== undefined) {
      const parsed = Number(body.durationMin);
      if (Number.isNaN(parsed) || parsed <= 0) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "durationMin must be a positive number"
        );
      }
    }

    if (body.price !== undefined) {
      const parsed = Number(body.price);
      if (Number.isNaN(parsed) || parsed < 0) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "price must be 0 or greater"
        );
      }
    }

    if (body.supplyCharge !== undefined) {
      const parsed = Number(body.supplyCharge);
      if (Number.isNaN(parsed) || parsed < 0) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "supplyCharge must be 0 or greater"
        );
      }
    }

    const updated = await appointmentsRepository.updateAppointmentServiceLine(id, {
      assignedStaffId:
        body.assignedStaffId !== undefined
          ? body.assignedStaffId
            ? String(body.assignedStaffId).trim()
            : null
          : undefined,
      assignedStaffName:
        body.assignedStaffName !== undefined
          ? body.assignedStaffName
            ? String(body.assignedStaffName).trim()
            : null
          : undefined,
      isPrivateBooking:
        body.isPrivateBooking !== undefined ? Boolean(body.isPrivateBooking) : undefined,
      privateBookingStaffId:
        body.privateBookingStaffId !== undefined
          ? body.privateBookingStaffId
            ? String(body.privateBookingStaffId).trim()
            : null
          : undefined,
      sequenceNo: body.sequenceNo,
      parallelGroup: body.parallelGroup,
      notes:
        body.notes !== undefined
          ? body.notes
            ? String(body.notes).trim()
            : null
          : undefined,
      durationMin: body.durationMin,
      price: body.price,
      supplyCharge: body.supplyCharge,
      status:
        body.status !== undefined ? String(body.status).trim() : undefined,
    });

    return res.json({
      data: updated,
    });
  } catch (error) {
    console.error("updateAppointmentServiceLine error:", error);
    const message = error.message || "Failed to update appointment service";

    if (message.includes("Appointment service not found")) {
      return sendError(res, 404, "NOT_FOUND", message);
    }

    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to update appointment service"
    );
  }
}

async function cancelAppointmentServiceLine(req, res) {
  try {
    const { id } = req.params;

    const existing = await appointmentsRepository.getAppointmentServiceById(id);
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Appointment service not found");
    }

    const canceled = await appointmentsRepository.cancelAppointmentServiceLine(id);

    return res.json({
      data: canceled,
    });
  } catch (error) {
    console.error("cancelAppointmentServiceLine error:", error);
    const message = error.message || "Failed to cancel appointment service";

    if (message.includes("Appointment service not found")) {
      return sendError(res, 404, "NOT_FOUND", message);
    }

    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      "Failed to cancel appointment service"
    );
  }
}

async function checkoutAppointment(req, res) {
  try {
    const { id } = req.params;
    const { paymentMethod, tip, taxRate, note } = req.body || {};

    if (!paymentMethod) {
      return sendError(res, 400, "VALIDATION_ERROR", "paymentMethod is required");
    }

    const result = await appointmentsRepository.checkoutAppointment(id, {
      paymentMethod,
      tip,
      taxRate,
      note,
      createdByStaffId: req.user?.id || null,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error("checkoutAppointment error:", error);

    const message = error.message || "Checkout failed";

    if (
      message.includes("not found") ||
      message.includes("Cannot checkout") ||
      message.includes("All services must be completed")
    ) {
      return sendError(res, 400, "VALIDATION_ERROR", message);
    }

    return sendError(res, 500, "INTERNAL_ERROR", "Checkout failed");
  }
}

async function checkoutAppointmentV2(req, res) {
  try {
    const { id } = req.params;
    const { payments, tip, taxRate, note } = req.body || {};

    const result = await appointmentsRepository.checkoutAppointmentV2(id, {
      payments,
      tip,
      taxRate,
      note,
      createdByStaffId: req.user?.id || null,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error("checkoutAppointmentV2 error:", error);

    const message = error.message || "Checkout failed";

    if (
      message.includes("not found") ||
      message.includes("Cannot checkout") ||
      message.includes("All services must be completed") ||
      message.includes("Payment total") ||
      message.includes("required") ||
      message.includes("Insufficient") ||
      message.includes("expired") ||
      message.includes("redeemable") ||
      message.includes("no service lines")
    ) {
      return sendError(res, 400, "VALIDATION_ERROR", message);
    }

    return sendError(res, 500, "INTERNAL_ERROR", "Checkout failed");
  }
}

module.exports = {
  createAppointment,
  getAppointmentById,
  getCalendarAppointments,
  reassignAppointmentService,
  completeAppointmentService,
  checkInAppointment,
  startAppointment,
  completeAppointment,
  addServiceToParticipant,
  updateAppointmentServiceLine,
  cancelAppointmentServiceLine,
  checkoutAppointmentV2,
};