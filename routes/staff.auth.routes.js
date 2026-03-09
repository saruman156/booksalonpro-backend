const { loadStaff, saveStaff } = require("../stores/staffStore");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// IMPORTANT: set in .env later
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = "7d";

// ---- Shared helpers (same normalize as staff.routes.js) ----
function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  // if "1" + 10 digits, keep last 10
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

// ---- In-memory store bridge ----
// Since you store staff in-memory in staff.routes.js, we need a shared module.
// QUICK FIX for now: attach to global.
// Better: move staff array to a shared file (staff.store.js).

function getStaffArray() {
  if (!global.__STAFF_STORE__) global.__STAFF_STORE__ = [];
  return global.__STAFF_STORE__;
}

// Create a token payload minimal
function signToken(staff) {
  return jwt.sign(
    { sub: staff.id, role: staff.role, phone: staff.id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * POST /staff/auth/set-password
 * Body: { phone, password }
 * - If staff has no passwordHash yet -> allow set
 * - If staff already has passwordHash -> require oldPassword (optional extension later)
 */
router.post("/staff/auth/set-password", async (req, res) => {
  const { phone, password } = req.body || {};
  const id = normalizePhone(phone);

  if (!id) {
    return res.status(422).json({ error: { code: "VALIDATION", message: "phone is required" } });
  }
  if (!password || String(password).length < 6) {
    return res.status(422).json({ error: { code: "VALIDATION", message: "password must be at least 6 characters" } });
  }

  const staffArr = getStaffArray();
  const idx = staffArr.findIndex((s) => s.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Staff not found" } });
  }

  // Only allow first-time set for now
  if (staffArr[idx].passwordHash) {
    return res.status(409).json({
      error: { code: "PASSWORD_ALREADY_SET", message: "Password already set. Use change-password." },
    });
  }

  const hash = await bcrypt.hash(String(password), 10);
  staffArr[idx] = { ...staffArr[idx], passwordHash: hash, updatedAt: new Date().toISOString() };

  return res.json({ data: { ok: true } });
});

/**
 * POST /staff/auth/login
 * Body: { phone, password }
 */
router.post("/staff/auth/login", async (req, res) => {
  const { phone, password } = req.body || {};
  const id = normalizePhone(phone);

  if (!id || !password) {
    return res.status(422).json({ error: { code: "VALIDATION", message: "phone and password are required" } });
  }

  const staffArr = getStaffArray();
  const staff = staffArr.find((s) => s.id === id);
  if (!staff) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid phone or password" } });
  }
  if (!staff.passwordHash) {
    return res.status(403).json({
      error: { code: "PASSWORD_NOT_SET", message: "Password not set. Please set password first." },
    });
  }

  const ok = await bcrypt.compare(String(password), staff.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid phone or password" } });
  }

  const token = signToken(staff);

  // return minimal staff profile
  return res.json({
    data: {
      token,
      staff: {
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        color: staff.color,
        isActive: staff.isActive,
      },
    },
  });
});

module.exports = router;