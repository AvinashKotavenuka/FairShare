import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password'), // Hashed password
  avatar: text('avatar'), // URL to avatar
});

export const usersRelations = relations(users, ({ many }) => ({
  groupMembers: many(groupMembers),
  expenses: many(expenses),
  expenseSplits: many(expenseSplits),
  activities: many(activities),
}));

export const friends = sqliteTable('friends', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user1Id: integer('user1_id').notNull().references(() => users.id),
  user2Id: integer('user2_id').notNull().references(() => users.id),
  status: text('status').notNull().default('accepted'), // 'pending', 'accepted'
}, (table) => ({
  unq: unique().on(table.user1Id, table.user2Id),
}));

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  avatar: text('avatar'),
});

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  expenses: many(expenses),
}));

export const groupMembers = sqliteTable('group_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => groups.id),
  userId: integer('user_id').notNull().references(() => users.id),
});

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon').notNull(), // Lucide icon name
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: text('amount').notNull(),
  description: text('description').notNull(),
  payerId: integer('payer_id').notNull().references(() => users.id),
  groupId: integer('group_id').references(() => groups.id), // Nullable for individual expenses
  categoryId: integer('category_id').references(() => categories.id),
  receiptUrl: text('receipt_url'),
  currency: text('currency').notNull().default('USD'),
  exchangeRate: text('exchange_rate').notNull().default('1.0'),
  recurringType: text('recurring_type'), // 'daily', 'weekly', 'monthly', 'yearly'
  nextOccurrence: integer('next_occurrence', { mode: 'timestamp' }),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  expenseId: integer('expense_id').notNull().references(() => expenses.id),
  userId: integer('user_id').notNull().references(() => users.id),
  text: text('text').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  payer: one(users, {
    fields: [expenses.payerId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  category: one(categories, {
    fields: [expenses.categoryId],
    references: [categories.id],
  }),
  splits: many(expenseSplits),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  expense: one(expenses, {
    fields: [comments.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const expenseSplits = sqliteTable('expense_splits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  expenseId: integer('expense_id').notNull().references(() => expenses.id),
  amount: text('amount').notNull(),
});

export const expenseSplitsRelations = relations(expenseSplits, ({ one }) => ({
  user: one(users, {
    fields: [expenseSplits.userId],
    references: [users.id],
  }),
  expense: one(expenses, {
    fields: [expenseSplits.expenseId],
    references: [expenses.id],
  }),
}));

export const balances = sqliteTable('balances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').references(() => groups.id), // Nullable for individual balances
  user1Id: integer('user1_id').notNull().references(() => users.id),
  user2Id: integer('user2_id').notNull().references(() => users.id),
  netAmount: text('net_amount').notNull(), // user1 owes user2 if positive
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  payerId: integer('payer_id').notNull().references(() => users.id),
  receiverId: integer('receiver_id').notNull().references(() => users.id),
  groupId: integer('group_id').references(() => groups.id),
  amount: text('amount').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(new Date()),
});

export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  expenseId: integer('expense_id').references(() => expenses.id),
  type: text('type').notNull(), // 'expense_added', 'settlement', 'group_created'
  description: text('description').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(new Date()),
});
