const pool = require("../db/pool");

function normalizeDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

async function getSupplies() {
  const result = await pool.query(`
    select *
    from supplies
    where is_active = true
    order by name asc
  `);

  return result.rows;
}

async function createSupply({
  name,
  sku = null,
  category = null,
  unit,
  brand = null,
  costPerUnit = 0,
  stockOnHand = 0,
  reorderLevel = 0,
  reorderQty = 0,
  note = null,
}) {
  const result = await pool.query(
    `
    insert into supplies (
      name,
      sku,
      category,
      unit,
      brand,
      cost_per_unit,
      stock_on_hand,
      reorder_level,
      reorder_qty,
      note
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    returning *
    `,
    [
      name,
      sku,
      category,
      unit,
      brand,
      Number(costPerUnit || 0),
      Number(stockOnHand || 0),
      Number(reorderLevel || 0),
      Number(reorderQty || 0),
      note,
    ]
  );

  return result.rows[0];
}

async function updateSupply({
  supplyId,
  name,
  sku,
  category,
  unit,
  brand,
  costPerUnit,
  stockOnHand,
  reorderLevel,
  reorderQty,
  isActive,
  note,
}) {
  const result = await pool.query(
    `
    update supplies
    set
      name = coalesce($2, name),
      sku = coalesce($3, sku),
      category = coalesce($4, category),
      unit = coalesce($5, unit),
      brand = coalesce($6, brand),
      cost_per_unit = coalesce($7, cost_per_unit),
      stock_on_hand = coalesce($8, stock_on_hand),
      reorder_level = coalesce($9, reorder_level),
      reorder_qty = coalesce($10, reorder_qty),
      is_active = coalesce($11, is_active),
      note = coalesce($12, note),
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      supplyId,
      name ?? null,
      sku ?? null,
      category ?? null,
      unit ?? null,
      brand ?? null,
      costPerUnit != null ? Number(costPerUnit) : null,
      stockOnHand != null ? Number(stockOnHand) : null,
      reorderLevel != null ? Number(reorderLevel) : null,
      reorderQty != null ? Number(reorderQty) : null,
      typeof isActive === "boolean" ? isActive : null,
      note ?? null,
    ]
  );

  return result.rows[0] || null;
}

async function createServiceSupplyUsage({
  serviceId,
  supplyId,
  qtyPerService,
  wastePct = 0,
  note = null,
}) {
  const result = await pool.query(
    `
    insert into service_supply_usage (
      service_id,
      supply_id,
      qty_per_service,
      waste_pct,
      note
    )
    values ($1,$2,$3,$4,$5)
    on conflict (service_id, supply_id)
    do update set
      qty_per_service = excluded.qty_per_service,
      waste_pct = excluded.waste_pct,
      note = excluded.note,
      updated_at = now()
    returning *
    `,
    [
      serviceId,
      supplyId,
      Number(qtyPerService || 0),
      Number(wastePct || 0),
      note,
    ]
  );

  return result.rows[0];
}

async function getSupplySummary({ from, to }) {
  const startDate = normalizeDate(from);
  const endDate = normalizeDate(to);

  const usageSql = `
    with completed_services as (
      select
        aps.service_id,
        count(*)::numeric as completed_count
      from appointment_services aps
      join appointments a on a.id = aps.appointment_id
      where a.appointment_date between $1::date and $2::date
        and coalesce(a.status, '') = 'COMPLETED'
        and coalesce(aps.status, '') <> 'CANCELED'
      group by aps.service_id
    ),
    estimated_usage as (
      select
        ssu.supply_id,
        sum(
          cs.completed_count
          * ssu.qty_per_service
          * (1 + coalesce(ssu.waste_pct, 0))
        ) as estimated_qty
      from service_supply_usage ssu
      join completed_services cs on cs.service_id = ssu.service_id
      group by ssu.supply_id
    )
    select
      sp.id,
      sp.name,
      sp.category,
      sp.unit,
      sp.stock_on_hand as "stockOnHand",
      sp.reorder_level as "reorderLevel",
      sp.reorder_qty as "reorderQty",
      sp.cost_per_unit as "costPerUnit",
      coalesce(eu.estimated_qty, 0) as "estimatedUsedQty",
      round(coalesce(eu.estimated_qty, 0) * sp.cost_per_unit, 2) as "estimatedUsageCost",
      case
        when sp.stock_on_hand <= sp.reorder_level then true
        else false
      end as "isLowStock",
      case
        when coalesce(eu.estimated_qty, 0) <= 0 then null
        else round(
          sp.stock_on_hand / (coalesce(eu.estimated_qty, 0) / greatest(($2::date - $1::date + 1), 1)),
          1
        )
      end as "forecastDaysLeft"
    from supplies sp
    left join estimated_usage eu on eu.supply_id = sp.id
    where sp.is_active = true
    order by "isLowStock" desc, "estimatedUsageCost" desc, sp.name asc
  `;

  const topConsumedSql = `
    with completed_services as (
      select
        aps.service_id,
        count(*)::numeric as completed_count
      from appointment_services aps
      join appointments a on a.id = aps.appointment_id
      where a.appointment_date between $1::date and $2::date
        and coalesce(a.status, '') = 'COMPLETED'
        and coalesce(aps.status, '') <> 'CANCELED'
      group by aps.service_id
    )
    select
      sp.id as "supplyId",
      sp.name,
      sp.unit,
      sum(
        cs.completed_count
        * ssu.qty_per_service
        * (1 + coalesce(ssu.waste_pct, 0))
      ) as "estimatedUsedQty",
      round(sum(
        cs.completed_count
        * ssu.qty_per_service
        * (1 + coalesce(ssu.waste_pct, 0))
      ) * sp.cost_per_unit, 2) as "estimatedUsageCost"
    from service_supply_usage ssu
    join supplies sp on sp.id = ssu.supply_id
    join completed_services cs on cs.service_id = ssu.service_id
    where sp.is_active = true
    group by sp.id, sp.name, sp.unit, sp.cost_per_unit
    order by "estimatedUsageCost" desc, "estimatedUsedQty" desc
    limit 10
  `;

  const [usageResult, topConsumedResult] = await Promise.all([
    pool.query(usageSql, [startDate, endDate]),
    pool.query(topConsumedSql, [startDate, endDate]),
  ]);

  return {
    range: { from: startDate, to: endDate },
    supplies: usageResult.rows,
    topConsumedSupplies: topConsumedResult.rows,
  };
}

module.exports = {
  getSupplies,
  createSupply,
  updateSupply,
  createServiceSupplyUsage,
  getSupplySummary,
};