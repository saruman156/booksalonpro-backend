const { loadStaff, saveStaff } = require("../stores/staffStore");
const express = require("express");
const router = express.Router();
const pool = require("../db");
const fs = require("fs");
const path = require("path");

const STAFF_FILE = path.join(__dirname, "..", "data", "staff.json");

function loadStaffFromFile() {
  try {
    if (!fs.existsSync(STAFF_FILE)) return [];
    const raw = fs.readFileSync(STAFF_FILE, "utf-8");
    const data = JSON.parse(raw || "[]");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Failed to load staff.json:", e);
    return [];
  }
}

function saveStaffToFile(staffArr) {
  try {
    fs.writeFileSync(STAFF_FILE, JSON.stringify(staffArr, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save staff.json:", e);
  }
}

/** Keep only digits. Example: "(555) 333-4444" -> "5553334444" */
function normalizePhone(phone) {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
}

/** Format US 10-digit. "5553334444" -> "(555) 333-4444"
 * If not 10 digits, return original digits.
 */
function formatUSPhone(digits) {
  const d = normalizePhone(digits);
  if (d.length === 11 && d.startsWith("1")) {
    // "1" + 10 digits -> treat as US
    const ten = d.slice(1);
    return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return d; // fallback
}

function nowIso() {
  return new Date().toISOString();
}

function isValidRole(role) {
  return ["OWNER", "MANAGER", "STAFF", "RECEPTIONIST"].includes(role);
}

// Seed data: id = phoneDigits, phone = formatted
// ---- Shared in-memory staff store (global) ----
if (!global.__STAFF_STORE__) {
  global.__STAFF_STORE__ = [];
}

let staff = loadStaffFromFile();

// ---- Seed data (only once) ----
if (staff.length === 0) {
  staff.push(
    {
      id: normalizePhone("5551112222"),
      firstName: "Anna",
      lastName: "Nguyen",
      email: "anna@example.com",
      phone: formatUSPhone("5551112222"),
      role: "STAFF",
      color: "#8B5CF6",
      isActive: true,
      availability: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", breaks: [{ startTime: "12:00", endTime: "13:00" }] },
        { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", breaks: [] },
        { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", breaks: [] },
        { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", breaks: [] },
        { dayOfWeek: 5, startTime: "09:00", endTime: "18:00", breaks: [] },
      ],
      availableServiceCategories: [
        "manicure",
        "pedicure",
        "refill",
        "full_set",
        "dipping_powder",
        "repair_take_off",
        "acrylic_toenails",
        "kid",
        "polish_regular",
        "polish_gel",
        "eyelash",
        "waxing",
        "other",
      ],
      passwordHash: null,          // ✅ thêm field này
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: normalizePhone("(555) 333-4444"),
      firstName: "Linh",
      lastName: "Tran",
      email: "linh@example.com",
      phone: formatUSPhone("(555) 333-4444"),
      role: "RECEPTIONIST",
      color: "#3B82F6",
      isActive: true,
      availability: [
        { dayOfWeek: 1, startTime: "10:00", endTime: "19:00", breaks: [] },
        { dayOfWeek: 2, startTime: "10:00", endTime: "19:00", breaks: [] },
        { dayOfWeek: 3, startTime: "10:00", endTime: "19:00", breaks: [] },
        { dayOfWeek: 4, startTime: "10:00", endTime: "19:00", breaks: [] },
        { dayOfWeek: 5, startTime: "10:00", endTime: "19:00", breaks: [] },
      ],
      availableServiceCategories: [],
      passwordHash: null,          // ✅ thêm field này
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
  );
}

// GET /staff?isActive=true|false
router.get("/staff", async (req, res) => {
  try {
    const { isActive } = req.query;

    let query = `
      select
        id,
        first_name as "firstName",
        last_name as "lastName",
        email,
        phone,
        role,
        color,
        is_active as "isActive",
        password_hash as "passwordHash",
        availability,
        available_service_categories as "availableServiceCategories",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from staff
    `;

    const values = [];

    if (isActive === "true" || isActive === "false") {
      query += ` where is_active = $1`;
      values.push(isActive === "true");
    }

    query += ` order by first_name asc, last_name asc`;

    const result = await pool.query(query, values);

    res.json({ data: result.rows });
  } catch (error) {
    console.error("GET /staff error:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to load staff",
      },
    });
  }
});

// POST /staff  (ID = phoneDigits)
router.post("/staff", (req, res) => {
  const {
    firstName,
    lastName,
    email = null,
    phone = null,
    role = "STAFF",
    color = "#8B5CF6",
    isActive = true,
    availability = [],
    availableServiceCategories = [],
  } = req.body || {};

  if (!firstName || !lastName) {
    return res.status(422).json({
      error: { code: "VALIDATION", message: "firstName and lastName are required" },
    });
  }

  if (role && !isValidRole(role)) {
    return res.status(422).json({
      error: { code: "VALIDATION", message: "role is invalid" },
    });
  }

  const phoneDigits = normalizePhone(phone);
  if (!phoneDigits) {
    return res.status(422).json({
      error: { code: "VALIDATION", message: "phone is required (used as staff id)" },
    });
  }

  // (Optional) enforce US 10 digits (or 11 starting with 1)
  const isUS = phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith("1"));
  if (!isUS) {
    return res.status(422).json({
      error: { code: "VALIDATION", message: "phone must be a valid US number (10 digits, or 11 digits starting with 1)" },
    });
  }

  const id = phoneDigits.length === 11 ? phoneDigits.slice(1) : phoneDigits; // store id as 10-digit
  const exists = staff.some((s) => s.id === id);
  if (exists) {
    return res.status(409).json({
      error: { code: "DUPLICATE", message: "This phone number already exists" },
    });
  }

  const newStaff = {
    id, // ✅ staff id = phone digits (10-digit)
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: email ? String(email).trim() : null,
    phone: formatUSPhone(id), // ✅ consistent display
    role,
    color,
    isActive: Boolean(isActive),
    availability: Array.isArray(availability) ? availability : [],
    availableServiceCategories: Array.isArray(availableServiceCategories) ? availableServiceCategories : [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  staff.push(newStaff);
  saveStaffToFile(staff); // ✅ đặt ở đây
  res.status(201).json({ data: newStaff });
});

// PATCH /staff/:id  (do NOT allow changing phone/id here)
router.patch("/staff/:id", (req, res) => {
  const { id } = req.params;
  const idx = staff.findIndex((s) => s.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Staff not found" } });
  }

  // Prevent id overwrite
  if (req.body && req.body.id) delete req.body.id;

  // If phone is provided and doesn't match id, block (because id = phoneDigits)
  if (req.body && req.body.phone !== undefined && req.body.phone !== null) {
    const incomingDigits = normalizePhone(req.body.phone);
    const incomingId = incomingDigits.length === 11 && incomingDigits.startsWith("1") ? incomingDigits.slice(1) : incomingDigits;

    if (incomingId && incomingId !== id) {
      return res.status(409).json({
        error: {
          code: "PHONE_ID_LOCKED",
          message: "Phone is used as Staff ID. Create a new staff record if you need to change phone.",
        },
      });
    }
    // Normalize display format if same phone
    req.body.phone = formatUSPhone(id);
  }

  const next = { ...staff[idx], ...req.body, updatedAt: nowIso() };

  if (next.role && !isValidRole(next.role)) {
    return res.status(422).json({
      error: { code: "VALIDATION", message: "role is invalid" },
    });
  }

  if (next.firstName) next.firstName = String(next.firstName).trim();
  if (next.lastName) next.lastName = String(next.lastName).trim();
  if (next.email !== undefined && next.email !== null) next.email = String(next.email).trim();

  staff[idx] = next;
  saveStaffToFile(staff);
  res.json({ data: staff[idx] });
});

// POST /staff/:id/archive  (soft delete)
router.post("/staff/:id/archive", (req, res) => {
  const { id } = req.params;
  const idx = staff.findIndex((s) => s.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Staff not found" } });
  }

  staff[idx] = { ...staff[idx], isActive: false, updatedAt: nowIso() };
  saveStaffToFile(staff);
  res.json({ data: staff[idx] });
});

module.exports = router;