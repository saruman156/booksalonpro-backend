const pool = require("../db/pool");
const giftCardsRepository = require("./giftCards.repository");

async function createAppointment(payload) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      appointmentDate,
      startAt,
      endAt,
      status = "SCHEDULED",
      note = null,
      receptionNote = null,
      technicianNote = null,
      source = "MANUAL",
      customerBooked = false,
      discount = 0,
      discountNote = null,
      createdByStaffId = null,
      participants = [],
    } = payload;

    const insertAppointmentSql = `
      insert into appointments (
        appointment_date,
        start_at,
        end_at,
        status,
        note,
        reception_note,
        technician_note,
        source,
        customer_booked,
        has_private_booking,
        discount,
        discount_note,
        service_total,
        tax_total,
        tip_total,
        grand_total,
        payment_status,
        created_by_staff_id,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11, 0, 0, 0, 0, 'UNPAID', $12, now(), now()
      )
      returning *
    `;

    const appointmentResult = await client.query(insertAppointmentSql, [
      appointmentDate,
      startAt,
      endAt,
      status,
      note,
      receptionNote,
      technicianNote,
      source,
      customerBooked,
      Number(discount || 0),
      discountNote,
      createdByStaffId,
    ]);

    const appointment = appointmentResult.rows[0];

    let serviceTotal = 0;
    let hasPrivateBooking = false;
    const createdParticipants = [];

    for (const participant of participants) {
      const {
        customerId = null,
        customerName,
        customerPhone = null,
        isVip = false,
        positionNo = 1,
        services = [],
      } = participant;

      const participantSql = `
        insert into appointment_participants (
          appointment_id,
          customer_id,
          customer_name_snapshot,
          customer_phone_snapshot,
          is_vip_snapshot,
          position_no,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, now(), now())
        returning *
      `;

      const participantResult = await client.query(participantSql, [
        appointment.id,
        customerId,
        customerName,
        customerPhone,
        Boolean(isVip),
        Number(positionNo || 1),
      ]);

      const createdParticipant = participantResult.rows[0];
      const createdServices = [];

      for (const line of services) {
        const {
          serviceId,
          assignedStaffId = null,
          assignedStaffName = null,
          isPrivateBooking = false,
          privateBookingStaffId = null,
          sequenceNo = 1,
          parallelGroup = 1,
          status: lineStatus = "SCHEDULED",
          notes = null,
          durationMin = null,
          price = null,
          supplyCharge = null,
        } = line;

        const serviceLookup = await client.query(
          `
          select
            id,
            name,
            category,
            duration_min,
            price,
            supply_charge
          from services
          where id = $1
          limit 1
          `,
          [serviceId]
        );

        if (serviceLookup.rows.length === 0) {
          throw new Error(`Service not found: ${serviceId}`);
        }

        const service = serviceLookup.rows[0];

        const finalDuration =
          durationMin !== null && durationMin !== undefined
            ? Number(durationMin)
            : Number(service.duration_min || 0);

        const finalPrice =
          price !== null && price !== undefined
            ? Number(price)
            : Number(service.price || 0);

        const finalSupplyCharge =
          supplyCharge !== null && supplyCharge !== undefined
            ? Number(supplyCharge)
            : Number(service.supply_charge || 0);

        const insertServiceSql = `
          insert into appointment_services (
            appointment_id,
            appointment_participant_id,
            service_id,
            service_name_snapshot,
            category_snapshot,
            duration_min_snapshot,
            price_snapshot,
            supply_charge_snapshot,
            assigned_staff_id,
            assigned_staff_name,
            is_private_booking,
            private_booking_staff_id,
            sequence_no,
            parallel_group,
            status,
            notes,
            created_at,
            updated_at
          )
          values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, now(), now()
          )
          returning *
        `;

        const serviceResult = await client.query(insertServiceSql, [
          appointment.id,
          createdParticipant.id,
          service.id,
          service.name,
          service.category,
          finalDuration,
          finalPrice,
          finalSupplyCharge,
          assignedStaffId,
          assignedStaffName,
          Boolean(isPrivateBooking),
          privateBookingStaffId,
          Number(sequenceNo || 1),
          Number(parallelGroup || 1),
          lineStatus,
          notes,
        ]);

        const createdLine = serviceResult.rows[0];
        createdServices.push(createdLine);

        serviceTotal += finalPrice;

        if (Boolean(isPrivateBooking)) {
          hasPrivateBooking = true;
        }
      }

      createdParticipants.push({
        ...createdParticipant,
        services: createdServices,
      });
    }

    const grandTotal = serviceTotal - Number(discount || 0);

    const updatedAppointmentResult = await client.query(
      `
      update appointments
      set
        service_total = $2,
        grand_total = $3,
        has_private_booking = $4,
        updated_at = now()
      where id = $1
      returning *
      `,
      [appointment.id, serviceTotal, grandTotal, hasPrivateBooking]
    );

    await client.query("COMMIT");

    return {
      appointment: updatedAppointmentResult.rows[0],
      participants: createdParticipants,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getAppointmentById(id) {
  const appointmentSql = `
    select
      id,
      booking_code as "bookingCode",
      appointment_date as "appointmentDate",
      start_at as "startAt",
      end_at as "endAt",
      status,
      note,
      reception_note as "receptionNote",
      technician_note as "technicianNote",
      source,
      customer_booked as "customerBooked",
      has_private_booking as "hasPrivateBooking",
      discount,
      discount_note as "discountNote",
      service_total as "serviceTotal",
      tax_total as "taxTotal",
      tip_total as "tipTotal",
      grand_total as "grandTotal",
      payment_status as "paymentStatus",
      checked_in_at as "checkedInAt",
      actual_start_at as "actualStartAt",
      actual_end_at as "actualEndAt",
      created_by_staff_id as "createdByStaffId",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from appointments
    where id = $1
    limit 1
  `;

  const appointmentResult = await pool.query(appointmentSql, [id]);
  if (appointmentResult.rows.length === 0) return null;

  const participantsSql = `
    select
      id,
      appointment_id as "appointmentId",
      customer_id as "customerId",
      customer_name_snapshot as "customerName",
      customer_phone_snapshot as "customerPhone",
      is_vip_snapshot as "isVip",
      position_no as "positionNo",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from appointment_participants
    where appointment_id = $1
    order by position_no asc, created_at asc
  `;

  const participantsResult = await pool.query(participantsSql, [id]);

  const servicesSql = `
    select
      id,
      appointment_id as "appointmentId",
      appointment_participant_id as "appointmentParticipantId",
      service_id as "serviceId",
      service_name_snapshot as "serviceName",
      category_snapshot as "category",
      duration_min_snapshot as "durationMin",
      price_snapshot as "price",
      supply_charge_snapshot as "supplyCharge",
      assigned_staff_id as "assignedStaffId",
      assigned_staff_name as "assignedStaffName",
      is_private_booking as "isPrivateBooking",
      private_booking_staff_id as "privateBookingStaffId",
      sequence_no as "sequenceNo",
      parallel_group as "parallelGroup",
      status,
      started_at as "startedAt",
      completed_at as "completedAt",
      override_reason as "overrideReason",
      override_by_staff_id as "overrideByStaffId",
      overridden_at as "overriddenAt",
      notes,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from appointment_services
    where appointment_id = $1
    order by sequence_no asc, parallel_group asc, created_at asc
  `;

  const servicesResult = await pool.query(servicesSql, [id]);

  const participants = participantsResult.rows.map((p) => ({
    ...p,
    services: servicesResult.rows.filter(
      (s) => s.appointmentParticipantId === p.id
    ),
  }));

  return {
    ...appointmentResult.rows[0],
    participants,
  };
}

async function getCalendarAppointments(from, to) {
  const sql = `
    select
      a.id,
      a.appointment_date as "appointmentDate",
      a.start_at as "startAt",
      a.end_at as "endAt",
      a.status,
      a.note,
      a.reception_note as "receptionNote",
      a.technician_note as "technicianNote",
      a.customer_booked as "customerBooked",
      a.has_private_booking as "hasPrivateBooking",
      a.service_total as "serviceTotal",
      a.grand_total as "grandTotal",
      ap.id as "participantId",
      ap.customer_id as "customerId",
      ap.customer_name_snapshot as "customerName",
      ap.customer_phone_snapshot as "customerPhone",
      ap.is_vip_snapshot as "isVip",
      s.id as "serviceLineId",
      s.service_id as "serviceId",
      s.service_name_snapshot as "serviceName",
      s.duration_min_snapshot as "durationMin",
      s.price_snapshot as "price",
      s.assigned_staff_id as "assignedStaffId",
      s.assigned_staff_name as "assignedStaffName",
      s.is_private_booking as "isPrivateBooking",
      s.private_booking_staff_id as "privateBookingStaffId",
      s.sequence_no as "sequenceNo",
      s.parallel_group as "parallelGroup",
      s.status as "serviceStatus"
    from appointments a
    left join appointment_participants ap on ap.appointment_id = a.id
    left join appointment_services s on s.appointment_participant_id = ap.id
    where a.appointment_date between $1 and $2
    order by a.appointment_date asc, a.start_at asc, ap.position_no asc, s.sequence_no asc, s.parallel_group asc
  `;

  const result = await pool.query(sql, [from, to]);
  return result.rows;
}

async function getAppointmentServiceById(id) {
  const sql = `
    select
      id,
      appointment_id as "appointmentId",
      appointment_participant_id as "appointmentParticipantId",
      service_id as "serviceId",
      service_name_snapshot as "serviceName",
      assigned_staff_id as "assignedStaffId",
      assigned_staff_name as "assignedStaffName",
      is_private_booking as "isPrivateBooking",
      private_booking_staff_id as "privateBookingStaffId",
      status,
      override_reason as "overrideReason",
      override_by_staff_id as "overrideByStaffId",
      overridden_at as "overriddenAt",
      completed_at as "completedAt"
    from appointment_services
    where id = $1
    limit 1
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0] || null;
}

async function reassignAppointmentService(
  id,
  { assignedStaffId, assignedStaffName, overrideReason, overrideByStaffId }
) {
  const sql = `
    update appointment_services
    set
      assigned_staff_id = $2,
      assigned_staff_name = $3,
      override_reason = $4,
      override_by_staff_id = $5,
      overridden_at = now(),
      updated_at = now()
    where id = $1
    returning
      id,
      appointment_id as "appointmentId",
      appointment_participant_id as "appointmentParticipantId",
      service_id as "serviceId",
      service_name_snapshot as "serviceName",
      assigned_staff_id as "assignedStaffId",
      assigned_staff_name as "assignedStaffName",
      is_private_booking as "isPrivateBooking",
      private_booking_staff_id as "privateBookingStaffId",
      status,
      override_reason as "overrideReason",
      override_by_staff_id as "overrideByStaffId",
      overridden_at as "overriddenAt",
      completed_at as "completedAt",
      updated_at as "updatedAt"
  `;

  const result = await pool.query(sql, [
    id,
    assignedStaffId,
    assignedStaffName,
    overrideReason || null,
    overrideByStaffId || null,
  ]);

  return result.rows[0] || null;
}

async function completeAppointmentService(id) {
  const sql = `
    update appointment_services
    set
      status = 'COMPLETED',
      completed_at = now(),
      updated_at = now()
    where id = $1
    returning
      id,
      appointment_id as "appointmentId",
      appointment_participant_id as "appointmentParticipantId",
      service_id as "serviceId",
      service_name_snapshot as "serviceName",
      assigned_staff_id as "assignedStaffId",
      assigned_staff_name as "assignedStaffName",
      status,
      completed_at as "completedAt",
      updated_at as "updatedAt"
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0] || null;
}

async function checkInAppointment(id) {
  const sql = `
    update appointments
    set
      status = 'CHECKED_IN',
      checked_in_at = now(),
      updated_at = now()
    where id = $1
    returning
      id,
      appointment_date as "appointmentDate",
      start_at as "startAt",
      end_at as "endAt",
      status,
      checked_in_at as "checkedInAt",
      updated_at as "updatedAt"
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0] || null;
}

async function startAppointment(id) {
  const sql = `
    update appointments
    set
      status = 'SERVING',
      actual_start_at = coalesce(actual_start_at, now()),
      updated_at = now()
    where id = $1
    returning
      id,
      appointment_date as "appointmentDate",
      start_at as "startAt",
      end_at as "endAt",
      status,
      actual_start_at as "actualStartAt",
      updated_at as "updatedAt"
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0] || null;
}

async function canCompleteAppointment(id) {
  const sql = `
    select
      count(*)::int as total,
      count(*) filter (
        where status not in ('COMPLETED', 'CANCELED')
      )::int as incomplete
    from appointment_services
    where appointment_id = $1
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0];
}

async function completeAppointment(id) {
  const sql = `
    update appointments
    set
      status = 'COMPLETED',
      actual_end_at = coalesce(actual_end_at, now()),
      updated_at = now()
    where id = $1
    returning
      id,
      appointment_date as "appointmentDate",
      start_at as "startAt",
      end_at as "endAt",
      status,
      actual_end_at as "actualEndAt",
      updated_at as "updatedAt"
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0] || null;
}

async function getAppointmentParticipantById(id) {
  const sql = `
    select
      ap.id,
      ap.appointment_id as "appointmentId",
      ap.customer_id as "customerId",
      ap.customer_name_snapshot as "customerName",
      ap.customer_phone_snapshot as "customerPhone",
      ap.is_vip_snapshot as "isVip",
      ap.position_no as "positionNo",
      a.status as "appointmentStatus",
      a.discount
    from appointment_participants ap
    join appointments a on a.id = ap.appointment_id
    where ap.id = $1
    limit 1
  `;

  const result = await pool.query(sql, [id]);
  return result.rows[0] || null;
}

async function recalcAppointmentTotals(client, appointmentId) {
  const totalsSql = `
    select
      coalesce(sum(price_snapshot), 0) as "serviceTotal",
      bool_or(is_private_booking) as "hasPrivateBooking"
    from appointment_services
    where appointment_id = $1
      and status <> 'CANCELED'
  `;

  const totalsResult = await client.query(totalsSql, [appointmentId]);
  const totals = totalsResult.rows[0];

  const appointmentResult = await client.query(
    `
    select discount
    from appointments
    where id = $1
    limit 1
    `,
    [appointmentId]
  );

  const appointment = appointmentResult.rows[0];
  const discount = Number(appointment?.discount || 0);
  const serviceTotal = Number(totals?.serviceTotal || 0);
  const grandTotal = serviceTotal - discount;
  const hasPrivateBooking = Boolean(totals?.hasPrivateBooking || false);

  const updatedResult = await client.query(
    `
    update appointments
    set
      service_total = $2,
      grand_total = $3,
      has_private_booking = $4,
      updated_at = now()
    where id = $1
    returning
      id,
      service_total as "serviceTotal",
      grand_total as "grandTotal",
      has_private_booking as "hasPrivateBooking",
      updated_at as "updatedAt"
    `,
    [appointmentId, serviceTotal, grandTotal, hasPrivateBooking]
  );

  return updatedResult.rows[0];
}

async function addServiceToParticipant(
  participantId,
  {
    serviceId,
    assignedStaffId = null,
    assignedStaffName = null,
    isPrivateBooking = false,
    privateBookingStaffId = null,
    sequenceNo = 1,
    parallelGroup = 1,
    notes = null,
    durationMin = null,
    price = null,
    supplyCharge = null,
    status = "SCHEDULED",
  }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const participantResult = await client.query(
      `
      select
        ap.id,
        ap.appointment_id as "appointmentId",
        a.status as "appointmentStatus"
      from appointment_participants ap
      join appointments a on a.id = ap.appointment_id
      where ap.id = $1
      limit 1
      `,
      [participantId]
    );

    if (participantResult.rows.length === 0) {
      throw new Error("Appointment participant not found");
    }

    const participant = participantResult.rows[0];

    if (!["SCHEDULED", "CHECKED_IN", "SERVING"].includes(participant.appointmentStatus)) {
      throw new Error(
        `Cannot add service when appointment status is ${participant.appointmentStatus}`
      );
    }

    const serviceLookup = await client.query(
      `
      select
        id,
        name,
        category,
        duration_min,
        price,
        supply_charge
      from services
      where id = $1
      limit 1
      `,
      [serviceId]
    );

    if (serviceLookup.rows.length === 0) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    const service = serviceLookup.rows[0];

    const finalDuration =
      durationMin !== null && durationMin !== undefined
        ? Number(durationMin)
        : Number(service.duration_min || 0);

    const finalPrice =
      price !== null && price !== undefined
        ? Number(price)
        : Number(service.price || 0);

    const finalSupplyCharge =
      supplyCharge !== null && supplyCharge !== undefined
        ? Number(supplyCharge)
        : Number(service.supply_charge || 0);

    const insertResult = await client.query(
      `
      insert into appointment_services (
        appointment_id,
        appointment_participant_id,
        service_id,
        service_name_snapshot,
        category_snapshot,
        duration_min_snapshot,
        price_snapshot,
        supply_charge_snapshot,
        assigned_staff_id,
        assigned_staff_name,
        is_private_booking,
        private_booking_staff_id,
        sequence_no,
        parallel_group,
        status,
        notes,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16,
        now(), now()
      )
      returning
        id,
        appointment_id as "appointmentId",
        appointment_participant_id as "appointmentParticipantId",
        service_id as "serviceId",
        service_name_snapshot as "serviceName",
        category_snapshot as "category",
        duration_min_snapshot as "durationMin",
        price_snapshot as "price",
        supply_charge_snapshot as "supplyCharge",
        assigned_staff_id as "assignedStaffId",
        assigned_staff_name as "assignedStaffName",
        is_private_booking as "isPrivateBooking",
        private_booking_staff_id as "privateBookingStaffId",
        sequence_no as "sequenceNo",
        parallel_group as "parallelGroup",
        status,
        notes,
        created_at as "createdAt",
        updated_at as "updatedAt"
      `,
      [
        participant.appointmentId,
        participantId,
        service.id,
        service.name,
        service.category,
        finalDuration,
        finalPrice,
        finalSupplyCharge,
        assignedStaffId,
        assignedStaffName,
        Boolean(isPrivateBooking),
        privateBookingStaffId,
        Number(sequenceNo || 1),
        Number(parallelGroup || 1),
        status,
        notes,
      ]
    );

    const totals = await recalcAppointmentTotals(client, participant.appointmentId);

    await client.query("COMMIT");

    return {
      serviceLine: insertResult.rows[0],
      totals,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateAppointmentServiceLine(
  id,
  {
    assignedStaffId,
    assignedStaffName,
    isPrivateBooking,
    privateBookingStaffId,
    sequenceNo,
    parallelGroup,
    notes,
    durationMin,
    price,
    supplyCharge,
    status,
  }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
      select
        id,
        appointment_id as "appointmentId",
        status,
        assigned_staff_id as "assignedStaffId",
        assigned_staff_name as "assignedStaffName",
        is_private_booking as "isPrivateBooking",
        private_booking_staff_id as "privateBookingStaffId",
        sequence_no as "sequenceNo",
        parallel_group as "parallelGroup",
        notes,
        duration_min_snapshot as "durationMin",
        price_snapshot as "price",
        supply_charge_snapshot as "supplyCharge"
      from appointment_services
      where id = $1
      limit 1
      `,
      [id]
    );

    if (existingResult.rows.length === 0) {
      throw new Error("Appointment service not found");
    }

    const current = existingResult.rows[0];

    const result = await client.query(
      `
      update appointment_services
      set
        assigned_staff_id = $2,
        assigned_staff_name = $3,
        is_private_booking = $4,
        private_booking_staff_id = $5,
        sequence_no = $6,
        parallel_group = $7,
        notes = $8,
        duration_min_snapshot = $9,
        price_snapshot = $10,
        supply_charge_snapshot = $11,
        status = $12,
        updated_at = now()
      where id = $1
      returning
        id,
        appointment_id as "appointmentId",
        appointment_participant_id as "appointmentParticipantId",
        service_id as "serviceId",
        service_name_snapshot as "serviceName",
        category_snapshot as "category",
        duration_min_snapshot as "durationMin",
        price_snapshot as "price",
        supply_charge_snapshot as "supplyCharge",
        assigned_staff_id as "assignedStaffId",
        assigned_staff_name as "assignedStaffName",
        is_private_booking as "isPrivateBooking",
        private_booking_staff_id as "privateBookingStaffId",
        sequence_no as "sequenceNo",
        parallel_group as "parallelGroup",
        status,
        started_at as "startedAt",
        completed_at as "completedAt",
        notes,
        updated_at as "updatedAt"
      `,
      [
        id,
        assignedStaffId !== undefined ? assignedStaffId : current.assignedStaffId,
        assignedStaffName !== undefined ? assignedStaffName : current.assignedStaffName,
        isPrivateBooking !== undefined ? Boolean(isPrivateBooking) : current.isPrivateBooking,
        privateBookingStaffId !== undefined
          ? privateBookingStaffId
          : current.privateBookingStaffId,
        sequenceNo !== undefined ? Number(sequenceNo) : current.sequenceNo,
        parallelGroup !== undefined ? Number(parallelGroup) : current.parallelGroup,
        notes !== undefined ? notes : current.notes,
        durationMin !== undefined ? Number(durationMin) : Number(current.durationMin),
        price !== undefined ? Number(price) : Number(current.price),
        supplyCharge !== undefined ? Number(supplyCharge) : Number(current.supplyCharge),
        status !== undefined ? status : current.status,
      ]
    );

    const updated = result.rows[0];
    const totals = await recalcAppointmentTotals(client, updated.appointmentId);

    await client.query("COMMIT");

    return {
      serviceLine: updated,
      totals,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cancelAppointmentServiceLine(id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      update appointment_services
      set
        status = 'CANCELED',
        updated_at = now()
      where id = $1
      returning
        id,
        appointment_id as "appointmentId",
        appointment_participant_id as "appointmentParticipantId",
        service_id as "serviceId",
        service_name_snapshot as "serviceName",
        category_snapshot as "category",
        duration_min_snapshot as "durationMin",
        price_snapshot as "price",
        supply_charge_snapshot as "supplyCharge",
        assigned_staff_id as "assignedStaffId",
        assigned_staff_name as "assignedStaffName",
        is_private_booking as "isPrivateBooking",
        private_booking_staff_id as "privateBookingStaffId",
        sequence_no as "sequenceNo",
        parallel_group as "parallelGroup",
        status,
        started_at as "startedAt",
        completed_at as "completedAt",
        notes,
        updated_at as "updatedAt"
      `,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error("Appointment service not found");
    }

    const canceled = result.rows[0];
    const totals = await recalcAppointmentTotals(client, canceled.appointmentId);

    await client.query("COMMIT");

    return {
      serviceLine: canceled,
      totals,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function checkoutAppointment(
  id,
  { paymentMethod, tip = 0, taxRate = 0, note = null, createdByStaffId = null }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. check appointment
    const appointmentResult = await client.query(
      `
      select
        id,
        status,
        discount,
        service_total
      from appointments
      where id = $1
      limit 1
      `,
      [id]
    );

    if (appointmentResult.rows.length === 0) {
      throw new Error("Appointment not found");
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.status === "CANCELED") {
      throw new Error("Cannot checkout canceled appointment");
    }

    // 2. check services
    const checkResult = await client.query(
      `
      select
        count(*)::int as total,
        count(*) filter (
          where status not in ('COMPLETED', 'CANCELED')
        )::int as incomplete
      from appointment_services
      where appointment_id = $1
      `,
      [id]
    );

    const check = checkResult.rows[0];

    if (Number(check.incomplete) > 0) {
      throw new Error("All services must be completed before checkout");
    }

    // 3. calculate totals
    const serviceTotal = Number(appointment.service_total || 0);
    const tax = serviceTotal * Number(taxRate || 0);
    const finalTip = Number(tip || 0);
    const discount = Number(appointment.discount || 0);

    const grandTotal = serviceTotal + tax + finalTip - discount;

    // 4. insert payment
    const paymentResult = await client.query(
      `
      insert into payments (
        appointment_id,
        amount,
        tip,
        tax,
        payment_method,
        note,
        created_by_staff_id,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, now())
      returning *
      `,
      [
        id,
        grandTotal,
        finalTip,
        tax,
        paymentMethod,
        note,
        createdByStaffId,
      ]
    );

    // 5. update appointment
    const updatedResult = await client.query(
      `
      update appointments
      set
        payment_status = 'PAID',
        status = 'COMPLETED',
        tip_total = $2,
        tax_total = $3,
        grand_total = $4,
        updated_at = now()
      where id = $1
      returning
        id,
        status,
        payment_status as "paymentStatus",
        service_total as "serviceTotal",
        tax_total as "taxTotal",
        tip_total as "tipTotal",
        grand_total as "grandTotal",
        updated_at as "updatedAt"
      `,
      [id, finalTip, tax, grandTotal]
    );

    await client.query("COMMIT");

    return {
      payment: paymentResult.rows[0],
      appointment: updatedResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function checkoutAppointmentV2(
  id,
  { payments = [], tip = 0, taxRate = 0, note = null, createdByStaffId = null }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const appointmentResult = await client.query(
      `
      select
        id,
        status,
        discount,
        service_total
      from appointments
      where id = $1
      limit 1
      `,
      [id]
    );

    if (appointmentResult.rows.length === 0) {
      throw new Error("Appointment not found");
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.status === "CANCELED") {
      throw new Error("Cannot checkout canceled appointment");
    }

    const checkResult = await client.query(
      `
      select
        count(*)::int as total,
        count(*) filter (
          where status not in ('COMPLETED', 'CANCELED')
        )::int as incomplete
      from appointment_services
      where appointment_id = $1
      `,
      [id]
    );

    const check = checkResult.rows[0];

    if (Number(check.total) === 0) {
      throw new Error("Appointment has no service lines");
    }

    if (Number(check.incomplete) > 0) {
      throw new Error("All services must be completed before checkout");
    }

    const serviceTotal = Number(appointment.service_total || 0);
    const tax = Number((serviceTotal * Number(taxRate || 0)).toFixed(2));
    const finalTip = Number(tip || 0);
    const discount = Number(appointment.discount || 0);
    const grandTotal = Number((serviceTotal + tax + finalTip - discount).toFixed(2));

    if (!Array.isArray(payments) || payments.length === 0) {
      throw new Error("At least one payment entry is required");
    }

    const paymentSum = Number(
      payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)
    );

    if (paymentSum !== grandTotal) {
      throw new Error(`Payment total ${paymentSum} must equal grand total ${grandTotal}`);
    }

    const insertedPayments = [];

    for (const p of payments) {
      const method = String(p.method || "").trim().toUpperCase();
      const amount = Number(p.amount || 0);

      if (!method) {
        throw new Error("Payment method is required");
      }

      if (amount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }

      let giftCardId = null;

      if (method === "GIFT_CARD") {
        const giftCardCode = String(p.giftCardCode || "").trim();

        if (!giftCardCode) {
          throw new Error("giftCardCode is required for GIFT_CARD payment");
        }

        const card = await giftCardsRepository.getRedeemableGiftCardByCode(client, giftCardCode);

        if (!card) {
          throw new Error(`Gift card not found for code: ${giftCardCode}`);
        }

        const redeemed = await giftCardsRepository.redeemGiftCardWithClient(client, {
          giftCardId: card.id,
          appointmentId: id,
          amount,
          note: note || "Applied during checkout",
          createdByStaffId,
        });

        giftCardId = redeemed.giftCard.id;
      }

      const paymentResult = await client.query(
        `
        insert into payments (
          appointment_id,
          amount,
          tip_amount,
          tax_amount,
          method,
          status,
          note,
          paid_at,
          created_by_staff_id,
          gift_card_id,
          created_at,
          updated_at
        )
        values (
          $1, $2, 0, 0, $3, 'PAID', $4, now(), $5, $6, now(), now()
        )
        returning
          id,
          appointment_id as "appointmentId",
          amount,
          tip_amount as "tipAmount",
          tax_amount as "taxAmount",
          method,
          status,
          note,
          paid_at as "paidAt",
          created_by_staff_id as "createdByStaffId",
          gift_card_id as "giftCardId",
          created_at as "createdAt",
          updated_at as "updatedAt"
        `,
        [id, amount, method, note, createdByStaffId, giftCardId]
      );

      insertedPayments.push(paymentResult.rows[0]);
    }

    const updatedResult = await client.query(
      `
      update appointments
      set
        payment_status = 'PAID',
        status = 'COMPLETED',
        tip_total = $2,
        tax_total = $3,
        grand_total = $4,
        actual_end_at = coalesce(actual_end_at, now()),
        updated_at = now()
      where id = $1
      returning
        id,
        status,
        payment_status as "paymentStatus",
        service_total as "serviceTotal",
        tax_total as "taxTotal",
        tip_total as "tipTotal",
        grand_total as "grandTotal",
        actual_end_at as "actualEndAt",
        updated_at as "updatedAt"
      `,
      [id, finalTip, tax, grandTotal]
    );

    await client.query("COMMIT");

    return {
      appointment: updatedResult.rows[0],
      payments: insertedPayments,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createAppointment,
  getAppointmentById,
  getCalendarAppointments,
  getAppointmentServiceById,
  reassignAppointmentService,
  completeAppointmentService,
  checkInAppointment,
  startAppointment,
  canCompleteAppointment,
  completeAppointment,
  getAppointmentParticipantById,
  addServiceToParticipant,
  updateAppointmentServiceLine,
  cancelAppointmentServiceLine,
  checkoutAppointmentV2,
};