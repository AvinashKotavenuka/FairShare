import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import { users, groups, expenses, expenseSplits, balances, transactions, friends, groupMembers, activities, comments, categories } from './src/db/schema.ts';
import { eq, and, or } from 'drizzle-orm';
import { ExpenseService } from './src/services/expenseService.ts';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Routes ---

  // User Management
  app.post('/api/users', async (req, res) => {
    try {
      const { name, email, username, password } = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        username: z.string().min(3),
        password: z.string().min(6),
      }).parse(req.body);

      // Check if user already exists
      const existing = await db.query.users.findFirst({
        where: or(eq(users.email, email), eq(users.username, username)),
      });
      if (existing) {
        return res.status(400).json({ error: 'User with this email or username already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const [user] = await db.insert(users).values({ 
        name, 
        email: email.toLowerCase().trim(), 
        username: username.toLowerCase().trim(), 
        password: hashedPassword 
      }).returning();
      
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/users/by-username/:username', async (req, res) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.username, req.params.username),
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/users/login', async (req, res) => {
    try {
      const { identifier, password } = z.object({
        identifier: z.string().min(1),
        password: z.string().min(1),
      }).parse(req.body);

      const user = await db.query.users.findFirst({
        where: or(
          eq(users.email, identifier.toLowerCase().trim()),
          eq(users.username, identifier.toLowerCase().trim())
        ),
      });

      if (!user) return res.status(404).json({ error: 'User not found' });
      
      // If user has no password (legacy user), we might want to handle it.
      // For now, if they have a password, check it.
      if (user.password) {
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Invalid password' });
      } else {
        // Legacy user with no password - they should probably set one.
        // For now, we'll allow login but maybe warn them?
        // Actually, let's force them to set a password if they don't have one?
        // Or just allow it for now to avoid locking them out.
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/users', async (req, res) => {
    const allUsers = await db.query.users.findMany();
    res.json(allUsers.map(({ password, ...u }) => u));
  });

  // Friends Management
  app.post('/api/friends', async (req, res) => {
    try {
      const { user1Id, user2Id } = z.object({
        user1Id: z.number(),
        user2Id: z.number(),
      }).parse(req.body);

      // Check if they are already friends (in either direction)
      const existing = await db.query.friends.findFirst({
        where: or(
          and(eq(friends.user1Id, user1Id), eq(friends.user2Id, user2Id)),
          and(eq(friends.user1Id, user2Id), eq(friends.user2Id, user1Id))
        ),
      });

      if (existing) {
        return res.status(400).json({ error: 'You are already friends!' });
      }

      const [friend] = await db.insert(friends).values({ user1Id, user2Id }).returning();
      res.status(201).json(friend);
    } catch (error) {
      console.error('Friend add error:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/friends/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const userFriends = await db.query.friends.findMany({
        where: or(eq(friends.user1Id, userId), eq(friends.user2Id, userId)),
      });
      
      const friendIds = userFriends.map(f => f.user1Id === userId ? f.user2Id : f.user1Id);
      if (friendIds.length === 0) return res.json([]);
      
      const friendUsers = await db.query.users.findMany({
        where: or(...friendIds.map(id => eq(users.id, id)))
      });
      res.json(friendUsers);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Group Management
  app.post('/api/groups', async (req, res) => {
    try {
      const { name, memberIds } = z.object({
        name: z.string().min(1),
        memberIds: z.array(z.number()),
      }).parse(req.body);

      const [group] = await db.insert(groups).values({ name }).returning();
      
      for (const userId of memberIds) {
        await db.insert(groupMembers).values({ groupId: group.id, userId });
      }

      res.status(201).json(group);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/groups', async (req, res) => {
    const allGroups = await db.query.groups.findMany();
    res.json(allGroups);
  });

  app.get('/api/groups/:groupId/members', async (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const members = await db.query.groupMembers.findMany({
      where: eq(groupMembers.groupId, groupId),
      with: {
        user: true
      }
    });
    res.json(members.map(m => m.user));
  });

  // Categories
  app.get('/api/categories', async (req, res) => {
    const allCategories = await db.query.categories.findMany();
    res.json(allCategories);
  });

  // Expense Management
  app.get('/api/expenses', async (req, res) => {
    try {
      const allExpenses = await db.query.expenses.findMany({
        with: {
          payer: true,
          group: true,
          category: true,
          splits: {
            with: {
              user: true
            }
          }
        },
        orderBy: (expenses, { desc }) => [desc(expenses.timestamp)]
      });
      res.json(allExpenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  });

  app.post('/api/expenses', async (req, res) => {
    try {
      const schema = z.object({
        amount: z.string(),
        description: z.string().min(1),
        payerId: z.number(),
        groupId: z.number().optional(),
        categoryId: z.number().optional(),
        receiptUrl: z.string().optional(),
        currency: z.string().optional(),
        exchangeRate: z.string().optional(),
        recurringType: z.string().optional(),
        splits: z.array(z.object({
          userId: z.number(),
          amount: z.string(),
        })),
      });

      const data = schema.parse(req.body);
      const expense = await ExpenseService.addExpense(data);
      res.status(201).json(expense);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Balances
  app.get('/api/balances', async (req, res) => {
    try {
      const { groupId, userId } = req.query;
      let whereClause;
      if (groupId) {
        whereClause = eq(balances.groupId, parseInt(groupId as string));
      } else if (userId) {
        whereClause = or(eq(balances.user1Id, parseInt(userId as string)), eq(balances.user2Id, parseInt(userId as string)));
      }
      const allBalances = await db.query.balances.findMany({ where: whereClause });
      res.json(allBalances);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Settle
  app.post('/api/settle', async (req, res) => {
    try {
      const schema = z.object({
        payerId: z.number(),
        receiverId: z.number(),
        groupId: z.number().optional(),
        amount: z.string(),
      });

      const data = schema.parse(req.body);
      await ExpenseService.settle(data);
      res.status(200).json({ message: 'Settlement recorded successfully' });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Optimize Settlement
  app.get('/api/optimize-settlement', async (req, res) => {
    try {
      const { groupId, userId } = req.query;
      const optimized = await ExpenseService.optimizeSettlement(
        groupId ? parseInt(groupId as string) : undefined,
        userId ? parseInt(userId as string) : undefined
      );
      res.json(optimized);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Activities
  app.get('/api/activities/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Get all expense IDs the user is part of
      const userSplits = await db.query.expenseSplits.findMany({
        where: eq(expenseSplits.userId, userId),
      });
      const expenseIds = userSplits.map(s => s.expenseId);
      
      const whereClause = expenseIds.length > 0 
        ? or(eq(activities.userId, userId), ...expenseIds.map(id => eq(activities.expenseId, id)))
        : eq(activities.userId, userId);

      const userActivities = await db.query.activities.findMany({
        where: whereClause,
        orderBy: (activities, { desc }) => [desc(activities.timestamp)],
        limit: 20,
      });
      res.json(userActivities);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Comments
  app.post('/api/expenses/:expenseId/comments', async (req, res) => {
    try {
      const { userId, text } = z.object({
        userId: z.number(),
        text: z.string().min(1),
      }).parse(req.body);
      const expenseId = parseInt(req.params.expenseId);
      const [comment] = await db.insert(comments).values({ expenseId, userId, text }).returning();
      res.status(201).json(comment);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/expenses/:expenseId/comments', async (req, res) => {
    const expenseId = parseInt(req.params.expenseId);
    const allComments = await db.query.comments.findMany({
      where: eq(comments.expenseId, expenseId),
      with: { user: true },
      orderBy: (comments, { asc }) => [asc(comments.timestamp)],
    });
    res.json(allComments);
  });

  // Analytics
  app.get('/api/analytics/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    const userExpenses = await db.query.expenseSplits.findMany({
      where: eq(expenseSplits.userId, userId),
      with: {
        expense: {
          with: {
            payer: true,
            group: true,
          }
        }
      }
    });
    res.json(userExpenses);
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
