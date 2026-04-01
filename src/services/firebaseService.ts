import { db } from '../firebase';
import {
    collection, doc, setDoc, getDoc, getDocs, query, where,
    addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, or, and
} from 'firebase/firestore';
import { Decimal } from 'decimal.js';

export class FirebaseService {

    // --- Users ---
    static async createUser(name: string, email: string, username: string, passwordHash: string) {
        // Check if username/email exists
        const q = query(collection(db, 'users'), or(where('email', '==', email.toLowerCase()), where('username', '==', username.toLowerCase())));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) throw new Error('User with this email or username already exists');

        const newUserRef = doc(collection(db, 'users'));
        const userData = { id: newUserRef.id, name, email: email.toLowerCase(), username: username.toLowerCase(), passwordHash };
        await setDoc(newUserRef, userData);
        return userData;
    }

    static async login(identifier: string, passwordHash: string) {
        const idLower = identifier.toLowerCase();
        const q = query(collection(db, 'users'), or(where('email', '==', idLower), where('username', '==', idLower)));
        const snapshot = await getDocs(q);
        if (snapshot.empty) throw new Error('User not found');

        const user = snapshot.docs[0].data();
        if (user.passwordHash !== passwordHash) throw new Error('Invalid password');
        return user;
    }

    static async getUserByUsername(username: string) {
        const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
        const snapshot = await getDocs(q);
        if (snapshot.empty) throw new Error('User not found');
        return snapshot.docs[0].data();
    }

    static async getAllUsers() {
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map(d => d.data());
    }

    // --- Friends ---
    static async sendFriendRequest(user1Id: string, user2Id: string) {
        const q = query(collection(db, 'friends'), or(
            and(where('user1Id', '==', user1Id), where('user2Id', '==', user2Id)),
            and(where('user1Id', '==', user2Id), where('user2Id', '==', user1Id))
        ));
        const snap = await getDocs(q);
        if (!snap.empty) throw new Error('Already friends or request pending!');

        await addDoc(collection(db, 'friends'), {
            user1Id, user2Id, status: 'pending', timestamp: serverTimestamp()
        });
    }

    static async acceptFriendRequest(requestId: string) {
        await updateDoc(doc(db, 'friends', requestId), { status: 'accepted' });
    }

    static async rejectFriendRequest(requestId: string) {
        await deleteDoc(doc(db, 'friends', requestId));
    }

    // --- Expenses ---
    static async addExpense(data: any) {
        const expenseRef = await addDoc(collection(db, 'expenses'), {
            ...data,
            timestamp: Date.now()
        });

        // Log activity
        await addDoc(collection(db, 'activities'), {
            userId: data.payerId,
            expenseId: expenseRef.id,
            type: 'expense_added',
            description: `New expense added: "${data.description}"`,
            timestamp: Date.now()
        });
    }

    static async addComment(expenseId: string, userId: string, text: string) {
        await addDoc(collection(db, 'comments'), {
            expenseId, userId, text, timestamp: Date.now()
        });
    }

    // --- Groups ---
    static async createGroup(name: string, memberIds: string[]) {
        await addDoc(collection(db, 'groups'), {
            name, members: memberIds, timestamp: Date.now()
        });
    }

    // --- Real-time Listeners ---
    static listenToUserSpecificData(userId: string, callback: (data: any) => void) {
        // Since Firestore requires separate listeners for multiple queries, we aggregate them here.
        let friends: any[] = [];
        let requests: any[] = [];
        let groups: any[] = [];
        let expenses: any[] = [];
        let activities: any[] = [];
        let usersMap = new Map();

        const notify = () => {
            // Calculate balances based on raw expenses
            const balances = this.calculateBalances(userId, expenses);
            const optimized = this.optimizeSettlement(balances);
            callback({ friends, requests, groups, expenses, activities, balances, optimized });
        };

        // 1. Listen to Users (to map IDs to Names)
        const unsubUsers = onSnapshot(collection(db, 'users'), snap => {
            snap.docs.forEach(d => usersMap.set(d.id, d.data()));
            notify();
        });

        // 2. Listen to Friends
        const friendsQ = query(collection(db, 'friends'), or(where('user1Id', '==', userId), where('user2Id', '==', userId)));
        const unsubFriends = onSnapshot(friendsQ, snap => {
            friends = [];
            requests = [];
            snap.docs.forEach(d => {
                const data = d.data();
                const otherId = data.user1Id === userId ? data.user2Id : data.user1Id;
                const otherUser = usersMap.get(otherId) || { id: otherId, name: 'Unknown' };

                if (data.status === 'accepted') {
                    friends.push({ id: otherId, ...otherUser });
                } else if (data.status === 'pending' && data.user2Id === userId) {
                    requests.push({ requestId: d.id, ...otherUser });
                }
            });
            notify();
        });

        // 3. Listen to Groups
        const groupsQ = query(collection(db, 'groups'), where('members', 'array-contains', userId));
        const unsubGroups = onSnapshot(groupsQ, snap => {
            groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            notify();
        });

        // 4. Listen to Expenses
        // We fetch all expenses for simplicity in matching, in prod we'd query by involved users
        const unsubExpenses = onSnapshot(collection(db, 'expenses'), snap => {
            expenses = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter((e: any) => {
                return e.payerId === userId || e.splits?.some((s: any) => s.userId === userId);
            });
            notify();
        });

        // 5. Listen to Activities
        const activitiesQ = query(collection(db, 'activities'), where('userId', '==', userId));
        const unsubActivities = onSnapshot(activitiesQ, snap => {
            activities = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            notify();
        });

        return () => {
            unsubUsers();
            unsubFriends();
            unsubGroups();
            unsubExpenses();
            unsubActivities();
        };
    }

    // --- Logic ---
    static calculateBalances(userId: string, expenses: any[]) {
        const balancesMap = new Map<string, Decimal>(); // otherUserId -> amount (positive means they owe me)

        for (const exp of expenses) {
            if (exp.isSettlement) {
                // Settlement logic
                if (exp.payerId === userId) {
                    // I paid someone a settlement (they owe me less, so my balance against them drops)
                    const split = exp.splits[0];
                    const curr = balancesMap.get(split.userId) || new Decimal(0);
                    balancesMap.set(split.userId, curr.plus(exp.amount)); // They received money, they owe me
                } else if (exp.splits[0].userId === userId) {
                    // Someone paid me a settlement
                    const curr = balancesMap.get(exp.payerId) || new Decimal(0);
                    balancesMap.set(exp.payerId, curr.minus(exp.amount)); // They paid me, they owe me less
                }
                continue;
            }

            const isPayer = exp.payerId === userId;

            for (const split of exp.splits) {
                if (isPayer && split.userId !== userId) {
                    // I paid, they owe me
                    const curr = balancesMap.get(split.userId) || new Decimal(0);
                    balancesMap.set(split.userId, curr.plus(split.amount));
                } else if (!isPayer && split.userId === userId) {
                    // They paid, I owe them
                    const curr = balancesMap.get(exp.payerId) || new Decimal(0);
                    balancesMap.set(exp.payerId, curr.minus(split.amount));
                }
            }
        }

        return Array.from(balancesMap.entries()).map(([otherUserId, netAmount]) => {
            const isPositive = netAmount.isPositive();
            return {
                id: otherUserId + '_bal',
                user1Id: isPositive ? otherUserId : userId,
                user2Id: isPositive ? userId : otherUserId,
                netAmount: netAmount.abs().toString(),
                originalAmount: netAmount
            };
        });
    }

    static optimizeSettlement(balancesList: any[]) {
        // Greedy algorithm ported to use local balance list
        let debtors = balancesList.filter(b => b.originalAmount.isNegative()).map(b => ({ id: b.user1Id === b.user2Id ? b.user2Id : b.user1Id, amt: b.originalAmount.abs() }));
        let creditors = balancesList.filter(b => b.originalAmount.isPositive()).map(b => ({ id: b.user2Id === b.user1Id ? b.user1Id : b.user2Id, amt: b.originalAmount }));

        debtors.sort((a, b) => b.amt.cmp(a.amt));
        creditors.sort((a, b) => b.amt.cmp(a.amt));

        const transactions = [];
        let i = 0, j = 0;

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const settledAmount = Decimal.min(debtor.amt, creditor.amt);

            transactions.push({
                from: debtor.id,
                to: creditor.id,
                amount: settledAmount.toFixed(2)
            });

            debtor.amt = debtor.amt.minus(settledAmount);
            creditor.amt = creditor.amt.minus(settledAmount);

            if (debtor.amt.isZero()) i++;
            if (creditor.amt.isZero()) j++;
        }

        return transactions;
    }
}
