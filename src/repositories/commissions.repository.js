const pool = require("../db/pool");

async function generateCommissionsForAppointment(appointmentId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const appointmentResult = await client.query(
      `
      select
        id,
        payment_status
      from appointments
      where id = $1
      limit 1
      `,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      throw new Error("Appointment not found");
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.payment_status !== "PAID") {
      throw new Error("Commission can only be generated after appointment is PAID");
    }

    const linesResult = await client.query(
      `
      select
        s.id as "appointmentServiceId",
        s.appointment_id as "appointmentId",
        s.appointment_participant_id as "appointmentParticipantId",
        s.service_id as "serviceId",
        s.service_name_snapshot as "serviceName",
        s.price_snapshot as "linePrice",
        s.assigned_staff_id as "staffId",
        s.assigned_staff_name as "staffName",
        st.commission_rate as "commissionRate"
      from appointment_services s
      join staff st on st.id = s.assigned_staff_id
      where s.appointment_id = $1
        and s.status = 'COMPLETED'
        and s.assigned_staff_id is not null
      `,
      [appointmentId]
    );

    const inserted = [];

    for (const line of linesResult.rows) {
      const exists = await client.query(
        `
        select id
        from service_commissions
        where appointment_service_id = $1
        limit 1
        `,
        [line.appointmentServiceId]
      );

      if (exists.rows.length > 0) {
        continue;
      }

      const linePrice = Number(line.linePrice || 0);
      const commissionRate = Number(line.commissionRate || 0);
      const commissionAmount = Number(
        ((linePrice * commissionRate) / 100).toFixed(2)
      );

      const insertResult = await client.query(
        `
        insert into service_commissions (
          appointment_id,
          appointment_service_id,
          appointment_participant_id,
          staff_id,
          staff_name_snapshot,
          service_id,
          service_name_snapshot,
          line_price,
          commission_rate,
          commission_amount,
          note,
          created_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, null, now()
        )
        returning
          id,
          appointment_id as "appointmentId",
          appointment_service_id as "appointmentServiceId",
          appointment_participant_id as "appointmentParticipantId",
          staff_id as "staffId",
          staff_name_snapshot as "staffName",
          service_id as "serviceId",
          service_name_snapshot as "serviceName",
          line_price as "linePrice",
          commission_rate as "commissionRate",
          commission_amount as "commissionAmount",
          note,
          created_at as "createdAt"
        `,
        [
          line.appointmentId,
          line.appointmentServiceId,
          line.appointmentParticipantId,
          line.staffId,
          line.staffName,
          line.serviceId,
          line.serviceName,
          linePrice,
          commissionRate,
          commissionAmount,
        ]
      );

      inserted.push(insertResult.rows[0]);
    }

    await client.query("COMMIT");

    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getCommissionsByAppointment(appointmentId) {
  const result = await pool.query(
    `
    select
      id,
      appointment_id as "appointmentId",
      appointment_service_id as "appointmentServiceId",
      appointment_participant_id as "appointmentParticipantId",
      staff_id as "staffId",
      staff_name_snapshot as "staffName",
      service_id as "serviceId",
      service_name_snapshot as "serviceName",
      line_price as "linePrice",
      commission_rate as "commissionRate",
      commission_amount as "commissionAmount",
      note,
      created_at as "createdAt"
    from service_commissions
    where appointment_id = $1
    order by created_at asc
    `,
    [appointmentId]
  );

  return result.rows;
}

async function getCommissionSummaryByStaff({ from, to, staffId = null }) {
  const values = [from, to];
  let where = `where a.appointment_date between $1 and $2`;

  if (staffId) {
    values.push(staffId);
    where += ` and c.staff_id = $3`;
  }

  const sql = `
    select
      c.staff_id as "staffId",
      c.staff_name_snapshot as "staffName",
      count(*)::int as "serviceCount",
      coalesce(sum(c.line_price), 0) as "grossServiceSales",
      coalesce(sum(c.commission_amount), 0) as "totalCommission"
    from service_commissions c
    join appointments a on a.id = c.appointment_id
    ${where}
    group by c.staff_id, c.staff_name_snapshot
    order by "totalCommission" desc
  `;

  const result = await pool.query(sql, values);
  return result.rows;
}

module.exports = {
  generateCommissionsForAppointment,
  getCommissionsByAppointment,
  getCommissionSummaryByStaff,
};