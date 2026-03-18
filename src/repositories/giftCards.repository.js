const pool = require("../db/pool");

function generateGiftCardCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GC-";
  for (let i = 0; i < 8; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function generateUniqueGiftCardCode(client) {
  for (let i = 0; i < 10; i += 1) {
    const code = generateGiftCardCode();

    const exists = await client.query(
      `
      select id
      from gift_cards
      where code = $1
      limit 1
      `,
      [code]
    );

    if (exists.rows.length === 0) {
      return code;
    }
  }

  throw new Error("Failed to generate unique gift card code");
}

async function createGiftCard({
  customerId = null,
  initialBalance,
  expiresAt = null,
  notes = null,
  createdByStaffId = null,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const code = await generateUniqueGiftCardCode(client);
    const balance = Number(initialBalance || 0);

    // 1. insert gift card
    const giftCardResult = await client.query(
      `
      insert into gift_cards (
        code,
        customer_id,
        initial_balance,
        remaining_balance,
        status,
        purchased_at,
        expires_at,
        notes,
        created_by_staff_id,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, 'ACTIVE', now(), $5, $6, $7, now(), now()
      )
      returning
        id,
        code,
        customer_id as "customerId",
        initial_balance as "initialBalance",
        remaining_balance as "remainingBalance",
        status,
        purchased_at as "purchasedAt",
        expires_at as "expiresAt",
        notes,
        created_by_staff_id as "createdByStaffId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      `,
      [code, customerId, balance, balance, expiresAt, notes, createdByStaffId]
    );

    const giftCard = giftCardResult.rows[0];

    // 2. insert ISSUE transaction (FIXED PARAMS)
    await client.query(
      `
      insert into gift_card_transactions (
        gift_card_id,
        appointment_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        note,
        created_by_staff_id,
        created_at
      )
      values (
        $1, null, 'ISSUE', $2, 0, $3, $4, $5, now()
      )
      `,
      [
        giftCard.id,
        balance,        // amount
        balance,        // balance_after
        notes,
        createdByStaffId,
      ]
    );

    await client.query("COMMIT");

    return giftCard;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getGiftCardById(id) {
  const cardResult = await pool.query(
    `
    select
      id,
      code,
      customer_id as "customerId",
      initial_balance as "initialBalance",
      remaining_balance as "remainingBalance",
      status,
      purchased_at as "purchasedAt",
      expires_at as "expiresAt",
      notes,
      created_by_staff_id as "createdByStaffId",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from gift_cards
    where id = $1
    limit 1
    `,
    [id]
  );

  if (cardResult.rows.length === 0) return null;

  const txResult = await pool.query(
    `
    select
      id,
      gift_card_id as "giftCardId",
      appointment_id as "appointmentId",
      transaction_type as "transactionType",
      amount,
      balance_before as "balanceBefore",
      balance_after as "balanceAfter",
      note,
      created_by_staff_id as "createdByStaffId",
      created_at as "createdAt"
    from gift_card_transactions
    where gift_card_id = $1
    order by created_at desc
    `,
    [id]
  );

  return {
    ...cardResult.rows[0],
    transactions: txResult.rows,
  };
}

async function getGiftCardByCode(code) {
  const result = await pool.query(
    `
    select
      id,
      code,
      customer_id as "customerId",
      initial_balance as "initialBalance",
      remaining_balance as "remainingBalance",
      status,
      purchased_at as "purchasedAt",
      expires_at as "expiresAt",
      notes,
      created_by_staff_id as "createdByStaffId",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from gift_cards
    where code = $1
    limit 1
    `,
    [code]
  );

  return result.rows[0] || null;
}

async function redeemGiftCard(
  id,
  { amount, appointmentId = null, note = null, createdByStaffId = null }
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cardResult = await client.query(
      `
      select
        id,
        code,
        remaining_balance,
        status,
        expires_at
      from gift_cards
      where id = $1
      limit 1
      `,
      [id]
    );

    if (cardResult.rows.length === 0) {
      throw new Error("Gift card not found");
    }

    const card = cardResult.rows[0];
    const redeemAmount = Number(amount || 0);

    if (redeemAmount <= 0) {
      throw new Error("Redeem amount must be greater than 0");
    }

    if (card.status !== "ACTIVE") {
      throw new Error(`Gift card is not redeemable. Current status: ${card.status}`);
    }

    if (card.expires_at && new Date(card.expires_at) < new Date()) {
      throw new Error("Gift card has expired");
    }

    const balanceBefore = Number(card.remaining_balance || 0);

    if (redeemAmount > balanceBefore) {
      throw new Error("Insufficient gift card balance");
    }

    const balanceAfter = balanceBefore - redeemAmount;
    const nextStatus = balanceAfter <= 0 ? "USED" : "ACTIVE";

    const updatedResult = await client.query(
      `
      update gift_cards
      set
        remaining_balance = $2,
        status = $3,
        updated_at = now()
      where id = $1
      returning
        id,
        code,
        customer_id as "customerId",
        initial_balance as "initialBalance",
        remaining_balance as "remainingBalance",
        status,
        purchased_at as "purchasedAt",
        expires_at as "expiresAt",
        notes,
        created_by_staff_id as "createdByStaffId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      `,
      [id, balanceAfter, nextStatus]
    );

    const txResult = await client.query(
      `
      insert into gift_card_transactions (
        gift_card_id,
        appointment_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        note,
        created_by_staff_id,
        created_at
      )
      values (
        $1, $2, 'REDEEM', $3, $4, $5, $6, $7, now()
      )
      returning
        id,
        gift_card_id as "giftCardId",
        appointment_id as "appointmentId",
        transaction_type as "transactionType",
        amount,
        balance_before as "balanceBefore",
        balance_after as "balanceAfter",
        note,
        created_by_staff_id as "createdByStaffId",
        created_at as "createdAt"
      `,
      [id, appointmentId, redeemAmount, balanceBefore, balanceAfter, note, createdByStaffId]
    );

    await client.query("COMMIT");

    return {
      giftCard: updatedResult.rows[0],
      transaction: txResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getRedeemableGiftCardByCode(client, code) {
  const result = await client.query(
    `
    select
      id,
      code,
      remaining_balance,
      status,
      expires_at
    from gift_cards
    where code = $1
    limit 1
    `,
    [code]
  );

  return result.rows[0] || null;
}

async function redeemGiftCardWithClient(
  client,
  { giftCardId, appointmentId = null, amount, note = null, createdByStaffId = null }
) {
  const cardResult = await client.query(
    `
    select
      id,
      code,
      remaining_balance,
      status,
      expires_at
    from gift_cards
    where id = $1
    limit 1
    `,
    [giftCardId]
  );

  if (cardResult.rows.length === 0) {
    throw new Error("Gift card not found");
  }

  const card = cardResult.rows[0];
  const redeemAmount = Number(amount || 0);

  if (redeemAmount <= 0) {
    throw new Error("Redeem amount must be greater than 0");
  }

  if (card.status !== "ACTIVE") {
    throw new Error(`Gift card is not redeemable. Current status: ${card.status}`);
  }

  if (card.expires_at && new Date(card.expires_at) < new Date()) {
    throw new Error("Gift card has expired");
  }

  const balanceBefore = Number(card.remaining_balance || 0);

  if (redeemAmount > balanceBefore) {
    throw new Error("Insufficient gift card balance");
  }

  const balanceAfter = balanceBefore - redeemAmount;
  const nextStatus = balanceAfter <= 0 ? "USED" : "ACTIVE";

  const updatedResult = await client.query(
    `
    update gift_cards
    set
      remaining_balance = $2,
      status = $3,
      updated_at = now()
    where id = $1
    returning
      id,
      code,
      remaining_balance as "remainingBalance",
      status
    `,
    [giftCardId, balanceAfter, nextStatus]
  );

  const txResult = await client.query(
    `
    insert into gift_card_transactions (
      gift_card_id,
      appointment_id,
      transaction_type,
      amount,
      balance_before,
      balance_after,
      note,
      created_by_staff_id,
      created_at
    )
    values (
      $1, $2, 'REDEEM', $3, $4, $5, $6, $7, now()
    )
    returning
      id,
      gift_card_id as "giftCardId",
      appointment_id as "appointmentId",
      transaction_type as "transactionType",
      amount,
      balance_before as "balanceBefore",
      balance_after as "balanceAfter",
      note,
      created_by_staff_id as "createdByStaffId",
      created_at as "createdAt"
    `,
    [giftCardId, appointmentId, redeemAmount, balanceBefore, balanceAfter, note, createdByStaffId]
  );

  return {
    giftCard: updatedResult.rows[0],
    transaction: txResult.rows[0],
  };
}

module.exports = {
  createGiftCard,
  getGiftCardById,
  getGiftCardByCode,
  redeemGiftCard,
  getRedeemableGiftCardByCode,
  redeemGiftCardWithClient
};