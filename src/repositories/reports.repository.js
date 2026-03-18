const pool = require("../db/pool");

const ACTIVE_APPOINTMENT_FILTER = `coalesce(a.status, '') not in ('CANCELED', 'NO_SHOW')`;
const ACTIVE_SERVICE_FILTER = `coalesce(s.status, '') <> 'CANCELED'`;

function normalizeDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

async function getDashboardSummary({ date = null }) {
  const targetDate = normalizeDate(date);
  const dateSql = targetDate ? "$1::date" : "current_date";
  const values = targetDate ? [targetDate] : [];

  const summarySql = `
    with base as (
      select ${dateSql} as target_date
    ),
    today_appts as (
      select *
      from appointments a, base b
      where a.appointment_date = b.target_date
    ),
    revenue_day as (
      select coalesce(sum(a.grand_total), 0) as amount
      from appointments a, base b
      where a.appointment_date = b.target_date
        and ${ACTIVE_APPOINTMENT_FILTER}
    ),
    revenue_week as (
      select coalesce(sum(a.grand_total), 0) as amount
      from appointments a, base b
      where a.appointment_date >= date_trunc('week', b.target_date::timestamp)::date
        and a.appointment_date < (date_trunc('week', b.target_date::timestamp)::date + interval '7 day')
        and ${ACTIVE_APPOINTMENT_FILTER}
    ),
    revenue_month as (
      select coalesce(sum(a.grand_total), 0) as amount
      from appointments a, base b
      where a.appointment_date >= date_trunc('month', b.target_date::timestamp)::date
        and a.appointment_date < (date_trunc('month', b.target_date::timestamp)::date + interval '1 month')
        and ${ACTIVE_APPOINTMENT_FILTER}
    ),
    customer_total as (
      select count(*)::int as total
      from customers
      where is_active = true
    ),
    today_metrics as (
      select
        count(*)::int as "totalAppointments",
        coalesce(avg(nullif(a.grand_total, 0)), 0) as "avgTicket",
        count(*) filter (where coalesce(a.source, '') = 'WALK_IN')::int as "walkInCount",
        count(*) filter (where coalesce(a.source, '') <> 'WALK_IN')::int as "bookedCount",
        count(*) filter (where a.has_private_booking = true)::int as "privateBookingCount",
        count(*) filter (where a.payment_status = 'UNPAID')::int as "unpaidCount",
        count(*) filter (where a.payment_status = 'PARTIAL')::int as "partialPaidCount",
        count(*) filter (
          where a.status = 'CANCELED'
            and a.updated_at::date = a.appointment_date
        )::int as "sameDayCancellationCount"
      from today_appts a
      where ${ACTIVE_APPOINTMENT_FILTER}
         or a.status = 'CANCELED'
    ),
    utilization as (
      select
        coalesce(sum(s.duration_min_snapshot), 0) as booked_minutes,
        greatest(
          (select count(*) from staff where is_active = true and role in ('OWNER', 'MANAGER', 'TECHNICIAN')),
          1
        ) as active_staff_count
      from appointment_services s
      join appointments a on a.id = s.appointment_id
      join base b on true
      where a.appointment_date = b.target_date
        and ${ACTIVE_SERVICE_FILTER}
        and s.assigned_staff_id is not null
    ),
    gift_card_day as (
      select
        coalesce(sum(gc.initial_balance) filter (where gc.created_at::date = b.target_date), 0) as sold,
        coalesce(sum(gct.amount) filter (
          where gct.created_at::date = b.target_date
            and upper(coalesce(gct.transaction_type, '')) = 'REDEEM'
        ), 0) as redeemed,
        (
          select coalesce(sum(gc2.remaining_balance), 0)
          from gift_cards gc2
          where gc2.status = 'ACTIVE'
        ) as outstanding
      from base b
      left join gift_cards gc on true
      left join gift_card_transactions gct on true
      group by b.target_date
    ),
    upsell as (
      select
        count(*)::int as upsell_count,
        coalesce(sum(s.price_snapshot), 0) as upsell_revenue
      from appointment_services s
      join appointments a on a.id = s.appointment_id
      join base b on true
      where a.appointment_date = b.target_date
        and ${ACTIVE_SERVICE_FILTER}
        and s.is_upsell = true
    ),
    reassignments as (
      select count(*)::int as total
      from appointment_services s
      join base b on true
      where s.overridden_at::date = b.target_date
    )
    select
      (select target_date from base) as "date",
      (select amount from revenue_day) as "revenueToday",
      (select amount from revenue_week) as "revenueWeek",
      (select amount from revenue_month) as "revenueMonth",
      (select total from customer_total) as "totalCustomers",
      (select "totalAppointments" from today_metrics) as "totalAppointmentsToday",
      (select "avgTicket" from today_metrics) as "avgTicketToday",
      (select "walkInCount" from today_metrics) as "walkInCount",
      (select "bookedCount" from today_metrics) as "bookedCount",
      (select "privateBookingCount" from today_metrics) as "privateBookingCount",
      (select sold from gift_card_day) as "giftCardSoldToday",
      (select redeemed from gift_card_day) as "giftCardRedeemedToday",
      (select outstanding from gift_card_day) as "giftCardOutstanding",
      (select "unpaidCount" from today_metrics) as "unpaidCount",
      (select "partialPaidCount" from today_metrics) as "partialPaidCount",
      (select "sameDayCancellationCount" from today_metrics) as "sameDayCancellationCount",
      (select upsell_count from upsell) as "upsellCountToday",
      (select upsell_revenue from upsell) as "upsellRevenueToday",
      (select total from reassignments) as "reassignmentCountToday",
      round(
        case
          when (select active_staff_count from utilization) <= 0 then 0
          else ((select booked_minutes from utilization)::numeric / ((select active_staff_count from utilization)::numeric * 480)) * 100
        end,
        2
      ) as "technicianUtilizationPct"
  `;

  const statusSql = `
    with base as (select ${dateSql} as target_date)
    select
      coalesce(status, 'UNKNOWN') as status,
      count(*)::int as count
    from appointments a, base b
    where a.appointment_date = b.target_date
    group by coalesce(status, 'UNKNOWN')
    order by count desc, status asc
  `;

  const topTechniciansSql = `
    with base as (select ${dateSql} as target_date)
    select
      s.assigned_staff_id as "staffId",
      coalesce(s.assigned_staff_name, concat_ws(' ', st.first_name, st.last_name), s.assigned_staff_id) as "staffName",
      count(*)::int as "serviceCount",
      coalesce(sum(s.price_snapshot), 0) as revenue,
      coalesce(sum(s.duration_min_snapshot), 0)::int as "bookedMinutes"
    from appointment_services s
    join appointments a on a.id = s.appointment_id
    left join staff st on st.id = s.assigned_staff_id
    join base b on true
    where a.appointment_date = b.target_date
      and ${ACTIVE_SERVICE_FILTER}
      and s.assigned_staff_id is not null
    group by s.assigned_staff_id, coalesce(s.assigned_staff_name, concat_ws(' ', st.first_name, st.last_name), s.assigned_staff_id)
    order by revenue desc, "serviceCount" desc
    limit 10
  `;

  const topServicesSql = `
    with base as (select ${dateSql} as target_date)
    select
      s.service_id as "serviceId",
      s.service_name_snapshot as "serviceName",
      coalesce(s.category_snapshot, 'Uncategorized') as category,
      count(*)::int as "serviceCount",
      coalesce(sum(s.price_snapshot), 0) as revenue
    from appointment_services s
    join appointments a on a.id = s.appointment_id
    join base b on true
    where a.appointment_date = b.target_date
      and ${ACTIVE_SERVICE_FILTER}
    group by s.service_id, s.service_name_snapshot, coalesce(s.category_snapshot, 'Uncategorized')
    order by revenue desc, "serviceCount" desc
    limit 10
  `;

  const [summaryResult, statusResult, topTechniciansResult, topServicesResult] =
    await Promise.all([
      pool.query(summarySql, values),
      pool.query(statusSql, values),
      pool.query(topTechniciansSql, values),
      pool.query(topServicesSql, values),
    ]);

  const summary = summaryResult.rows[0] || null;

  return {
    summary,
    todayStatuses: statusResult.rows,
    topTechnicians: topTechniciansResult.rows,
    topServices: topServicesResult.rows,
    operations: {
      upsellRevenueToday: Number(summary?.upsellRevenueToday || 0),
      upsellCountToday: Number(summary?.upsellCountToday || 0),
      reassignmentCountToday: Number(summary?.reassignmentCountToday || 0),
    },
  };
}

async function getOwnerReport({ from, to }) {
  const values = [normalizeDate(from), normalizeDate(to)];

  const summarySql = `
    with appts as (
      select *
      from appointments a
      where a.appointment_date between $1::date and $2::date
    ),
    customer_visits as (
      select
        ap.customer_id,
        min(a.appointment_date) as first_visit_date
      from appointment_participants ap
      join appointments a on a.id = ap.appointment_id
      where ap.customer_id is not null
      group by ap.customer_id
    ),
    range_customers as (
      select distinct ap.customer_id
      from appointment_participants ap
      join appointments a on a.id = ap.appointment_id
      where a.appointment_date between $1::date and $2::date
        and ${ACTIVE_APPOINTMENT_FILTER}
        and ap.customer_id is not null
    ),
    duration_rollup as (
      select
        coalesce(sum(s.duration_min_snapshot), 0)::int as planned_minutes
      from appointment_services s
      join appointments a on a.id = s.appointment_id
      where a.appointment_date between $1::date and $2::date
        and ${ACTIVE_SERVICE_FILTER}
    ),
    actual_rollup as (
      select
        coalesce(sum(extract(epoch from (a.actual_end_at - a.actual_start_at)) / 60), 0)::int as actual_minutes
      from appointments a
      where a.appointment_date between $1::date and $2::date
        and ${ACTIVE_APPOINTMENT_FILTER}
        and a.actual_start_at is not null
        and a.actual_end_at is not null
    ),
    no_show_rollup as (
      select
        count(*)::int as count,
        coalesce(sum(a.service_total - coalesce(a.discount, 0)), 0) as amount
      from appts a
      where a.status = 'NO_SHOW'
    ),
    upsell_rollup as (
      select
        count(*)::int as upsell_count,
        coalesce(sum(s.price_snapshot), 0) as upsell_revenue
      from appointment_services s
      join appointments a on a.id = s.appointment_id
      where a.appointment_date between $1::date and $2::date
        and ${ACTIVE_SERVICE_FILTER}
        and ${ACTIVE_APPOINTMENT_FILTER}
        and s.is_upsell = true
    )
    select
      count(*)::int as "appointmentCount",
      coalesce(sum(case when ${ACTIVE_APPOINTMENT_FILTER} then a.service_total else 0 end), 0) as "grossSales",
      coalesce(sum(case when ${ACTIVE_APPOINTMENT_FILTER} then coalesce(a.discount, 0) else 0 end), 0) as "discountTotal",
      coalesce(sum(case when ${ACTIVE_APPOINTMENT_FILTER} then a.tax_total else 0 end), 0) as "taxCollected",
      coalesce(sum(case when ${ACTIVE_APPOINTMENT_FILTER} then a.tip_total else 0 end), 0) as "tipTotal",
      coalesce(sum(case when ${ACTIVE_APPOINTMENT_FILTER} then a.grand_total else 0 end), 0) as "netRevenue",
      (
        select coalesce(sum(p.amount), 0)
        from payments p
        where p.status = 'PAID'
          and p.paid_at::date between $1::date and $2::date
      ) as "collectedPayments",
      (
        select coalesce(sum(remaining_balance), 0)
        from gift_cards
        where status = 'ACTIVE'
      ) as "giftCardLiability",
      (
        select coalesce(sum(amount), 0)
        from payments
        where status in ('VOIDED', 'REFUNDED')
          and paid_at::date between $1::date and $2::date
      ) as "refundVoidTotal",
      (
        select count(*)::int
        from customers c
        where c.created_at::date between $1::date and $2::date
      ) as "newCustomers",
      (
        select count(*)::int
        from customer_visits cv
        join range_customers rc on rc.customer_id = cv.customer_id
        where cv.first_visit_date < $1::date
      ) as "returningCustomers",
      (
        select round(
          case when count(*) = 0 then 0
          else (count(*) filter (where cv.first_visit_date < $1::date)::numeric / count(*)::numeric) * 100
          end,
          2
        )
        from customer_visits cv
        join range_customers rc on rc.customer_id = cv.customer_id
      ) as "retentionRate",
      (
        select coalesce(sum(a2.grand_total), 0)
        from appointments a2
        where a2.appointment_date between $1::date and $2::date
          and ${ACTIVE_APPOINTMENT_FILTER}
          and exists (
            select 1
            from appointment_participants ap
            where ap.appointment_id = a2.id
              and ap.is_vip_snapshot = true
          )
      ) as "vipRevenue",
      count(*) filter (where a.status = 'COMPLETED')::int as "completedAppointments",
      round(
        case when count(*) = 0 then 0
        else (count(*) filter (where a.status = 'COMPLETED')::numeric / count(*)::numeric) * 100
        end,
        2
      ) as "completionRate",
      count(*) filter (where a.status = 'CANCELED')::int as "canceledAppointments",
      round(
        case when count(*) = 0 then 0
        else (count(*) filter (where a.status = 'CANCELED')::numeric / count(*)::numeric) * 100
        end,
        2
      ) as "cancellationRate",
      count(*) filter (where a.status = 'NO_SHOW')::int as "noShowCount",
      (select amount from no_show_rollup) as "noShowLostRevenueEstimate",
      count(*) filter (where coalesce(a.source, '') = 'WALK_IN')::int as "walkInCount",
      count(*) filter (where coalesce(a.source, '') <> 'WALK_IN')::int as "bookedCount",
      count(*) filter (where a.has_private_booking = true and ${ACTIVE_APPOINTMENT_FILTER})::int as "privateBookingCount",
      coalesce(sum(case when a.has_private_booking = true and ${ACTIVE_APPOINTMENT_FILTER} then a.grand_total else 0 end), 0) as "privateBookingRevenue",
      (select planned_minutes from duration_rollup) as "plannedDurationMinutes",
      (select actual_minutes from actual_rollup) as "actualDurationMinutes",
      (
        select count(*)::int
        from appointment_services s
        where s.overridden_at::date between $1::date and $2::date
      ) as "reassignmentCount",
      (
        select round(
          case when count(distinct ap.id) = 0 then 0
          else (count(s.id)::numeric / nullif(count(distinct ap.id), 0)::numeric)
          end,
          2
        )
        from appointment_participants ap
        join appointments a2 on a2.id = ap.appointment_id
        left join appointment_services s
          on s.appointment_participant_id = ap.id
         and ${ACTIVE_SERVICE_FILTER}
        where a2.appointment_date between $1::date and $2::date
          and ${ACTIVE_APPOINTMENT_FILTER}
      ) as "serviceAttachRate",
      (select upsell_count from upsell_rollup) as "upsellCount",
      (select upsell_revenue from upsell_rollup) as "upsellRevenue"
    from appts a
  `;

  const revenueTrendSql = `
    select
      a.appointment_date as date,
      coalesce(sum(a.grand_total), 0) as revenue,
      count(*)::int as "appointmentCount"
    from appointments a
    where a.appointment_date between $1::date and $2::date
      and ${ACTIVE_APPOINTMENT_FILTER}
    group by a.appointment_date
    order by a.appointment_date asc
  `;

  const revenueByCategorySql = `
    select
      coalesce(s.category_snapshot, 'Uncategorized') as category,
      count(*)::int as "serviceCount",
      coalesce(sum(s.price_snapshot), 0) as revenue,
      coalesce(sum(s.supply_charge_snapshot), 0) as "supplyCost",
      coalesce(sum(s.price_snapshot - coalesce(s.supply_charge_snapshot, 0)), 0) as profit
    from appointment_services s
    join appointments a on a.id = s.appointment_id
    where a.appointment_date between $1::date and $2::date
      and ${ACTIVE_SERVICE_FILTER}
      and ${ACTIVE_APPOINTMENT_FILTER}
    group by coalesce(s.category_snapshot, 'Uncategorized')
    order by revenue desc
  `;

  const paymentMethodsSql = `
    select
      upper(coalesce(method, 'UNKNOWN')) as method,
      count(*)::int as count,
      coalesce(sum(amount), 0) as amount
    from payments
    where paid_at::date between $1::date and $2::date
      and status = 'PAID'
    group by upper(coalesce(method, 'UNKNOWN'))
    order by amount desc, count desc
  `;

  const peakHoursSql = `
    select
      extract(hour from a.start_at)::int as hour,
      count(*)::int as "appointmentCount",
      coalesce(sum(a.grand_total), 0) as revenue
    from appointments a
    where a.appointment_date between $1::date and $2::date
      and ${ACTIVE_APPOINTMENT_FILTER}
    group by extract(hour from a.start_at)::int
    order by hour asc
  `;

  const staffPerformanceSql = `
    select
      s.assigned_staff_id as "staffId",
      coalesce(s.assigned_staff_name, concat_ws(' ', st.first_name, st.last_name), s.assigned_staff_id) as "staffName",
      count(*)::int as "serviceCount",
      coalesce(sum(s.price_snapshot), 0) as revenue,
      coalesce(sum(s.duration_min_snapshot), 0)::int as "bookedMinutes",
      round(
        case when coalesce(sum(s.duration_min_snapshot), 0) = 0 then 0
        else (coalesce(sum(s.price_snapshot), 0) / (coalesce(sum(s.duration_min_snapshot), 0)::numeric / 60))
        end,
        2
      ) as "revenuePerHour",
      round(coalesce(avg(s.price_snapshot), 0), 2) as "averageTicket",
      coalesce(sum(case when s.is_private_booking = true then s.price_snapshot else 0 end), 0) as "privateBookingRevenue",
      coalesce(sum(c.commission_amount), 0) as commission
    from appointment_services s
    join appointments a on a.id = s.appointment_id
    left join staff st on st.id = s.assigned_staff_id
    left join service_commissions c on c.appointment_service_id = s.id
    where a.appointment_date between $1::date and $2::date
      and ${ACTIVE_SERVICE_FILTER}
      and ${ACTIVE_APPOINTMENT_FILTER}
      and s.assigned_staff_id is not null
    group by s.assigned_staff_id, coalesce(s.assigned_staff_name, concat_ws(' ', st.first_name, st.last_name), s.assigned_staff_id)
    order by revenue desc, "serviceCount" desc
  `;

  const topServicesSql = `
    select
      s.service_id as "serviceId",
      s.service_name_snapshot as "serviceName",
      coalesce(s.category_snapshot, 'Uncategorized') as category,
      count(*)::int as "serviceCount",
      coalesce(sum(s.price_snapshot), 0) as revenue,
      coalesce(sum(s.supply_charge_snapshot), 0) as "supplyCost",
      coalesce(sum(s.price_snapshot - coalesce(s.supply_charge_snapshot, 0)), 0) as profit
    from appointment_services s
    join appointments a on a.id = s.appointment_id
    where a.appointment_date between $1::date and $2::date
      and ${ACTIVE_SERVICE_FILTER}
      and ${ACTIVE_APPOINTMENT_FILTER}
    group by s.service_id, s.service_name_snapshot, coalesce(s.category_snapshot, 'Uncategorized')
    order by revenue desc, "serviceCount" desc
    limit 15
  `;

  const topCanceledServicesSql = `
    select
      s.service_id as "serviceId",
      s.service_name_snapshot as "serviceName",
      count(*)::int as "cancelCount",
      coalesce(sum(s.price_snapshot), 0) as "canceledRevenue"
    from appointment_services s
    join appointments a on a.id = s.appointment_id
    where a.appointment_date between $1::date and $2::date
      and s.status = 'CANCELED'
    group by s.service_id, s.service_name_snapshot
    order by "cancelCount" desc, "canceledRevenue" desc
    limit 10
  `;

  const topCustomersSql = `
    select
      coalesce(ap.customer_id::text, 'GUEST') as "customerId",
      ap.customer_name_snapshot as "customerName",
      count(distinct a.id)::int as visits,
      coalesce(sum(a.grand_total), 0) as revenue
    from appointment_participants ap
    join appointments a on a.id = ap.appointment_id
    where a.appointment_date between $1::date and $2::date
      and ${ACTIVE_APPOINTMENT_FILTER}
    group by coalesce(ap.customer_id::text, 'GUEST'), ap.customer_name_snapshot
    order by revenue desc, visits desc
    limit 10
  `;

  const walkInTrendSql = `
    select
      a.appointment_date as date,
      count(*) filter (where coalesce(a.source, '') = 'WALK_IN')::int as walk_in,
      count(*) filter (where coalesce(a.source, '') <> 'WALK_IN')::int as booked
    from appointments a
    where a.appointment_date between $1::date and $2::date
    group by a.appointment_date
    order by a.appointment_date asc
  `;

  const [
    summaryResult,
    revenueTrendResult,
    revenueByCategoryResult,
    paymentMethodsResult,
    peakHoursResult,
    staffPerformanceResult,
    topServicesResult,
    topCanceledServicesResult,
    topCustomersResult,
    walkInTrendResult,
  ] = await Promise.all([
    pool.query(summarySql, values),
    pool.query(revenueTrendSql, values),
    pool.query(revenueByCategorySql, values),
    pool.query(paymentMethodsSql, values),
    pool.query(peakHoursSql, values),
    pool.query(staffPerformanceSql, values),
    pool.query(topServicesSql, values),
    pool.query(topCanceledServicesSql, values),
    pool.query(topCustomersSql, values),
    pool.query(walkInTrendSql, values),
  ]);

  return {
    range: { from: values[0], to: values[1] },
    summary: summaryResult.rows[0] || null,
    charts: {
      revenueTrend: revenueTrendResult.rows,
      revenueByCategory: revenueByCategoryResult.rows,
      paymentMethods: paymentMethodsResult.rows,
      peakHours: peakHoursResult.rows,
      walkInVsBookedTrend: walkInTrendResult.rows,
    },
    staff: {
      performance: staffPerformanceResult.rows,
    },
    services: {
      topServices: topServicesResult.rows,
      topCanceledServices: topCanceledServicesResult.rows,
      categoryMix: revenueByCategoryResult.rows,
      mostProfitableServices: [...topServicesResult.rows]
        .sort((a, b) => Number(b.profit || 0) - Number(a.profit || 0))
        .slice(0, 10),
    },
    customers: {
      topSpendingCustomers: topCustomersResult.rows,
    },
  };
}

module.exports = {
  getDashboardSummary,
  getOwnerReport,
};