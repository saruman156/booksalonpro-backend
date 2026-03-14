const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

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

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      select
        id,
        first_name as "firstName",
        last_name as "lastName",
        trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as "fullName",
        phone,
        phone_digits as "phoneDigits",
        email,
        birthday,
        notes,
        internal_notes as "internalNotes",
        loyalty_points as "loyaltyPoints",
        visit_count as "visitCount",
        total_spent as "totalSpent",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from customers
      where is_active = true
      order by created_at desc
    `);

    res.json({ data: result.rows });
  } catch (error) {
    console.error("GET /customers error:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to load customers",
      },
    });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json({ data: [] });
    }

    const qDigits = normalizePhone(q);
    const qLike = `%${q.toLowerCase()}%`;

    let result;

    if (qDigits) {
      result = await pool.query(
        `
        select
          id,
          first_name as "firstName",
          last_name as "lastName",
          trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as "fullName"",
          phone,
          phone_digits as "phoneDigits",
          email,
          birthday,
          notes,
          internal_notes as "internalNotes",
          loyalty_points as "loyaltyPoints",
          visit_count as "visitCount",
          total_spent as "totalSpent",
          is_active as "isActive",
          created_at as "createdAt",
          updated_at as "updatedAt"
        from customers
        where is_active = true
          and (
            phone_digits like $1
            or lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) like $2
            or lower(coalesce(email, '')) like $2
          )
        order by
          case when phone_digits = $3 then 0 else 1 end,
          created_at desc
        limit 20
        `,
        [`%${qDigits}%`, qLike, qDigits]
      );
    } else {
      result = await pool.query(
        `
        select
          id,
          first_name as "firstName",
          last_name as "lastName",
          trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as "fullName"",
          phone,
          phone_digits as "phoneDigits",
          email,
          birthday,
          notes,
          internal_notes as "internalNotes",
          loyalty_points as "loyaltyPoints",
          visit_count as "visitCount",
          total_spent as "totalSpent",
          is_active as "isActive",
          created_at as "createdAt",
          updated_at as "updatedAt"
        from customers
        where is_active = true
          and (
            lower(full_name) like $1
            or lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) like $1
          )
        order by created_at desc
        limit 20
        `,
        [qLike]
      );
    }

    res.json({ data: result.rows });
  } catch (error) {
    console.error("GET /customers/search error:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to search customers",
      },
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      firstName = null,
      lastName = null,
      phone = null,
      email = null,
      birthday = null,
      notes = null,
      internalNotes = null,
      loyaltyPoints = 0,
      visitCount = 0,
      totalSpent = 0,
      isActive = true,
    } = req.body || {};

    const phoneDigits = normalizePhone(phone);
    if (!phoneDigits) {
      return res.status(422).json({
        error: {
          code: "VALIDATION",
          message: "phone is required",
        },
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

    const normalizedDigits = phoneDigits.length === 11 ? phoneDigits.slice(1) : phoneDigits;

    const existing = await pool.query(
      `
      select id
      from customers
      where phone_digits = $1
      limit 1
      `,
      [normalizedDigits]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: {
          code: "DUPLICATE",
          message: "A customer with this phone number already exists",
        },
      });
    }

    const result = await pool.query(
      `
      insert into customers (
        first_name,
        last_name,
        phone,
        phone_digits,
        email,
        birthday,
        notes,
        internal_notes,
        loyalty_points,
        visit_count,
        total_spent,
        is_active,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now()
      )
      returning
        id,
        first_name as "firstName",
        last_name as "lastName",
        trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as "fullName"",
        phone,
        phone_digits as "phoneDigits",
        email,
        birthday,
        notes,
        internal_notes as "internalNotes",
        loyalty_points as "loyaltyPoints",
        visit_count as "visitCount",
        total_spent as "totalSpent",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      `,
      [
        firstName ? String(firstName).trim() : null,
        lastName ? String(lastName).trim() : null,
        formatUSPhone(normalizedDigits),
        normalizedDigits,
        email ? String(email).trim() : null,
        birthday || null,
        notes ? String(notes).trim() : null,
        internalNotes ? String(internalNotes).trim() : null,
        Number(loyaltyPoints || 0),
        Number(visitCount || 0),
        Number(totalSpent || 0),
        Boolean(isActive),
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error("POST /customers error:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to create customer",
      },
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query(`select * from customers where id = $1 limit 1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Customer not found",
        },
      });
    }

    const current = existing.rows[0];

    let nextPhoneDigits = current.phone_digits;
    let nextPhone = current.phone;

    if (req.body.phone !== undefined && req.body.phone !== null && req.body.phone !== "") {
      const incomingDigits = normalizePhone(req.body.phone);
      if (!incomingDigits) {
        return res.status(422).json({
          error: {
            code: "VALIDATION",
            message: "phone is invalid",
          },
        });
      }

      const normalizedDigits =
        incomingDigits.length === 11 && incomingDigits.startsWith("1")
          ? incomingDigits.slice(1)
          : incomingDigits;

      if (normalizedDigits !== current.phone_digits) {
        const duplicate = await pool.query(
          `select id from customers where phone_digits = $1 and id <> $2 limit 1`,
          [normalizedDigits, id]
        );

        if (duplicate.rows.length > 0) {
          return res.status(409).json({
            error: {
              code: "DUPLICATE",
              message: "Another customer with this phone number already exists",
            },
          });
        }
      }

      nextPhoneDigits = normalizedDigits;
      nextPhone = formatUSPhone(normalizedDigits);
    }

    const result = await pool.query(
      `
      update customers
      set
        first_name = $2,
        last_name = $3,
        phone = $4,
        phone_digits = $5,
        email = $6,
        birthday = $7,
        notes = $8,
        internal_notes = $9,
        loyalty_points = $10,
        visit_count = $11,
        total_spent = $12,
        is_active = $13,
        updated_at = now()
      where id = $1
      returning
        id,
        first_name as "firstName",
        last_name as "lastName",
        trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as "fullName"",
        phone,
        phone_digits as "phoneDigits",
        email,
        birthday,
        notes,
        internal_notes as "internalNotes",
        loyalty_points as "loyaltyPoints",
        visit_count as "visitCount",
        total_spent as "totalSpent",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      `,
      [
        id,
        req.body.firstName !== undefined
          ? req.body.firstName === null || req.body.firstName === ""
            ? null
            : String(req.body.firstName).trim()
          : current.first_name,
        req.body.lastName !== undefined
          ? req.body.lastName === null || req.body.lastName === ""
            ? null
            : String(req.body.lastName).trim()
          : current.last_name,
        nextPhone,
        nextPhoneDigits,
        req.body.email !== undefined
          ? req.body.email === null || req.body.email === ""
            ? null
            : String(req.body.email).trim()
          : current.email,
        req.body.birthday !== undefined ? req.body.birthday || null : current.birthday,
        req.body.notes !== undefined
          ? req.body.notes === null || req.body.notes === ""
            ? null
            : String(req.body.notes).trim()
          : current.notes,
        req.body.internalNotes !== undefined
          ? req.body.internalNotes === null || req.body.internalNotes === ""
            ? null
            : String(req.body.internalNotes).trim()
          : current.internal_notes,
        req.body.loyaltyPoints !== undefined ? Number(req.body.loyaltyPoints || 0) : current.loyalty_points,
        req.body.visitCount !== undefined ? Number(req.body.visitCount || 0) : current.visit_count,
        req.body.totalSpent !== undefined ? Number(req.body.totalSpent || 0) : current.total_spent,
        req.body.isActive !== undefined ? Boolean(req.body.isActive) : current.is_active,
      ]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("PATCH /customers/:id error:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to update customer",
      },
    });
  }
});

router.post("/:id/archive", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      update customers
      set
        is_active = false,
        updated_at = now()
      where id = $1
      returning
        id,
        first_name as "firstName",
        last_name as "lastName",
        trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as "fullName"",
        phone,
        phone_digits as "phoneDigits",
        email,
        birthday,
        notes,
        internal_notes as "internalNotes",
        loyalty_points as "loyaltyPoints",
        visit_count as "visitCount",
        total_spent as "totalSpent",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Customer not found",
        },
      });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error("POST /customers/:id/archive error:", error);
    res.status(500).json({
      error: {
        code: "SERVER_ERROR",
        message: "Failed to archive customer",
      },
    });
  }
});

module.exports = router;
