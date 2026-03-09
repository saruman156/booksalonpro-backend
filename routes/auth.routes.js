const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { loadStaff, saveStaff } = require("../stores/staffStore"); // bạn đã làm kiểu store rồi

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = "7d";

function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function signToken(staff) {
  return jwt.sign(
    { sub: staff.id, role: staff.role, phone: staff.id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// POST /auth/set-password  (Option 1)
router.post("/auth/set-password", async (req, res) => {
  const { phone, password } = req.body || {};
  const id = normalizePhone(phone);

  if (!id) return res.status(422).json({ error: { code: "VALIDATION", message: "phone is required" } });
  if (!password || String(password).length < 6)
    return res.status(422).json({ error: { code: "VALIDATION", message: "password must be at least 6 characters" } });

  const staff = loadStaff();
  const idx = staff.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Staff not found" } });

  if (staff[idx].passwordHash) {
    return res.status(409).json({ error: { code: "PASSWORD_ALREADY_SET", message: "Password already set" } });
  }

  staff[idx].passwordHash = await bcrypt.hash(String(password), 10);
  staff[idx].updatedAt = new Date().toISOString();
  saveStaff(staff);

  return res.json({ data: { ok: true } });
});

// POST /auth/login
router.post("/auth/login", async (req, res) => {
  const { phone, password } = req.body || {};
  const id = normalizePhone(phone);

  if (!id || !password)
    return res.status(422).json({ error: { code: "VALIDATION", message: "phone and password are required" } });

  const staff = loadStaff();
  const user = staff.find((s) => s.id === id);
  if (!user) return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid phone or password" } });

  if (!user.passwordHash) {
    return res.status(403).json({ error: { code: "PASSWORD_NOT_SET", message: "Password not set. Please create one." } });
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid phone or password" } });

  const token = signToken(user);

  return res.json({
    data: {
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        color: user.color,
        isActive: user.isActive,
      },
    },
  });
});

module.exports = router;