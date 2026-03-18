const pool = require("../db/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(422).json({
        error: { code: "VALIDATION", message: "phone and password required" }
      });
    }

    const phoneDigits = phone.replace(/\D/g, "");

    const result = await pool.query(
      `select * from staff where id = $1 limit 1`,
      [phoneDigits]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: { code: "INVALID_LOGIN", message: "Invalid phone or password" }
      });
    }

    const staff = result.rows[0];

    const valid = await bcrypt.compare(password, staff.password_hash || "");

    if (!valid) {
      return res.status(401).json({
        error: { code: "INVALID_LOGIN", message: "Invalid phone or password" }
      });
    }

    const token = jwt.sign(
      {
        id: staff.id,
        role: staff.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      data: {
        token,
        user: {
          id: staff.id,
          firstName: staff.first_name,
          lastName: staff.last_name,
          role: staff.role
        }
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({
      error: { code: "SERVER_ERROR", message: "Login failed" }
    });
  }
};


exports.me = async (req, res) => {

  const userId = req.user.id;

  const result = await pool.query(
    `
    select
      id,
      first_name as "firstName",
      last_name as "lastName",
      role
    from staff
    where id = $1
    `,
    [userId]
  );

  res.json({ data: result.rows[0] });
};


exports.setPassword = async (req, res) => {

  const { phone, password } = req.body;

  const phoneDigits = phone.replace(/\D/g, "");

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `
    update staff
    set password_hash = $2
    where id = $1
    `,
    [phoneDigits, hash]
  );

  res.json({ success: true });
};
