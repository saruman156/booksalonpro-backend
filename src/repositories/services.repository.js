const pool = require("../db/pool");

async function listServices() {
  const sql = `
    select
      id,
      name,
      category,
      duration_min,
      price,
      supply_charge,
      description,
      is_active,
      created_at,
      updated_at
    from services
    order by name asc
  `;

  const result = await pool.query(sql);
  return result.rows;
}

async function getServiceById(id) {
  const sql = `
    select
      id,
      name,
      category,
      duration_min,
      price,
      supply_charge,
      description,
      is_active,
      created_at,
      updated_at
    from services
    where id = $1
    limit 1
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0] || null;
}

async function createService({
  name,
  category,
  duration_min,
  price,
  supply_charge,
  description,
}) {
  const sql = `
    insert into services (
      name,
      category,
      duration_min,
      price,
      supply_charge,
      description
    )
    values ($1, $2, $3, $4, $5, $6)
    returning
      id,
      name,
      category,
      duration_min,
      price,
      supply_charge,
      description,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    name,
    category,
    duration_min,
    price,
    supply_charge,
    description,
  ];

  const result = await pool.query(sql, values);
  return result.rows[0];
}

async function updateService(
  id,
  { name, category, duration_min, price, supply_charge, description, is_active }
) {
  const sql = `
    update services
    set
      name = coalesce($2, name),
      category = coalesce($3, category),
      duration_min = coalesce($4, duration_min),
      price = coalesce($5, price),
      supply_charge = coalesce($6, supply_charge),
      description = coalesce($7, description),
      is_active = coalesce($8, is_active),
      updated_at = now()
    where id = $1
    returning
      id,
      name,
      category,
      duration_min,
      price,
      supply_charge,
      description,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    id,
    name ?? null,
    category ?? null,
    duration_min ?? null,
    price ?? null,
    supply_charge ?? null,
    description ?? null,
    typeof is_active === "boolean" ? is_active : null,
  ];

  const result = await pool.query(sql, values);
  return result.rows[0] || null;
}

async function archiveService(id) {
  const sql = `
    update services
    set
      is_active = false,
      updated_at = now()
    where id = $1
    returning
      id,
      name,
      category,
      duration_min,
      price,
      supply_charge,
      description,
      is_active,
      created_at,
      updated_at
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0] || null;
}

module.exports = {
  listServices,
  getServiceById,
  createService,
  updateService,
  archiveService,
};