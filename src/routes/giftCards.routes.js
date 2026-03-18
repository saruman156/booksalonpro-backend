const express = require("express");
const router = express.Router();

const giftCardsController = require("../controllers/giftCards.controller");

router.post("/", giftCardsController.createGiftCard);
router.get("/code/:code", giftCardsController.getGiftCardByCode);
router.get("/:id", giftCardsController.getGiftCardById);
router.post("/:id/redeem", giftCardsController.redeemGiftCard);

module.exports = router;