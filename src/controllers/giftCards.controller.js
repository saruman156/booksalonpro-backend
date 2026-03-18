const giftCardsRepository = require("../repositories/giftCards.repository");

function sendError(res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

async function createGiftCard(req, res) {
  try {
    const {
      customerId,
      initialBalance,
      expiresAt,
      notes,
    } = req.body || {};

    const parsedBalance = Number(initialBalance || 0);

    if (Number.isNaN(parsedBalance) || parsedBalance <= 0) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "initialBalance must be greater than 0"
      );
    }

    const created = await giftCardsRepository.createGiftCard({
      customerId: customerId || null,
      initialBalance: parsedBalance,
      expiresAt: expiresAt || null,
      notes: notes ? String(notes).trim() : null,
      createdByStaffId: req.user?.id || null,
    });

    return res.status(201).json({
      data: created,
    });
  } catch (error) {
    console.error("createGiftCard error:", error);
    return sendError(
      res,
      500,
      "INTERNAL_ERROR",
      error.message || "Failed to create gift card"
    );
  }
}

async function getGiftCardById(req, res) {
  try {
    const { id } = req.params;
    const giftCard = await giftCardsRepository.getGiftCardById(id);

    if (!giftCard) {
      return sendError(res, 404, "NOT_FOUND", "Gift card not found");
    }

    return res.json({
      data: giftCard,
    });
  } catch (error) {
    console.error("getGiftCardById error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch gift card");
  }
}

async function getGiftCardByCode(req, res) {
  try {
    const { code } = req.params;
    const giftCard = await giftCardsRepository.getGiftCardByCode(code);

    if (!giftCard) {
      return sendError(res, 404, "NOT_FOUND", "Gift card not found");
    }

    return res.json({
      data: giftCard,
    });
  } catch (error) {
    console.error("getGiftCardByCode error:", error);
    return sendError(res, 500, "INTERNAL_ERROR", "Failed to fetch gift card");
  }
}

async function redeemGiftCard(req, res) {
  try {
    const { id } = req.params;
    const { amount, appointmentId, note } = req.body || {};

    const parsedAmount = Number(amount || 0);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "amount must be greater than 0"
      );
    }

    const result = await giftCardsRepository.redeemGiftCard(id, {
      amount: parsedAmount,
      appointmentId: appointmentId || null,
      note: note ? String(note).trim() : null,
      createdByStaffId: req.user?.id || null,
    });

    return res.json({
      data: result,
    });
  } catch (error) {
    console.error("redeemGiftCard error:", error);

    const message = error.message || "Failed to redeem gift card";

    if (
      message.includes("not found") ||
      message.includes("greater than 0") ||
      message.includes("expired") ||
      message.includes("Insufficient") ||
      message.includes("not redeemable")
    ) {
      return sendError(res, 400, "VALIDATION_ERROR", message);
    }

    return sendError(res, 500, "INTERNAL_ERROR", "Failed to redeem gift card");
  }
}

module.exports = {
  createGiftCard,
  getGiftCardById,
  getGiftCardByCode,
  redeemGiftCard,
};