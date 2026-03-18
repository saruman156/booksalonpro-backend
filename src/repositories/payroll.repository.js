const pool = require("../db/pool");

function normalizeDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

async function createPayrollPeriod({ startDate, endDate, note = null }) {
  const result = await pool.query(
    `
    insert into payroll_periods (
      start_date,
      end_date,
      note
    )
    values ($1::date, $2::date, $3)
    returning *
    `,
    [normalizeDate(startDate), normalizeDate(endDate), note]
  );

  return result.rows[0];
}

async function getPayrollPeriods() {
  const result = await pool.query(`
    select *
    from payroll_periods
    order by start_date desc, created_at desc
  `);

  return result.rows;
}

async function getPayrollPeriodById({ payrollPeriodId }) {
  const result = await pool.query(
    `
    select *
    from payroll_periods
    where id = $1
    limit 1
    `,
    [payrollPeriodId]
  );

  return result.rows[0] || null;
}

async function generatePayroll({ payrollPeriodId }) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const periodResult = await client.query(
      `
      select *
      from payroll_periods
      where id = $1
      limit 1
      `,
      [payrollPeriodId]
    );

    const period = periodResult.rows[0];
    if (!period) {
      throw new Error("Payroll period not found.");
    }

    if (period.status === "LOCKED" || period.status === "PAID") {
      throw new Error("This payroll period is already locked or paid.");
    }

    const existingPayrollResult = await client.query(
      `
      select count(*)::int as count
      from payroll_staff
      where payroll_period_id = $1
      `,
      [payrollPeriodId]
    );

    if (Number(existingPayrollResult.rows[0]?.count || 0) > 0) {
      throw new Error("Payroll has already been generated for this period.");
    }

    const aggregateResult = await client.query(
      `
      with commission_base as (
        select
          sc.staff_id,
          count(*)::int as total_services,
          coalesce(sum(sc.service_price), 0) as total_revenue,
          coalesce(sum(sc.commission_amount), 0) as commission_amount
        from service_commissions sc
        where sc.payroll_period_id is null
          and sc.created_at::date between $1::date and $2::date
        group by sc.staff_id
      )
      select *
      from commission_base
      order by commission_amount desc, total_revenue desc
      `,
      [period.start_date, period.end_date]
    );

    for (const row of aggregateResult.rows) {
      const payrollStaffResult = await client.query(
        `
        insert into payroll_staff (
          payroll_period_id,
          staff_id,
          total_services,
          total_revenue,
          commission_amount
        )
        values ($1, $2, $3, $4, $5)
        returning *
        `,
        [
          payrollPeriodId,
          row.staff_id,
          Number(row.total_services || 0),
          Number(row.total_revenue || 0),
          Number(row.commission_amount || 0),
        ]
      );

      const payrollStaff = payrollStaffResult.rows[0];

      await client.query(
        `
        insert into payroll_lines (
          payroll_staff_id,
          appointment_id,
          appointment_service_id,
          service_name,
          service_price,
          commission
        )
        select
          $1,
          sc.appointment_id,
          sc.appointment_service_id,
          sc.service_name,
          coalesce(sc.service_price, 0),
          coalesce(sc.commission_amount, 0)
        from service_commissions sc
        where sc.staff_id = $2
          and sc.payroll_period_id is null
          and sc.created_at::date between $3::date and $4::date
        `,
        [payrollStaff.id, row.staff_id, period.start_date, period.end_date]
      );

      await client.query(
        `
        update service_commissions
        set payroll_period_id = $1
        where staff_id = $2
          and payroll_period_id is null
          and created_at::date between $3::date and $4::date
        `,
        [payrollPeriodId, row.staff_id, period.start_date, period.end_date]
      );
    }

    await client.query(
      `
      update payroll_periods
      set
        status = 'LOCKED',
        updated_at = now()
      where id = $1
      `,
      [payrollPeriodId]
    );

    await client.query("commit");

    return {
      success: true,
      payrollPeriodId,
      generatedStaffCount: aggregateResult.rows.length,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function getPayrollSummary({ payrollPeriodId }) {
  const periodResult = await pool.query(
    `
    select *
    from payroll_periods
    where id = $1
    limit 1
    `,
    [payrollPeriodId]
  );

  const payrollPeriod = periodResult.rows[0] || null;

  const summaryResult = await pool.query(
    `
    select
      count(*)::int as "staffCount",
      coalesce(sum(total_services), 0)::int as "totalServices",
      coalesce(sum(total_revenue), 0) as "totalRevenue",
      coalesce(sum(commission_amount), 0) as "commissionAmount",
      coalesce(sum(tip_amount), 0) as "tipAmount",
      coalesce(sum(bonus), 0) as "bonus",
      coalesce(sum(deduction), 0) as "deduction",
      coalesce(sum(net_pay), 0) as "netPay",
      count(*) filter (where status = 'PAID')::int as "paidCount",
      count(*) filter (where status <> 'PAID')::int as "unpaidCount"
    from payroll_staff
    where payroll_period_id = $1
    `,
    [payrollPeriodId]
  );

  const staffResult = await pool.query(
    `
    select
      ps.*,
      coalesce(concat_ws(' ', st.first_name, st.last_name), ps.staff_id) as "staffName"
    from payroll_staff ps
    left join staff st on st.id = ps.staff_id
    where ps.payroll_period_id = $1
    order by ps.net_pay desc, ps.commission_amount desc
    `,
    [payrollPeriodId]
  );

  return {
    payrollPeriod,
    summary: summaryResult.rows[0] || null,
    staff: staffResult.rows,
  };
}

async function getPayrollStaffDetail({ payrollStaffId }) {
  const payrollStaffResult = await pool.query(
    `
    select
      ps.*,
      pp.start_date as "periodStartDate",
      pp.end_date as "periodEndDate",
      pp.status as "periodStatus",
      coalesce(concat_ws(' ', st.first_name, st.last_name), ps.staff_id) as "staffName"
    from payroll_staff ps
    join payroll_periods pp on pp.id = ps.payroll_period_id
    left join staff st on st.id = ps.staff_id
    where ps.id = $1
    limit 1
    `,
    [payrollStaffId]
  );

  const payrollStaff = payrollStaffResult.rows[0] || null;

  const linesResult = await pool.query(
    `
    select
      pl.*
    from payroll_lines pl
    where pl.payroll_staff_id = $1
    order by pl.created_at asc, pl.service_name asc
    `,
    [payrollStaffId]
  );

  return {
    payrollStaff,
    lines: linesResult.rows,
  };
}

async function updatePayrollStaffAdjustment({
  payrollStaffId,
  tipAmount = 0,
  bonus = 0,
  deduction = 0,
}) {
  const result = await pool.query(
    `
    update payroll_staff
    set
      tip_amount = $2,
      bonus = $3,
      deduction = $4,
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      payrollStaffId,
      Number(tipAmount || 0),
      Number(bonus || 0),
      Number(deduction || 0),
    ]
  );

  return result.rows[0] || null;
}

async function markPayrollPaid({
  payrollStaffId,
  paymentMethod = null,
  paymentNote = null,
}) {
  const result = await pool.query(
    `
    update payroll_staff
    set
      status = 'PAID',
      payment_method = $2,
      payment_note = $3,
      payment_date = now(),
      updated_at = now()
    where id = $1
    returning *
    `,
    [payrollStaffId, paymentMethod, paymentNote]
  );

  return result.rows[0] || null;
}

async function markPayrollPeriodPaid({ payrollPeriodId }) {
  const client = await pool.connect();

  try {
    await client.query("begin");

    await client.query(
      `
      update payroll_staff
      set
        status = 'PAID',
        payment_date = coalesce(payment_date, now()),
        updated_at = now()
      where payroll_period_id = $1
        and status <> 'PAID'
      `,
      [payrollPeriodId]
    );

    const result = await client.query(
      `
      update payroll_periods
      set
        status = 'PAID',
        updated_at = now()
      where id = $1
      returning *
      `,
      [payrollPeriodId]
    );

    await client.query("commit");

    return result.rows[0] || null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createPayrollPeriod,
  getPayrollPeriods,
  getPayrollPeriodById,
  generatePayroll,
  getPayrollSummary,
  getPayrollStaffDetail,
  updatePayrollStaffAdjustment,
  markPayrollPaid,
  markPayrollPeriodPaid,
};