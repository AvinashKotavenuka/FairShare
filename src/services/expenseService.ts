import { db } from '../db/index.ts';
import { users, groups, expenses, expenseSplits, balances, transactions, activities, groupMembers } from '../db/schema.ts';
import { eq, and, or, isNull } from 'drizzle-orm';
import { Decimal } from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export class ExpenseService {
  /**
   * Adds an expense and updates balances incrementally.
   */
  static async addExpense(data: {
    amount: string;
    description: string;
    payerId: number;
    groupId?: number;
    categoryId?: number;
    receiptUrl?: string;
    currency?: string;
    exchangeRate?: string;
    recurringType?: string;
    splits: { userId: number; amount: string }[];
  }) {
    const { 
      amount, description, payerId, groupId, categoryId, 
      receiptUrl, currency, exchangeRate, recurringType, splits 
    } = data;

    // Calculate next occurrence if recurring
    let nextOccurrence: Date | undefined = undefined;
    if (recurringType) {
      const now = new Date();
      if (recurringType === 'daily') nextOccurrence = new Date(now.setDate(now.getDate() + 1));
      else if (recurringType === 'weekly') nextOccurrence = new Date(now.setDate(now.getDate() + 7));
      else if (recurringType === 'monthly') nextOccurrence = new Date(now.setMonth(now.getMonth() + 1));
      else if (recurringType === 'yearly') nextOccurrence = new Date(now.setFullYear(now.getFullYear() + 1));
    }

    // 1. Create the expense record
    const [expense] = await db.insert(expenses).values({
      amount,
      description,
      payerId,
      groupId,
      categoryId,
      receiptUrl,
      currency: currency || 'USD',
      exchangeRate: exchangeRate || '1.0',
      recurringType,
      nextOccurrence,
      timestamp: new Date(),
    }).returning();

    // 2. Create the splits
    for (const split of splits) {
      await db.insert(expenseSplits).values({
        userId: split.userId,
        expenseId: expense.id,
        amount: split.amount,
      });

      // 3. Update balances incrementally (payer vs participant)
      if (split.userId !== payerId) {
        await this.updateBalance(groupId, split.userId, payerId, split.amount);
      }
    }

    // 4. Log activity
    const payer = await db.query.users.findFirst({ where: eq(users.id, payerId) });
    await db.insert(activities).values({
      userId: payerId,
      expenseId: expense.id,
      type: 'expense_added',
      description: `${payer?.name} added "${description}" in ${groupId ? 'a group' : 'a private split'}.`,
      timestamp: new Date(),
    });

    return expense;
  }

  /**
   * Updates the balance between two users.
   * user1 owes user2 if netAmount is positive.
   */
  private static async updateBalance(groupId: number | undefined, debtorId: number, creditorId: number, amount: string) {
    const [u1, u2] = debtorId < creditorId ? [debtorId, creditorId] : [creditorId, debtorId];
    const isU1Debtor = u1 === debtorId;

    const whereClause = groupId 
      ? and(eq(balances.groupId, groupId), eq(balances.user1Id, u1), eq(balances.user2Id, u2))
      : and(isNull(balances.groupId), eq(balances.user1Id, u1), eq(balances.user2Id, u2));

    let balance = await db.query.balances.findFirst({ where: whereClause });

    const delta = new Decimal(amount);

    if (!balance) {
      const netAmount = isU1Debtor ? delta.toString() : delta.negated().toString();
      await db.insert(balances).values({
        groupId,
        user1Id: u1,
        user2Id: u2,
        netAmount,
      });
    } else {
      let currentNet = new Decimal(balance.netAmount);
      if (isU1Debtor) {
        currentNet = currentNet.plus(delta);
      } else {
        currentNet = currentNet.minus(delta);
      }
      await db.update(balances)
        .set({ netAmount: currentNet.toString() })
        .where(eq(balances.id, balance.id));
    }
  }

  /**
   * Settles a partial or full debt between two users.
   */
  static async settle(data: {
    payerId: number;
    receiverId: number;
    groupId?: number;
    amount: string;
  }) {
    const { payerId, receiverId, groupId, amount } = data;

    await db.insert(transactions).values({
      payerId,
      receiverId,
      groupId,
      amount,
      timestamp: new Date(),
    });

    await this.updateBalance(groupId, payerId, receiverId, new Decimal(amount).negated().toString());

    const payer = await db.query.users.findFirst({ where: eq(users.id, payerId) });
    const receiver = await db.query.users.findFirst({ where: eq(users.id, receiverId) });
    await db.insert(activities).values({
      userId: payerId,
      type: 'settlement',
      description: `${payer?.name} paid ${receiver?.name} $${amount}.`,
      timestamp: new Date(),
    });
  }

  /**
   * Optimizes settlements using a greedy approach.
   */
  static async optimizeSettlement(groupId?: number, userId?: number) {
    const whereClause = groupId 
      ? eq(balances.groupId, groupId)
      : userId 
        ? or(eq(balances.user1Id, userId), eq(balances.user2Id, userId))
        : undefined;

    const allBalances = await db.query.balances.findMany({ where: whereClause });

    const netBalances: Record<number, Decimal> = {};
    for (const b of allBalances) {
      const u1 = b.user1Id;
      const u2 = b.user2Id;
      const net = new Decimal(b.netAmount);

      netBalances[u1] = (netBalances[u1] || new Decimal(0)).minus(net);
      netBalances[u2] = (netBalances[u2] || new Decimal(0)).plus(net);
    }

    const debtors: { userId: number; amount: Decimal }[] = [];
    const creditors: { userId: number; amount: Decimal }[] = [];

    for (const userIdStr in netBalances) {
      const uId = parseInt(userIdStr);
      const amt = netBalances[uId];
      if (amt.isNegative()) {
        debtors.push({ userId: uId, amount: amt.abs() });
      } else if (amt.isPositive()) {
        creditors.push({ userId: uId, amount: amt });
      }
    }

    debtors.sort((a, b) => b.amount.comparedTo(a.amount));
    creditors.sort((a, b) => b.amount.comparedTo(a.amount));

    const optimizedTransactions: { from: number; to: number; amount: string }[] = [];

    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const settleAmount = Decimal.min(debtor.amount, creditor.amount);
      optimizedTransactions.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: settleAmount.toString(),
      });

      debtor.amount = debtor.amount.minus(settleAmount);
      creditor.amount = creditor.amount.minus(settleAmount);

      if (debtor.amount.isZero()) i++;
      if (creditor.amount.isZero()) j++;
    }

    return optimizedTransactions;
  }
}
