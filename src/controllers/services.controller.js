const servicesRepository = require("../repositories/services.repository");

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

async function listServices(req, res) {
  try {
    const rows = await servicesRepository.listServices();

    return res.json({
      data: rows,
    });
  } catch (error) {
    console.error("listServices error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch services");
  }
}

async function getServiceById(req, res) {
  try {
    const { id } = req.params;
    const service = await servicesRepository.getServiceById(id);

    if (!service) {
      return sendError(res, 404, "NOT_FOUND", "Service not found");
    }

    return res.json({
      data: service,
    });
  } catch (error) {
    console.error("getServiceById error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch service");
  }
}

async function createService(req, res) {
  try {
    const {
      name,
      category,
      duration_min,
      price,
      supply_charge,
      description,
    } = req.body;

    if (!name || !String(name).trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "Name is required");
    }

    if (!category || !String(category).trim()) {
      return sendError(res, 400, "VALIDATION_ERROR", "Category is required");
    }

    const parsedDuration = Number(duration_min ?? 30);
    const parsedPrice = Number(price ?? 0);
    const parsedSupplyCharge = Number(supply_charge ?? 0);

    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "duration_min must be a positive number"
      );
    }

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "price must be 0 or greater"
      );
    }

    if (Number.isNaN(parsedSupplyCharge) || parsedSupplyCharge < 0) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "supply_charge must be 0 or greater"
      );
    }

    const created = await servicesRepository.createService({
      name: String(name).trim(),
      category: String(category).trim(),
      duration_min: parsedDuration,
      price: parsedPrice,
      supply_charge: parsedSupplyCharge,
      description: description ? String(description).trim() : null,
    });

    return res.status(201).json({
      data: created,
    });
  } catch (error) {
    console.error("createService error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to create service");
  }
}

async function updateService(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      duration_min,
      price,
      supply_charge,
      description,
      is_active,
    } = req.body;

    const payload = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return sendError(res, 400, "VALIDATION_ERROR", "Name cannot be empty");
      }
      payload.name = String(name).trim();
    }

    if (category !== undefined) {
      if (!String(category).trim()) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Category cannot be empty"
        );
      }
      payload.category = String(category).trim();
    }

    if (duration_min !== undefined) {
      const parsedDuration = Number(duration_min);
      if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "duration_min must be a positive number"
        );
      }
      payload.duration_min = parsedDuration;
    }

    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "price must be 0 or greater"
        );
      }
      payload.price = parsedPrice;
    }

    if (supply_charge !== undefined) {
      const parsedSupplyCharge = Number(supply_charge);
      if (Number.isNaN(parsedSupplyCharge) || parsedSupplyCharge < 0) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "supply_charge must be 0 or greater"
        );
      }
      payload.supply_charge = parsedSupplyCharge;
    }

    if (description !== undefined) {
      payload.description = description ? String(description).trim() : null;
    }

    if (is_active !== undefined) {
      if (typeof is_active !== "boolean") {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "is_active must be boolean"
        );
      }
      payload.is_active = is_active;
    }

    const updated = await servicesRepository.updateService(id, payload);

    if (!updated) {
      return sendError(res, 404, "NOT_FOUND", "Service not found");
    }

    return res.json({
      data: updated,
    });
  } catch (error) {
    console.error("updateService error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to update service");
  }
}

async function archiveService(req, res) {
  try {
    const { id } = req.params;
    const archived = await servicesRepository.archiveService(id);

    if (!archived) {
      return sendError(res, 404, "NOT_FOUND", "Service not found");
    }

    return res.json({
      data: archived,
    });
  } catch (error) {
    console.error("archiveService error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to archive service");
  }
}

module.exports = {
  listServices,
  getServiceById,
  createService,
  updateService,
  archiveService,
};