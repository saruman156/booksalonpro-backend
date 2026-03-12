const express = require("express");
const router = express.Router();
const pool = require("../db");

function isValidRole(role) {
  return ["OWNER", "MANAGER", "STAFF", "RECEPTIONIST"].includes(role);
}

function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function formatUSPhone(digits) {
  const d = normalizePhone(digits);
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return d;
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

    res.set("Cache-Control", "no-store");
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

// POST /staff
router.post("/staff", async (req, res) => {
  try {
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

    const isUS = phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith("1"));
    if (!isUS) {
      return res.status(422).json({
        error: {
          code: "VALIDATION",
          message: "phone must be a valid US number (10 digits, or 11 digits starting with 1)",
        },
      });
    }

    const id = phoneDigits.length === 11 ? phoneDigits.slice(1) : phoneDigits;

    const exists = await pool.query(`select id from staff where id = $1 limit 1`, [id]);
    if (exists.rows.length > 0) {
      return res.status(409).json({
        error: { code: "DUPLICATE", message: "This phone number already exists" },
      });
    }

    const result = await pool.query(
      `
      insert into staff (
        id,
        first_name,
        last_name,
        email,
        phone,
        role,
        color,
        is_active,
        availability,
        available_service_categories,
        password_hash,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, now(), now()
      )
      returning
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
      `,
      [
        id,
        String(firstName).trim(),
        String(lastName).trim(),
        email ? String(email).trim() : null,
        formatUSPhone(id),
        role,
        color,
        Boolean(isActive),
        JSON.stringify(Array.isArray(availability) ? availability : []),
        JSON.stringify(Array.isArray(availableServiceCategories) ? availableServiceCategories : []),
        null,
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error("POST /staff error:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to create staff",
      },
    });
  }
});

// PATCH /staff/:id
router.patch("/staff/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(`select * from staff where id = $1 limit 1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Staff not found" },
      });
    }

    const current = existing.rows[0];

    if (req.body && req.body.id) delete req.body.id;

    if (req.body && req.body.phone !== undefined && req.body.phone !== null) {
      const incomingDigits = normalizePhone(req.body.phone);
      const incomingId =
        incomingDigits.length === 11 && incomingDigits.startsWith("1")
          ? incomingDigits.slice(1)
          : incomingDigits;

      if (incomingId && incomingId !== id) {
        return res.status(409).json({
          error: {
            code: "PHONE_ID_LOCKED",
            message: "Phone is used as Staff ID. Create a new staff record if you need to change phone.",
          },
        });
      }
      req.body.phone = formatUSPhone(id);
    }

    const next = {
      firstName:
        req.body.firstName !== undefined ? String(req.body.firstName).trim() : current.first_name,
      lastName:
        req.body.lastName !== undefined ? String(req.body.lastName).trim() : current.last_name,
      email:
        req.body.email !== undefined
          ? req.body.email === null || req.body.email === ""
            ? null
            : String(req.body.email).trim()
          : current.email,
      phone:
        req.body.phone !== undefined
          ? req.body.phone
          : current.phone,
      role:
        req.body.role !== undefined ? req.body.role : current.role,
      color:
        req.body.color !== undefined ? req.body.color : current.color,
      isActive:
        req.body.isActive !== undefined ? Boolean(req.body.isActive) : current.is_active,
      availability:
        req.body.availability !== undefined ? req.body.availability : current.availability,
      availableServiceCategories:
        req.body.availableServiceCategories !== undefined
          ? req.body.availableServiceCategories
          : current.available_service_categories,
    };

    if (next.role && !isValidRole(next.role)) {
      return res.status(422).json({
        error: { code: "VALIDATION", message: "role is invalid" },
      });
    }

    const result = await pool.query(
      `
      update staff
      set
        first_name = $2,
        last_name = $3,
        email = $4,
        phone = $5,
        role = $6,
        color = $7,
        is_active = $8,
        availability = $9::jsonb,
        available_service_categories = $10::jsonb,
        updated_at = now()
      where id = $1
      returning
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
      `,
      [
        id,
        next.firstName,
        next.lastName,
        next.email,
        next.phone,
        next.role,
        next.color,
        next.isActive,
        JSON.stringify(Array.isArray(next.availability) ? next.availability : []),
        JSON.stringify(
          Array.isArray(next.availableServiceCategories) ? next.availableServiceCategories : []
        ),
      ]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("PATCH /staff/:id error:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to update staff",
      },
    });
  }
});

// POST /staff/:id/archive
router.post("/staff/:id/archive", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      update staff
      set
        is_active = false,
        updated_at = now()
      where id = $1
      returning
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
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Staff not found" },
      });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("POST /staff/:id/archive error:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to archive staff",
      },
    });
  }
});

module.exports = router;