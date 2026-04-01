import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FirebaseService } from './services/firebaseService';
import {
  Plus, Users, DollarSign, ArrowRight, CheckCircle,
  RefreshCw, ChevronRight, Home, User as UserIcon, Activity,
  Settings, Search, Filter, Tag, PieChart as PieChartIcon, LogOut,
  Bell, CreditCard, Wallet, TrendingUp, TrendingDown,
  Mail, Hash, Moon, Sun, Camera, Globe, Repeat, MessageSquare,
  BarChart as BarChartIcon, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Decimal } from 'decimal.js';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line
} from 'recharts';

// Types
interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface Balance {
  id: string;
  groupId: string | null;
  user1Id: string;
  user2Id: string;
  netAmount: string;
}

interface OptimizedTransaction {
  from: string;
  to: string;
  amount: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface ActivityLog {
  id: string;
  type: string;
  description: string;
  expenseId?: string;
  timestamp: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'recent' | 'expenses' | 'groups' | 'friends' | 'accounts' | 'analytics'>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [optimized, setOptimized] = useState<OptimizedTransaction[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [expenseGroupMembers, setExpenseGroupMembers] = useState<User[]>([]);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Form states
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [payerId, setPayerId] = useState<string | ''>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | ''>('');
  const [expenseGroupId, setExpenseGroupId] = useState<string | ''>('');
  const [splitType, setSplitType] = useState<'equal' | 'unequal'>('equal');
  const [unequalSplits, setUnequalSplits] = useState<Record<string, string>>({});
  const [receiptUrl, setReceiptUrl] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [recurringType, setRecurringType] = useState('');

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [friendUsernameInput, setFriendUsernameInput] = useState('');

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      console.log('Dark mode enabled');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      console.log('Light mode enabled');
    }
  }, [darkMode]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUserSpecificData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupData(selectedGroup.id);
    }
  }, [selectedGroup]);

  useEffect(() => {
    const fetchExpenseGroupMembers = async () => {
      setExpenseGroupMembers([]);
      if (expenseGroupId && expenseGroupId !== 0) {
        const res = await axios.get(`/api/groups/${expenseGroupId}/members`);
        setExpenseGroupMembers(res.data);
      } else {
        setExpenseGroupMembers([]);
      }
      setPayerId('');
      setUnequalSplits({});
    };
    fetchExpenseGroupMembers();
  }, [expenseGroupId]);

  useEffect(() => {
    if (activeTab === 'expenses') {
      fetchAllExpenses();
      if (selectedGroup) {
        setExpenseGroupId(selectedGroup.id);
      } else {
        setExpenseGroupId('');
      }
    } else {
      // Reset expense form when leaving expenses tab
      setExpenseDesc('');
      setExpenseAmount('');
      setPayerId('');
      setSelectedCategoryId('');
      setExpenseGroupId('');
      setSplitType('equal');
      setUnequalSplits({});
      setReceiptUrl('');
      setCurrency('USD');
      setRecurringType('');
    }
  }, [activeTab, selectedGroup]);

  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [expenseComments, setExpenseComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSettling, setIsSettling] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleToUserId, setSettleToUserId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchComments = async (expenseId: string) => {
    // Left empty. Real-time Firebase listeners handles most data.
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseId || !newComment || !currentUser) return;
    try {
      await FirebaseService.addComment(selectedExpenseId, currentUser.id, newComment);
      setNewComment('');
    } catch (err) {
      console.error(err);
    }
  };

  const settleUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !settleToUserId || !settleAmount) return;
    setLoading(true);
    try {
      await FirebaseService.addExpense({
        description: `Settlement to ${getUserName(String(settleToUserId))}`,
        amount: settleAmount,
        payerId: currentUser.id,
        splitType: 'unequal',
        splits: [{ userId: settleToUserId, amount: settleAmount }],
        isSettlement: true
      });
      setIsSettling(false);
      setSettleAmount('');
      setSettleToUserId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExpenseId) {
      fetchComments(selectedExpenseId);
    }
  }, [selectedExpenseId]);

  const fetchInitialData = async () => {
    try {
      const usersData = await FirebaseService.getAllUsers();
      setUsers(usersData as any);
      // Groups loaded via realtime listener
      setCategories([
        { id: '1', name: 'Housing', icon: 'Home' },
        { id: '2', name: 'Food', icon: 'ShoppingCart' },
        { id: '3', name: 'Transportation', icon: 'Car' },
        { id: '4', name: 'Utilities', icon: 'Zap' },
        { id: '5', name: 'Entertainment', icon: 'Film' },
        { id: '6', name: 'Other', icon: 'MoreHorizontal' }
      ] as any);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const unsub = FirebaseService.listenToUserSpecificData(currentUser.id, (data) => {
      setFriends(data.friends);
      setFriendRequests(data.requests);
      setGroups(data.groups);
      setAllExpenses(data.expenses);
      setActivities(data.activities);
      setBalances(data.balances);
      setOptimized(data.optimized);
    });
    return () => unsub();
  }, [currentUser]);

  const fetchUserSpecificData = async () => { /* Now handled by realtime listener */ };
  const fetchAllExpenses = async () => { /* Now handled by realtime listener */ };
  const fetchGroupData = async (groupId: string) => { /* Realtime listener covers everything */ };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || !payerId || !expenseDesc || !currentUser) return;

    setLoading(true);
    try {
      let splits: { userId: string; amount: string }[] = [];
      const totalAmount = new Decimal(expenseAmount);

      const participants = expenseGroupId !== ''
        ? (expenseGroupId === '0' ? [currentUser, ...friends] : expenseGroupMembers)
        : (selectedGroup ? groupMembers : [currentUser, ...friends]);

      if (splitType === 'equal') {
        const perPerson = totalAmount.div(participants.length).toDecimalPlaces(2);
        let sum = new Decimal(0);
        splits = participants.map((u, i) => {
          if (i === participants.length - 1) {
            return { userId: String(u.id), amount: totalAmount.minus(sum).toString() };
          }
          sum = sum.plus(perPerson);
          return { userId: String(u.id), amount: perPerson.toString() };
        });
      } else {
        splits = participants.map(u => ({
          userId: String(u.id),
          amount: unequalSplits[String(u.id)] || '0',
        }));
      }

      await FirebaseService.addExpense({
        amount: expenseAmount,
        description: expenseDesc,
        payerId: String(payerId),
        groupId: expenseGroupId || selectedGroup?.id || null,
        categoryId: selectedCategoryId || null,
        receiptUrl: receiptUrl || null,
        currency,
        recurringType: recurringType || null,
        splits,
      });

      setExpenseDesc('');
      setExpenseAmount('');
      setUnequalSplits({});
      setExpenseGroupId('');
      setReceiptUrl('');
      setCurrency('USD');
      setRecurringType('');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to add expense. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const settleDebt = async (from: string, to: string, amount: string) => {
    setLoading(true);
    try {
      await FirebaseService.addExpense({
        description: `Settlement`,
        amount: amount,
        payerId: from,
        splitType: 'unequal',
        splits: [{ userId: to, amount: amount }],
        isSettlement: true,
        groupId: selectedGroup?.id || null
      });
    } catch (err: any) {
      console.error(err);
      alert('Failed to record settlement.');
    } finally {
      setLoading(false);
    }
  };

  const loginUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) return;
    setLoading(true);
    try {
      const userData = await FirebaseService.login(loginIdentifier, loginPassword);
      setCurrentUser(userData as any);
      setActiveTab('dashboard');
      setLoginIdentifier('');
      setLoginPassword('');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserUsername || !newUserPassword) return;

    setLoading(true);
    try {
      const userData = await FirebaseService.createUser(newUserName, newUserEmail, newUserUsername, newUserPassword);
      setCurrentUser(userData as any);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserUsername('');
      setNewUserPassword('');
      setActiveTab('dashboard');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to create user. Username or Email might already be in use.');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName || newGroupMembers.length === 0 || !currentUser) return;
    setLoading(true);
    try {
      await FirebaseService.createGroup(newGroupName, [...newGroupMembers, currentUser.id].filter(Boolean).map(String));
      setNewGroupName('');
      setNewGroupMembers([]);
      setActiveTab('dashboard');
    } catch (err: any) {
      console.error(err);
      alert('Failed to create group.');
    } finally {
      setLoading(false);
    }
  };

  const addFriend = async (friendId: string) => {
    if (!currentUser) return;
    if (friendId === currentUser.id) {
      alert("You can't add yourself as a friend!");
      return;
    }
    setLoading(true);
    try {
      await FirebaseService.sendFriendRequest(currentUser.id, friendId);
      alert('Friend request sent!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to add friend. They might already be your friend or a request is pending.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    setLoading(true);
    try {
      await FirebaseService.acceptFriendRequest(requestId);
    } catch (err: any) {
      console.error(err);
      alert('Failed to accept request.');
    } finally {
      setLoading(false);
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    setLoading(true);
    try {
      await FirebaseService.rejectFriendRequest(requestId);
    } catch (err: any) {
      console.error(err);
      alert('Failed to reject request.');
    } finally {
      setLoading(false);
    }
  };

  const addFriendByUsername = async (username: string) => {
    if (!currentUser || !username) return;
    setLoading(true);
    try {
      const user = await FirebaseService.getUserByUsername(username);
      await addFriend(user.id);
      setFriendUsernameInput('');
    } catch (err: any) {
      console.error(err);
      if (err.message === 'User not found') {
        alert('User not found.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (id: string) => users.find(u => String(u.id) === String(id))?.name || 'Unknown';

  const totalOwed = Array.isArray(balances) ? balances.reduce((acc, b) => {
    if (!currentUser) return acc;
    const amt = new Decimal(b.netAmount || '0');
    if (b.user1Id === currentUser.id) {
      return amt.isNegative() ? acc.plus(amt.abs()) : acc;
    } else {
      return amt.isPositive() ? acc.plus(amt) : acc;
    }
  }, new Decimal(0)) : new Decimal(0);

  const totalOwe = Array.isArray(balances) ? balances.reduce((acc, b) => {
    if (!currentUser) return acc;
    const amt = new Decimal(b.netAmount || '0');
    if (b.user1Id === currentUser.id) {
      return amt.isPositive() ? acc.plus(amt) : acc;
    } else {
      return amt.isNegative() ? acc.plus(amt.abs()) : acc;
    }
  }, new Decimal(0)) : new Decimal(0);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] flex items-center justify-center p-4 font-sans transition-colors">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-xl p-10 space-y-8 border border-gray-100 dark:border-gray-800 transition-colors"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-[#5BC5A7] rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto shadow-lg shadow-[#5BC5A7]/20">F</div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white pt-4">FairShare</h1>
            <p className="text-gray-500 dark:text-gray-400">
              {authMode === 'login' ? 'Welcome back! Please login to continue.' : 'Create an account to start splitting expenses'}
            </p>
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'login' ? 'bg-white dark:bg-gray-700 shadow-sm text-[#5BC5A7]' : 'text-gray-500'}`}
            >
              Login
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authMode === 'signup' ? 'bg-white dark:bg-gray-700 shadow-sm text-[#5BC5A7]' : 'text-gray-500'}`}
            >
              Sign Up
            </button>
          </div>

          <div className="space-y-6">
            {authMode === 'login' ? (
              <form onSubmit={loginUser} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email or Username</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="avinash@gmail.com"
                      value={loginIdentifier}
                      onChange={e => setLoginIdentifier(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] focus:ring-4 focus:ring-[#5BC5A7]/10 transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Settings className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] focus:ring-4 focus:ring-[#5BC5A7]/10 transition-all dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !loginIdentifier || !loginPassword}
                  className="w-full py-4 bg-[#5BC5A7] text-white font-bold rounded-2xl shadow-lg shadow-[#5BC5A7]/20 hover:bg-[#4eb094] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0"
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>
            ) : (
              <form onSubmit={createUser} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={newUserName}
                      onChange={e => setNewUserName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] focus:ring-4 focus:ring-[#5BC5A7]/10 transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Username</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="johndoe123"
                      value={newUserUsername}
                      onChange={e => setNewUserUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] focus:ring-4 focus:ring-[#5BC5A7]/10 transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      placeholder="john@example.com"
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] focus:ring-4 focus:ring-[#5BC5A7]/10 transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Settings className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      placeholder="Min 6 characters"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] focus:ring-4 focus:ring-[#5BC5A7]/10 transition-all dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !newUserName || !newUserEmail || !newUserUsername || !newUserPassword}
                  className="w-full py-4 bg-[#5BC5A7] text-white font-bold rounded-2xl shadow-lg shadow-[#5BC5A7]/20 hover:bg-[#4eb094] hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0"
                >
                  {loading ? 'Creating Account...' : 'Get Started'}
                </button>
              </form>
            )}

            {/* Quick Switch - Removed for security */}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#121212] flex text-[#212529] dark:text-[#E0E0E0] font-sans transition-colors duration-300">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-[#1E1E1E] border-b border-gray-200 dark:border-gray-800 z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#5BC5A7] rounded-lg flex items-center justify-center text-white font-bold text-lg">F</div>
          <span className="font-bold dark:text-white">FairShare</span>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-gray-500 dark:text-gray-400"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        w-64 bg-white dark:bg-[#1E1E1E] border-r border-gray-200 dark:border-gray-800 flex flex-col fixed h-full z-50 transition-all duration-300
        ${isSidebarOpen ? 'left-0' : '-left-64 lg:left-0'}
      `}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5BC5A7] rounded-lg flex items-center justify-center text-white font-bold text-xl">F</div>
          <span className="text-xl font-bold tracking-tight dark:text-white">FairShare</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button
            onClick={() => { setActiveTab('dashboard'); setSelectedGroup(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-[#5BC5A7] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <Home className="w-5 h-5" /> Dashboard
          </button>
          <button
            onClick={() => { setActiveTab('recent'); setSelectedGroup(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'recent' ? 'bg-[#5BC5A7] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <Activity className="w-5 h-5" /> Recent Activity
          </button>
          <button
            onClick={() => { setActiveTab('expenses'); setSelectedGroup(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'expenses' ? 'bg-[#5BC5A7] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <Filter className="w-5 h-5" /> All Expenses
          </button>
          <button
            onClick={() => { setActiveTab('groups'); setSelectedGroup(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'groups' ? 'bg-[#5BC5A7] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <Users className="w-5 h-5" /> Groups
          </button>
          <button
            onClick={() => { setActiveTab('friends'); setSelectedGroup(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'friends' ? 'bg-[#5BC5A7] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <UserIcon className="w-5 h-5" /> Friends
          </button>
          <button
            onClick={() => { setActiveTab('analytics'); setSelectedGroup(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'analytics' ? 'bg-[#5BC5A7] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <BarChartIcon className="w-5 h-5" /> Analytics
          </button>
          <button
            onClick={() => { setActiveTab('accounts'); setSelectedGroup(null); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'accounts' ? 'bg-[#5BC5A7] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            <Users className="w-5 h-5" /> Accounts
          </button>
        </nav>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            <div className="flex items-center gap-2">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${darkMode ? 'bg-[#5BC5A7]' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${darkMode ? 'left-4' : 'left-0.5'}`} />
            </div>
          </button>
        </div>

        <div className="p-4 mt-auto border-t border-gray-100 dark:border-gray-800">
          {currentUser && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl transition-colors">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}`} alt="avatar" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate dark:text-white">{currentUser.name}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">@{currentUser.username}</p>
              </div>
              <button
                onClick={() => setCurrentUser(null)}
                className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-4 lg:p-8 bg-[#F8F9FA] dark:bg-[#121212] min-h-screen transition-colors pt-20 lg:pt-8">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold capitalize dark:text-white">{selectedGroup ? selectedGroup.name : activeTab}</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('expenses')}
                className="px-6 py-2 bg-[#FF652F] text-white font-bold rounded-md hover:bg-[#e55a2a] transition-colors shadow-sm"
              >
                Add an expense
              </button>
              <button
                onClick={() => setIsSettling(true)}
                className="px-6 py-2 bg-[#5BC5A7] text-white font-bold rounded-md hover:bg-[#4eb094] transition-colors shadow-sm"
              >
                Settle up
              </button>
            </div>
          </header>

          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm transition-colors">
                <div className="p-6 border-r border-gray-100 dark:border-gray-800 text-center">
                  <p className="text-sm text-gray-400 font-medium mb-1 uppercase tracking-wider">total balance</p>
                  <p className={`text-2xl font-bold ${totalOwed.minus(totalOwe).isPositive() ? 'text-[#5BC5A7]' : 'text-[#FF652F]'}`}>
                    {totalOwed.minus(totalOwe).isPositive() ? '+' : ''}${totalOwed.minus(totalOwe).toString()}
                  </p>
                </div>
                <div className="p-6 border-r border-gray-100 dark:border-gray-800 text-center">
                  <p className="text-sm text-gray-400 font-medium mb-1 uppercase tracking-wider">you are owed</p>
                  <p className="text-2xl font-bold text-[#5BC5A7]">${totalOwed.toString()}</p>
                </div>
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-400 font-medium mb-1 uppercase tracking-wider">you owe</p>
                  <p className="text-2xl font-bold text-[#FF652F]">${totalOwe.toString()}</p>
                </div>
              </div>

              {/* Suggested Settlements */}
              {optimized.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">SUGGESTED SETTLEMENTS</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {optimized.map((opt, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserName(opt.from)}`} alt="avatar" />
                            </div>
                            <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden">
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserName(opt.to)}`} alt="avatar" />
                            </div>
                          </div>
                          <div className="text-sm">
                            <p className="font-bold dark:text-white">{getUserName(opt.from)} <ArrowRight className="inline w-3 h-3 mx-1" /> {getUserName(opt.to)}</p>
                            <p className="text-xs text-gray-400">${opt.amount}</p>
                          </div>
                        </div>
                        {currentUser?.id === opt.from && (
                          <button
                            onClick={() => {
                              setSettleToUserId(opt.to);
                              setSettleAmount(opt.amount);
                              setIsSettling(true);
                            }}
                            className="px-3 py-1 bg-[#5BC5A7] text-white text-xs font-bold rounded-md hover:bg-[#4eb094] transition-colors"
                          >
                            Settle
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Balances Detail */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">YOU OWE</h3>
                  <div className="space-y-2">
                    {Array.isArray(balances) && balances.filter(b => {
                      const amt = new Decimal(b.netAmount || '0');
                      return (b.user1Id === currentUser?.id && amt.isPositive()) || (b.user2Id === currentUser?.id && amt.isNegative());
                    }).map(b => {
                      const otherId = b.user1Id === currentUser?.id ? b.user2Id : b.user1Id;
                      const amt = new Decimal(b.netAmount || '0').abs();
                      return (
                        <div key={b.id} className="flex items-center gap-3 p-4 bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm transition-colors">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserName(otherId)}`} alt="avatar" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold dark:text-gray-200 truncate">{getUserName(otherId)}</p>
                            <p className="text-xs text-[#FF652F]">you owe <span className="font-bold">${amt.toString()}</span></p>
                          </div>
                          <button
                            onClick={() => {
                              setSettleToUserId(otherId);
                              setSettleAmount(amt.toString());
                              setIsSettling(true);
                            }}
                            className="px-3 py-1 bg-[#5BC5A7] text-white text-xs font-bold rounded-md hover:bg-[#4eb094] transition-colors"
                          >
                            Settle
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">YOU ARE OWED</h3>
                  <div className="space-y-2">
                    {Array.isArray(balances) && balances.filter(b => {
                      const amt = new Decimal(b.netAmount || '0');
                      return (b.user1Id === currentUser?.id && amt.isNegative()) || (b.user2Id === currentUser?.id && amt.isPositive());
                    }).map(b => {
                      const otherId = b.user1Id === currentUser?.id ? b.user2Id : b.user1Id;
                      const amt = new Decimal(b.netAmount || '0').abs();
                      return (
                        <div key={b.id} className="flex items-center gap-3 p-4 bg-white dark:bg-[#1E1E1E] border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm transition-colors">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${getUserName(otherId)}`} alt="avatar" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold dark:text-gray-200 truncate">{getUserName(otherId)}</p>
                            <p className="text-xs text-[#5BC5A7]">owes you <span className="font-bold">${amt.toString()}</span></p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'recent' && (
            <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden transition-colors">
              {activities.map((act, i) => (
                <div key={act.id} className={`p-4 flex items-center gap-4 ${i !== activities.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${act.type === 'expense_added' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                    {act.type === 'expense_added' ? <DollarSign className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium dark:text-gray-200">{act.description}</p>
                    <p className="text-xs text-gray-400">{new Date(act.timestamp).toLocaleString()}</p>
                  </div>
                  {act.expenseId && (
                    <button
                      onClick={() => setSelectedExpenseId(act.expenseId!)}
                      className="p-2 text-gray-400 hover:text-[#5BC5A7] dark:hover:text-[#5BC5A7] transition-colors"
                      title="View comments"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-8 transition-colors">
                <h2 className="text-xl font-bold mb-6 dark:text-white">Create New Group</h2>
                <form onSubmit={createGroup} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Group Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Apartment 402"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Add Members</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-100 dark:border-gray-700 rounded-lg">
                      {Array.isArray(friends) && friends.map(u => (
                        <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newGroupMembers.includes(u.id)}
                            onChange={e => {
                              if (e.target.checked) setNewGroupMembers([...newGroupMembers, u.id]);
                              else setNewGroupMembers(newGroupMembers.filter(id => id !== u.id));
                            }}
                            className="rounded border-gray-300 dark:border-gray-600 text-[#5BC5A7] focus:ring-[#5BC5A7]"
                          />
                          <span className="text-sm truncate dark:text-gray-300">{u.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    disabled={loading}
                    className="w-full py-3 bg-[#5BC5A7] text-white font-bold rounded-lg shadow-md hover:bg-[#4eb094] transition-all disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Group'}
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGroup(g);
                      setActiveTab('dashboard');
                    }}
                    className="flex items-center gap-4 p-6 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm hover:border-[#5BC5A7] transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-lg dark:text-white">{g.name}</p>
                      <p className="text-sm text-gray-400">View group expenses</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-8 transition-colors">
                <h2 className="text-xl font-bold mb-6 dark:text-white">Add Friend by Username</h2>
                <div className="flex gap-4 max-w-md">
                  <div className="flex-1 relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Enter Friend's Username"
                      value={friendUsernameInput}
                      onChange={e => setFriendUsernameInput(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] dark:text-white transition-all"
                    />
                  </div>
                  <button
                    onClick={() => addFriendByUsername(friendUsernameInput)}
                    disabled={loading || !friendUsernameInput}
                    className="px-6 py-3 bg-[#5BC5A7] text-white font-bold rounded-xl hover:bg-[#4eb094] transition-all disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <p className="mt-4 text-sm text-gray-400">Ask your friend for their unique username (found in their profile).</p>
              </div>

              {friendRequests.length > 0 && (
                <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-8 transition-colors">
                  <h2 className="text-xl font-bold mb-6 dark:text-white">Pending Requests</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {friendRequests.map(req => (
                      <div key={req.requestId} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${req.name}`} alt="avatar" />
                          </div>
                          <div>
                            <p className="font-bold text-sm dark:text-white">{req.name}</p>
                            <p className="text-xs text-gray-400">@{req.username}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => acceptFriendRequest(req.requestId)}
                            className="px-4 py-2 bg-[#5BC5A7] text-white text-sm font-bold rounded-lg hover:bg-[#4eb094] transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => rejectFriendRequest(req.requestId)}
                            className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-8 transition-colors">
                <h2 className="text-xl font-bold mb-6 dark:text-white">Your Friends</h2>
                <div className="grid grid-cols-2 gap-4">
                  {Array.isArray(friends) && friends.map(friend => (
                    <div key={friend.id} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.name}`} alt="avatar" />
                      </div>
                      <div>
                        <p className="font-bold dark:text-white">{friend.name}</p>
                        <p className="text-xs text-gray-400">{friend.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <>
              <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-8 transition-colors">
                <form onSubmit={addExpense} className="space-y-8 max-w-md mx-auto">
                  <div className="text-center space-y-4">
                    <div className="flex items-center gap-4 justify-center">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <Tag className="w-8 h-8" />
                      </div>
                      <div className="flex-1 text-left">
                        <input
                          type="text"
                          placeholder="Enter a description"
                          value={expenseDesc}
                          onChange={e => setExpenseDesc(e.target.value)}
                          className="w-full text-2xl font-bold border-b-2 border-gray-100 dark:border-gray-800 focus:border-[#5BC5A7] outline-none py-1 transition-colors bg-transparent dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 justify-center">
                      <span className="text-4xl font-light text-gray-300">$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={expenseAmount}
                        onChange={e => setExpenseAmount(e.target.value)}
                        className="text-5xl font-bold w-48 outline-none border-b-2 border-gray-100 dark:border-gray-800 focus:border-[#5BC5A7] transition-colors bg-transparent dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Paid By</label>
                      <select
                        value={payerId}
                        onChange={e => setPayerId(Number(e.target.value))}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] dark:text-white"
                      >
                        <option value="">Select Payer</option>
                        {(expenseGroupId !== ''
                          ? (expenseGroupId === 0 ? (currentUser ? [currentUser, ...friends] : []) : expenseGroupMembers)
                          : (selectedGroup ? groupMembers : (currentUser ? [currentUser, ...friends] : []))).map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Group (Optional)</label>
                      <select
                        value={expenseGroupId}
                        onChange={e => setExpenseGroupId(Number(e.target.value))}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] dark:text-white"
                      >
                        <option value="">No Group (Split with all)</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Category</label>
                      <select
                        value={selectedCategoryId}
                        onChange={e => setSelectedCategoryId(Number(e.target.value))}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] dark:text-white"
                      >
                        <option value="">General</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <Globe className="w-3 h-3" /> Currency
                      </label>
                      <select
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7]"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> Recurring
                      </label>
                      <select
                        value={recurringType}
                        onChange={e => setRecurringType(e.target.value)}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7]"
                      >
                        <option value="">One-time</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                      <Camera className="w-3 h-3" /> Receipt URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://example.com/receipt.jpg"
                      value={receiptUrl}
                      onChange={e => setReceiptUrl(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7]"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setSplitType('equal')}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${splitType === 'equal' ? 'bg-white dark:bg-gray-700 shadow-sm text-[#5BC5A7]' : 'text-gray-500'}`}
                      >
                        Equally
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitType('unequal')}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${splitType === 'unequal' ? 'bg-white dark:bg-gray-700 shadow-sm text-[#5BC5A7]' : 'text-gray-500'}`}
                      >
                        Unequally
                      </button>
                    </div>

                    {splitType === 'unequal' && (
                      <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                        {(expenseGroupId !== ''
                          ? (expenseGroupId === 0 ? (currentUser ? [currentUser, ...friends] : []) : expenseGroupMembers)
                          : (selectedGroup ? groupMembers : (currentUser ? [currentUser, ...friends] : []))).map(u => (
                            <div key={u.id} className="flex items-center justify-between">
                              <span className="text-sm font-medium dark:text-white">{u.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-300">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={unequalSplits[u.id] || ''}
                                  onChange={e => setUnequalSplits({ ...unequalSplits, [u.id]: e.target.value })}
                                  className="w-20 p-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-right text-sm dark:text-white"
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <button
                    disabled={loading}
                    className="w-full py-4 bg-[#5BC5A7] text-white font-bold text-xl rounded-xl shadow-lg hover:bg-[#4eb094] transition-all disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Expense'}
                  </button>
                </form>
              </div>

              <div className="mt-12 space-y-6">
                <h2 className="text-xl font-bold dark:text-white">Recent Expenses</h2>
                <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden transition-colors">
                  {allExpenses.length === 0 ? (
                    <p className="p-8 text-center text-gray-400">No expenses found.</p>
                  ) : (
                    allExpenses.map((exp, i) => (
                      <div key={exp.id} className={`p-4 flex items-center gap-4 ${i !== allExpenses.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-[#5BC5A7] font-bold">
                          {exp.category?.icon || <DollarSign className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold dark:text-gray-200 truncate">{exp.description}</p>
                          <p className="text-xs text-gray-400">
                            Paid by <span className="font-medium text-gray-600 dark:text-gray-300">{exp.payer?.name}</span>
                            {exp.group && <> in <span className="font-medium text-gray-600 dark:text-gray-300">{exp.group.name}</span></>}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">{new Date(exp.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg dark:text-white">${exp.amount}</p>
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => setSelectedExpenseId(exp.id)}
                              className="p-1 text-gray-400 hover:text-[#5BC5A7] transition-colors"
                              title="View comments"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
                    <PieChartIcon className="w-5 h-5 text-[#5BC5A7]" /> Spending by Category
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(analyticsData.reduce((acc: any, curr: any) => {
                            const cat = categories.find(c => c.id === curr.expense.categoryId)?.name || 'Other';
                            acc[cat] = (acc[cat] || 0) + parseFloat(curr.amount);
                            return acc;
                          }, {})).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {['#5BC5A7', '#FF652F', '#4A90E2', '#F5A623', '#7ED321'].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
                    <BarChartIcon className="w-5 h-5 text-[#FF652F]" /> Monthly Spending
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(analyticsData.reduce((acc: any, curr: any) => {
                        const date = new Date(curr.expense.timestamp).toLocaleString('default', { month: 'short' });
                        acc[date] = (acc[date] || 0) + parseFloat(curr.amount);
                        return acc;
                      }, {})).map(([name, value]) => ({ name, value }))}>
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                        <Tooltip cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="value" fill="#FF652F" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
                  <TrendingUp className="w-5 h-5 text-[#5BC5A7]" /> Spending Trend
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData.slice(-10).map(d => ({
                      date: new Date(d.expense.timestamp).toLocaleDateString(),
                      amount: parseFloat(d.amount)
                    }))}>
                      <XAxis dataKey="date" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                      <Tooltip />
                      <Line type="monotone" dataKey="amount" stroke="#5BC5A7" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-8 transition-colors">
                <h2 className="text-xl font-bold mb-6 dark:text-white">Create New Account</h2>
                <form onSubmit={createUser} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={newUserName}
                      onChange={e => setNewUserName(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] dark:text-white"
                    />
                  </div>
                  <button
                    disabled={loading}
                    className="w-full py-3 bg-[#5BC5A7] text-white font-bold rounded-lg shadow-md hover:bg-[#4eb094] transition-all disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Account'}
                  </button>
                </form>
              </div>

              <div className="bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-8 transition-colors">
                <h2 className="text-xl font-bold mb-6 dark:text-white">Switch Account</h2>
                <div className="grid grid-cols-2 gap-4">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setCurrentUser(u);
                        setActiveTab('dashboard');
                      }}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${currentUser?.id === u.id ? 'border-[#5BC5A7] bg-green-50 dark:bg-green-900/20' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'}`}
                    >
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden border-2 border-white dark:border-gray-600 shadow-sm">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`} alt="avatar" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold dark:text-white">{u.name}</p>
                        <p className="text-xs text-gray-400">ID: {u.id}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
      <AnimatePresence>
        {isSettling && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-[#1E1E1E] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold dark:text-white">Settle Up</h3>
                <button onClick={() => setIsSettling(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={settleUp} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Settle with</label>
                  <select
                    value={settleToUserId || ''}
                    onChange={e => setSettleToUserId(Number(e.target.value))}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] dark:text-white"
                  >
                    <option value="">Select a friend</option>
                    {Array.isArray(friends) && friends.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-300">$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={settleAmount}
                      onChange={e => setSettleAmount(e.target.value)}
                      className="w-full pl-10 pr-4 py-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 outline-none focus:border-[#5BC5A7] text-2xl font-bold dark:text-white"
                    />
                  </div>
                </div>

                <button
                  disabled={loading || !settleToUserId || !settleAmount}
                  className="w-full py-4 bg-[#5BC5A7] text-white font-bold text-lg rounded-xl shadow-lg hover:bg-[#4eb094] transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Record Payment'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comment Modal */}
      <AnimatePresence>
        {selectedExpenseId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-[#1E1E1E] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-xl font-bold dark:text-white">Comments</h3>
                <button onClick={() => setSelectedExpenseId(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {selectedExpenseId && allExpenses.find(e => e.id === selectedExpenseId) && (
                <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-lg dark:text-white">{allExpenses.find(e => e.id === selectedExpenseId).description}</h4>
                    <span className="text-xl font-bold text-[#5BC5A7]">${allExpenses.find(e => e.id === selectedExpenseId).amount}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Paid by <span className="font-medium">{allExpenses.find(e => e.id === selectedExpenseId).payer?.name}</span>
                    {allExpenses.find(e => e.id === selectedExpenseId).group && <> in <span className="font-medium">{allExpenses.find(e => e.id === selectedExpenseId).group.name}</span></>}
                  </p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {expenseComments.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No comments yet. Start the conversation!</p>
                ) : (
                  expenseComments.map(c => (
                    <div key={c.id} className={`flex gap-3 ${c.userId === currentUser?.id ? 'flex-row-reverse' : ''}`}>
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user.name}`} alt="avatar" />
                      </div>
                      <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${c.userId === currentUser?.id ? 'bg-[#5BC5A7] text-white rounded-tr-none' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-200 rounded-tl-none'
                        }`}>
                        <p className="font-bold text-[10px] mb-1 opacity-70">{c.user.name}</p>
                        <p>{c.text}</p>
                        <p className="text-[10px] mt-1 opacity-50 text-right">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={addComment} className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#181818] flex gap-2">
                <input
                  type="text"
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="flex-1 p-3 bg-white dark:bg-[#1E1E1E] rounded-xl border border-gray-200 dark:border-gray-700 outline-none focus:border-[#5BC5A7] dark:text-white"
                />
                <button
                  disabled={!newComment}
                  className="p-3 bg-[#5BC5A7] text-white rounded-xl hover:bg-[#4eb094] transition-all disabled:opacity-50"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
