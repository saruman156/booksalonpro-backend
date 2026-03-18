const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const requireAuth = require("../middlewares/requireAuth");

router.post("/login", authController.login);

router.post("/set-password", authController.setPassword);

router.get("/me", requireAuth, authController.me);

module.exports = router;