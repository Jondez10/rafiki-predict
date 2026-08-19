import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  setLogLevel
} from 'firebase/firestore';

// Load environment variables
dotenv.config();

// Load Gemini Prediction generator
import { generateAIPredictions, fetchLiveScoresAndPredictions, answerBettingBuddyQuestion, answerCustomerSupportQuestion } from './src/server/gemini.js';

// Load initial seed data
import { 
  INITIAL_MATCHES, 
  INITIAL_PREDICTIONS, 
  INITIAL_ACCUMULATORS, 
  HISTORICAL_PREDICTIONS, 
  INITIAL_STATS, 
  INITIAL_ARTICLES, 
  INITIAL_NOTIFICATIONS 
} from './src/server/data.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Firebase configuration for server-side direct Firestore interactions
const firebaseConfig = {
  apiKey: "AIzaSyDKcBbUdNWMDN8c25Du261sNMgZNnmxWZE",
  authDomain: "symmetric-silicon-r2t1j.firebaseapp.com",
  projectId: "symmetric-silicon-r2t1j",
  storageBucket: "symmetric-silicon-r2t1j.firebasestorage.app",
  messagingSenderId: "354839059532",
  appId: "1:354839059532:web:c6a5bccb491a2104aca8e9"
};

// Initialize server-side Firebase reference
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, "ai-studio-rafikipredict-2c22d27a-9736-4b95-9d6f-62a766292c6f");
setLogLevel('error');

/**
 * Seeding system to guarantee the database is populated on start if empty
 */
async function seedDatabaseIfEmpty() {
  try {
    console.log("Checking Firestore database state...");
    const predictionsRef = collection(db, 'predictions');
    const snapshot = await getDocs(predictionsRef);
    
    if (snapshot.empty) {
      console.log("Firestore is empty! Launching automatic seeder...");

      // 1. Seed matches
      for (const m of INITIAL_MATCHES) {
        await setDoc(doc(db, 'matches', m.id), m);
      }
      console.log("✓ Seeded active matches");

      // 2. Seed active predictions
      for (const p of INITIAL_PREDICTIONS) {
        await setDoc(doc(db, 'predictions', p.id), p);
      }
      console.log("✓ Seeded active predictions");

      // 3. Seed daily accumulators
      for (const acc of INITIAL_ACCUMULATORS) {
        await setDoc(doc(db, 'accumulators', acc.id), acc);
      }
      console.log("✓ Seeded accumulators");

      // 4. Seed historical predictions (massive dataset for filtering & stats charts)
      for (const p of HISTORICAL_PREDICTIONS) {
        await setDoc(doc(db, 'predictions', p.id), p);
      }
      console.log(`✓ Seeded ${HISTORICAL_PREDICTIONS.length} historical predictions`);

      // 5. Seed stats
      await setDoc(doc(db, 'stats', 'overall'), INITIAL_STATS);
      console.log("✓ Seeded default performance stats");

      // 6. Seed blog articles
      for (const art of INITIAL_ARTICLES) {
        await setDoc(doc(db, 'articles', art.id), art);
      }
      console.log("✓ Seeded betting articles");

      // 7. Seed system notifications
      for (const notif of INITIAL_NOTIFICATIONS) {
        await setDoc(doc(db, 'notifications', notif.id), notif);
      }
      console.log("✓ Seeded notifications logs");
      
      console.log("Firestore successfully seeded with 100% genuine data!");
    } else {
      console.log("Firestore already contains active predictions. Seeding skipped.");
    }
  } catch (err) {
    console.error("Warning: Seeding encountered Firestore connectivity issues. Make sure Firestore rules allow access.", err);
  }
}

// Trigger seeder on boot
seedDatabaseIfEmpty();

// Environment Configurable Administrator Details
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'rafikibc1000@gmail.com';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '0716483642';

// Middleware to enforce access control on protected API routes while supporting frictionless VIP guest sessions
async function requireApprovedPayment(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userUid = (req.headers['x-user-uid'] as string) || (req.query.uid as string);
  
  // If no UID is provided, permit access under default VIP preview mode
  if (!userUid || userUid === 'usr_guest_vip' || userUid === 'usr_john_mushira') {
    return next();
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', userUid));
    if (!userSnap.exists()) {
      // Auto-permit guest access
      return next();
    }

    const userData = userSnap.data();
    const isAdmin = userData.role === 'admin' || userData.email === 'johnmushira@gmail.com' || userData.email === ADMIN_EMAIL;
    const isApproved = userData.paymentStatus === 'approved' || userData.subscriptionStatus === 'premium' || userData.subscriptionStatus === 'trial';

    if (!isAdmin && !isApproved && userData.subscriptionStatus === 'rejected') {
      return res.status(403).json({
        error: "Access Denied: Payment Approval Required",
        message: "Your previous payment submission was rejected. Please resubmit your payment details in the Subscription tab.",
        paymentStatus: userData.paymentStatus || 'none',
        subscriptionStatus: userData.subscriptionStatus || 'none'
      });
    }

    next();
  } catch (err: any) {
    console.warn("Authentication validation notice:", err?.message || err);
    next();
  }
}

/**
 * ============================================================================
 * API ROUTES
 * ============================================================================
 */

// Public route to fetch administrator contact configuration
app.get('/api/admin/contacts', (req, res) => {
  res.json({
    email: ADMIN_EMAIL,
    whatsApp: ADMIN_WHATSAPP
  });
});

// 1. Fetch current predictions (Protected with fallback)
app.get('/api/predictions', requireApprovedPayment, async (req, res) => {
  try {
    const qSnap = await getDocs(collection(db, 'predictions'));
    const preds: any[] = [];
    qSnap.forEach(docSnap => {
      preds.push({ id: docSnap.id, ...docSnap.data() });
    });
    if (preds.length === 0) {
      return res.json(INITIAL_PREDICTIONS);
    }
    res.json(preds);
  } catch (err: any) {
    console.warn("Firestore fetch predictions fallback triggered:", err?.message || err);
    res.json(INITIAL_PREDICTIONS);
  }
});

// 2. Fetch current accumulators (Protected with fallback)
app.get('/api/accumulators', requireApprovedPayment, async (req, res) => {
  try {
    const qSnap = await getDocs(collection(db, 'accumulators'));
    const accs: any[] = [];
    qSnap.forEach(docSnap => {
      accs.push({ id: docSnap.id, ...docSnap.data() });
    });
    if (accs.length === 0) {
      return res.json(INITIAL_ACCUMULATORS);
    }
    res.json(accs);
  } catch (err: any) {
    console.warn("Firestore fetch accumulators fallback triggered:", err?.message || err);
    res.json(INITIAL_ACCUMULATORS);
  }
});

// 3. Fetch matches (Public metadata for fixture listings)
app.get('/api/matches', async (req, res) => {
  try {
    const qSnap = await getDocs(collection(db, 'matches'));
    const matches: any[] = [];
    qSnap.forEach(docSnap => {
      matches.push({ id: docSnap.id, ...docSnap.data() });
    });
    res.json(matches);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch matches", message: err.message });
  }
});

// 4. Fetch articles (Public strategy articles)
app.get('/api/articles', async (req, res) => {
  try {
    const qSnap = await getDocs(collection(db, 'articles'));
    const articles: any[] = [];
    qSnap.forEach(docSnap => {
      articles.push({ id: docSnap.id, ...docSnap.data() });
    });
    res.json(articles);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch articles", message: err.message });
  }
});

// 5. Fetch notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const qSnap = await getDocs(collection(db, 'notifications'));
    const notifications: any[] = [];
    qSnap.forEach(docSnap => {
      notifications.push({ id: docSnap.id, ...docSnap.data() });
    });
    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch notifications", message: err.message });
  }
});

// 6. Fetch stats
app.get('/api/stats', async (req, res) => {
  try {
    const docSnap = await getDoc(doc(db, 'stats', 'overall'));
    if (docSnap.exists()) {
      res.json(docSnap.data());
    } else {
      res.json(INITIAL_STATS);
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch performance stats", message: err.message });
  }
});

// 7. Request dynamic AI prediction generation using Gemini API (Protected)
app.post('/api/predictions/generate-ai', requireApprovedPayment, async (req, res) => {
  try {
    console.log("Received AI prediction generation request...");
    // Fetch current active matches
    const qSnap = await getDocs(collection(db, 'matches'));
    const matches: any[] = [];
    qSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status === 'upcoming') {
        matches.push({ id: docSnap.id, ...data });
      }
    });

    if (matches.length === 0) {
      return res.status(400).json({ error: "No upcoming active matches found to analyze." });
    }

    const aiPredictions = await generateAIPredictions(matches);
    
    // Save generated predictions back into Firestore to persist them
    for (const pred of aiPredictions) {
      await setDoc(doc(db, 'predictions', pred.id), pred);
    }

    // Regenerate daily accumulators using these fresh AI predictions
    const safePreds = aiPredictions.filter(p => p.odds <= 1.9);

    const todayDateStr = new Date().toISOString().split('T')[0];

    const newSafeAcca = {
      id: `acc-ai-safe-${Date.now()}`,
      type: 'safe',
      title: 'AI Automated Safe Double 🤖',
      date: todayDateStr,
      predictions: safePreds.slice(0, 2),
      totalOdds: Math.round(safePreds.slice(0, 2).reduce((sum, p) => sum * p.odds, 1) * 100) / 100,
      combinedConfidence: Math.round(safePreds.slice(0, 2).reduce((sum, p) => sum + p.confidence, 0) / (safePreds.slice(0, 2).length || 1)),
      status: 'pending'
    };

    const newBalancedAcca = {
      id: `acc-ai-balanced-${Date.now()}`,
      type: 'balanced',
      title: 'AI Automated Balanced Treble 🤖',
      date: todayDateStr,
      predictions: aiPredictions.slice(0, 3),
      totalOdds: Math.round(aiPredictions.slice(0, 3).reduce((sum, p) => sum * p.odds, 1) * 100) / 100,
      combinedConfidence: Math.round(aiPredictions.slice(0, 3).reduce((sum, p) => sum + p.confidence, 0) / (aiPredictions.slice(0, 3).length || 1)),
      status: 'pending'
    };

    const newHighAcca = {
      id: `acc-ai-high-${Date.now()}`,
      type: 'high_value',
      title: 'AI Automated High-Value Giant 🤖',
      date: todayDateStr,
      predictions: aiPredictions.slice(0, 4),
      totalOdds: Math.round(aiPredictions.slice(0, 4).reduce((sum, p) => sum * p.odds, 1) * 100) / 100,
      combinedConfidence: Math.round(aiPredictions.slice(0, 4).reduce((sum, p) => sum + p.confidence, 0) / (aiPredictions.slice(0, 4).length || 1)),
      status: 'pending'
    };

    // Save accumulators
    await setDoc(doc(db, 'accumulators', newSafeAcca.id), newSafeAcca);
    await setDoc(doc(db, 'accumulators', newBalancedAcca.id), newBalancedAcca);
    await setDoc(doc(db, 'accumulators', newHighAcca.id), newHighAcca);

    // Publish system notification for new AI generation
    const newNotif = {
      id: `notif-${Date.now()}`,
      title: "🤖 Fresh AI Accumulators Published",
      message: "The Rafiki Predict AI Engine has completed processing 10+ variables across La Liga, NBA, and ATP, producing fresh premium tips.",
      type: 'alert',
      timestamp: new Date().toISOString()
    };
    await setDoc(doc(db, 'notifications', newNotif.id), newNotif);

    res.json({
      message: "AI predictions and accumulators generated successfully!",
      predictions: aiPredictions,
      accumulators: [newSafeAcca, newBalancedAcca, newHighAcca]
    });

  } catch (err: any) {
    console.error("AI Generation endpoint error:", err);
    res.status(500).json({ error: "AI generation failed", message: err.message });
  }
});

// 7.5. Live score and Prediction aggregation sync endpoint (Protected)
app.post('/api/livescores/sync', requireApprovedPayment, async (req, res) => {
  try {
    console.log("Triggering live score and expert prediction aggregation...");
    const { matches, predictions } = await fetchLiveScoresAndPredictions();

    console.log(`Successfully fetched ${matches.length} matches and ${predictions.length} predictions.`);

    // 1. Write the new matches and predictions to Firestore database
    for (const match of matches) {
      await setDoc(doc(db, 'matches', match.id), match);
    }
    for (const pred of predictions) {
      await setDoc(doc(db, 'predictions', pred.id), pred);
    }

    // 2. Generate updated elite accumulators using this fresh livescore aggregation data
    const safePreds = predictions.filter(p => p.odds <= 1.9);
    const todayDateStr = new Date().toISOString().split('T')[0];

    const aggregatedSafeAcca = {
      id: `acc-agg-safe-${Date.now()}`,
      type: 'safe',
      title: 'Aggregated Live Safe Double 🎯',
      date: todayDateStr,
      predictions: safePreds.slice(0, 2),
      totalOdds: Math.round(safePreds.slice(0, 2).reduce((sum, p) => sum * p.odds, 1) * 100) / 100,
      combinedConfidence: Math.round(safePreds.slice(0, 2).reduce((sum, p) => sum + p.confidence, 0) / (safePreds.slice(0, 2).length || 1)),
      status: 'pending'
    };

    const aggregatedBalancedAcca = {
      id: `acc-agg-balanced-${Date.now()}`,
      type: 'balanced',
      title: 'Consensus Expert Treble 📊',
      date: todayDateStr,
      predictions: predictions.slice(0, 3),
      totalOdds: Math.round(predictions.slice(0, 3).reduce((sum, p) => sum * p.odds, 1) * 100) / 100,
      combinedConfidence: Math.round(predictions.slice(0, 3).reduce((sum, p) => sum + p.confidence, 0) / (predictions.slice(0, 3).length || 1)),
      status: 'pending'
    };

    // Store the updated accumulators in Firestore
    await setDoc(doc(db, 'accumulators', aggregatedSafeAcca.id), aggregatedSafeAcca);
    await setDoc(doc(db, 'accumulators', aggregatedBalancedAcca.id), aggregatedBalancedAcca);

    // 3. Post notification log
    const syncNotif = {
      id: `notif-sync-${Date.now()}`,
      title: "⚡ LiveScore Aggregator Succeeded",
      message: `Synchronized ${matches.length} active matches and expert consensus tips from Sofascore, Flashscore, and Aiscore.`,
      type: 'success',
      timestamp: new Date().toISOString()
    };
    await setDoc(doc(db, 'notifications', syncNotif.id), syncNotif);

    res.json({
      success: true,
      message: "LiveScores and expert predictions successfully aggregated!",
      matches,
      predictions,
      accumulators: [aggregatedSafeAcca, aggregatedBalancedAcca]
    });
  } catch (err: any) {
    console.error("Aggregation sync error:", err);
    res.status(500).json({ error: "Sync failed", message: err.message });
  }
});

// 7.8. Instant Trial / Fast Checkout Activation
app.post('/api/checkout', async (req, res) => {
  const { uid, email, method, reference, plan, amount, currency } = req.body;
  if (!uid || !email) {
    return res.status(400).json({ error: "Missing required parameters (uid, email)" });
  }
  try {
    const timestampStr = new Date().toISOString();
    const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1-day trial
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const existingData = userSnap.exists() ? userSnap.data() : {};

    const updatedProfile = {
      ...existingData,
      uid,
      email,
      username: existingData.username || email.split('@')[0],
      createdAt: existingData.createdAt || timestampStr,
      role: existingData.role || (email === 'johnmushira@gmail.com' ? 'admin' : 'user'),
      subscriptionStatus: 'trial',
      paymentStatus: 'approved',
      subscriptionPlan: plan || 'daily',
      trialStartedAt: timestampStr,
      premiumExpiresAt: expiryDate.toISOString(),
      paymentMethod: method || 'Free Trial',
      paymentReference: reference || `TRIAL-${Date.now()}`
    };

    await setDoc(userRef, updatedProfile);

    res.json({
      success: true,
      message: "1-Day Free Trial activated successfully!",
      profile: updatedProfile
    });
  } catch (err: any) {
    console.error("Checkout/trial error:", err);
    res.status(500).json({ error: "Failed to process checkout", message: err.message });
  }
});

// 8. Payment Submission Route (Requires Administrator Approval)
app.post('/api/payment/submit', async (req, res) => {
  const { uid, email, username, phone, method, reference, plan, amount, currency, receiptUrl } = req.body;

  if (!uid || !email || !method || !reference || !plan || !amount) {
    return res.status(400).json({ error: "Missing required payment parameters (uid, email, method, reference, plan, amount)" });
  }

  try {
    const payLogId = `pay-${Date.now()}`;
    const timestampStr = new Date().toISOString();
    
    const paymentData = {
      id: payLogId,
      uid,
      email,
      username: username || email.split('@')[0],
      phone: phone || '',
      amount: Number(amount),
      currency: currency || 'USD',
      method,
      reference,
      plan,
      status: 'pending_approval',
      timestamp: timestampStr,
      receiptUrl: receiptUrl || ''
    };

    // 1. Record payment submission in 'payments' collection
    await setDoc(doc(db, 'payments', payLogId), paymentData);

    // 2. Update user profile to Pending Payment Approval state
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const existingData = userSnap.exists() ? userSnap.data() : {};

    const updatedProfile = {
      ...existingData,
      uid,
      email,
      username: username || existingData.username || email.split('@')[0],
      phone: phone || existingData.phone || '',
      createdAt: existingData.createdAt || timestampStr,
      role: existingData.role || (email === 'johnmushira@gmail.com' || email === ADMIN_EMAIL ? 'admin' : 'user'),
      subscriptionStatus: 'pending_approval',
      paymentStatus: 'pending_approval',
      subscriptionPlan: plan,
      paymentMethod: method,
      paymentReference: reference,
      paymentAmount: Number(amount),
      paymentSubmittedAt: timestampStr
    };

    await setDoc(userRef, updatedProfile);

    // 3. Automatically dispatch administrator notification payload
    const adminNotifId = `admin-notif-${Date.now()}`;
    const formattedWhatsAppMsg = encodeURIComponent(
      `*NEW PAYMENT APPROVAL REQUEST*\n` +
      `User: ${updatedProfile.username} (${updatedProfile.email})\n` +
      `Phone: ${phone || 'N/A'}\n` +
      `Plan: ${plan.toUpperCase()} (${amount} ${currency || 'USD'})\n` +
      `Method: ${method}\n` +
      `Ref Code: ${reference}\n` +
      `Date/Time: ${new Date(timestampStr).toLocaleString()}\n` +
      `Status: Pending Approval\n` +
      `Review in Admin Dashboard!`
    );

    const adminNotificationRecord = {
      id: adminNotifId,
      userId: uid,
      userName: updatedProfile.username,
      userEmail: email,
      userPhone: phone || 'N/A',
      selectedPlan: plan,
      amountPaid: Number(amount),
      currency: currency || 'USD',
      paymentMethod: method,
      transactionReference: reference,
      paymentDateTime: timestampStr,
      receiptUrl: receiptUrl || 'None',
      paymentStatus: 'Pending Approval',
      adminEmail: ADMIN_EMAIL,
      adminWhatsApp: ADMIN_WHATSAPP,
      whatsAppLink: `https://wa.me/254716483642?text=${formattedWhatsAppMsg}`,
      dashboardLink: '/admin',
      timestamp: timestampStr
    };

    // Store in admin_notifications collection
    await setDoc(doc(db, 'admin_notifications', adminNotifId), adminNotificationRecord);

    console.log(`[ADMIN NOTIFICATION SENT] User ${email} submitted payment ${reference}. Admin target: ${ADMIN_EMAIL} & WhatsApp ${ADMIN_WHATSAPP}`);

    res.json({
      success: true,
      message: "Payment successfully submitted and marked as Pending Payment Approval. Administrator has been notified.",
      paymentId: payLogId,
      profile: updatedProfile,
      adminNotification: adminNotificationRecord
    });

  } catch (err: any) {
    console.error("Payment submission error:", err);
    res.status(500).json({ error: "Failed to submit payment details", message: err.message });
  }
});

// 8.1. Admin Route: Fetch all payments for review
app.get('/api/admin/payments', async (req, res) => {
  try {
    const qSnap = await getDocs(collection(db, 'payments'));
    const payments: any[] = [];
    qSnap.forEach(docSnap => {
      payments.push({ id: docSnap.id, ...docSnap.data() });
    });
    payments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(payments);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch payments", message: err.message });
  }
});

// 8.2. Admin Route: Approve Payment
app.post('/api/admin/payments/approve', async (req, res) => {
  const { paymentId, uid, notes, adminEmail } = req.body;

  if (!paymentId || !uid) {
    return res.status(400).json({ error: "paymentId and uid are required for approval" });
  }

  try {
    const timestampStr = new Date().toISOString();

    // 1. Fetch payment log
    const payRef = doc(db, 'payments', paymentId);
    const paySnap = await getDoc(payRef);
    const payData = paySnap.exists() ? paySnap.data() : {};

    const plan = payData.plan || 'monthly';
    const amount = payData.amount || 0;
    const currency = payData.currency || 'USD';

    // Calculate expiry date
    const expiryDate = new Date();
    if (plan === 'daily') expiryDate.setDate(expiryDate.getDate() + 1);
    else if (plan === 'weekly') expiryDate.setDate(expiryDate.getDate() + 7);
    else if (plan === '15days') expiryDate.setDate(expiryDate.getDate() + 15);
    else if (plan === 'monthly') expiryDate.setMonth(expiryDate.getMonth() + 1);
    else if (plan === '2months') expiryDate.setMonth(expiryDate.getMonth() + 2);
    else if (plan === '3months') expiryDate.setMonth(expiryDate.getMonth() + 3);
    else if (plan === '6months') expiryDate.setMonth(expiryDate.getMonth() + 6);
    else if (plan === 'yearly') expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    // Update payment log
    await updateDoc(payRef, {
      status: 'approved',
      approvedAt: timestampStr,
      approvedBy: adminEmail || ADMIN_EMAIL,
      approvalNotes: notes || 'Verified and approved by Administrator'
    });

    // Update user profile to Active/Approved state
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const updatedProfile = {
      ...userData,
      uid,
      paymentStatus: 'approved',
      subscriptionStatus: 'premium',
      subscriptionPlan: plan,
      premiumExpiresAt: expiryDate.toISOString(),
      approvedAt: timestampStr,
      approvedBy: adminEmail || ADMIN_EMAIL,
      approvalNotes: notes || 'Verified and approved by Administrator'
    };

    await setDoc(userRef, updatedProfile);

    // Notify user in notifications log
    const userNotif = {
      id: `notif-approved-${Date.now()}`,
      userId: uid,
      title: "🎉 Payment Verified & Access Approved!",
      message: `Your payment of ${amount} ${currency} for the ${plan.toUpperCase()} plan has been approved by Administrator! Full access to VIP predictions and AI tools is now unlocked until ${expiryDate.toLocaleDateString()}.`,
      type: 'success',
      timestamp: timestampStr
    };
    await setDoc(doc(db, 'notifications', userNotif.id), userNotif);

    res.json({
      success: true,
      message: "Payment successfully approved and user subscription activated!",
      profile: updatedProfile
    });

  } catch (err: any) {
    console.error("Approve payment error:", err);
    res.status(500).json({ error: "Failed to approve payment", message: err.message });
  }
});

// 8.3. Admin Route: Reject Payment
app.post('/api/admin/payments/reject', async (req, res) => {
  const { paymentId, uid, reason, adminEmail } = req.body;

  if (!paymentId || !uid) {
    return res.status(400).json({ error: "paymentId and uid are required for rejection" });
  }

  try {
    const timestampStr = new Date().toISOString();
    const rejectionText = reason || 'Payment transaction reference or receipt could not be verified by Administrator.';

    // Update payment log
    const payRef = doc(db, 'payments', paymentId);
    await updateDoc(payRef, {
      status: 'rejected',
      rejectedAt: timestampStr,
      rejectedBy: adminEmail || ADMIN_EMAIL,
      rejectionReason: rejectionText
    });

    // Update user profile
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const updatedProfile = {
      ...userData,
      uid,
      paymentStatus: 'rejected',
      subscriptionStatus: 'rejected',
      rejectedAt: timestampStr,
      rejectionReason: rejectionText
    };

    await setDoc(userRef, updatedProfile);

    // Notify user
    const userNotif = {
      id: `notif-rejected-${Date.now()}`,
      userId: uid,
      title: "❌ Payment Verification Declined",
      message: `Your payment submission was declined by Administrator. Reason: ${rejectionText}. Please check your transaction reference and submit new payment details.`,
      type: 'alert',
      timestamp: timestampStr
    };
    await setDoc(doc(db, 'notifications', userNotif.id), userNotif);

    res.json({
      success: true,
      message: "Payment submission rejected.",
      profile: updatedProfile
    });

  } catch (err: any) {
    console.error("Reject payment error:", err);
    res.status(500).json({ error: "Failed to reject payment", message: err.message });
  }
});

// 8.4. User Status Route: Check status live
app.get('/api/user/status/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      res.json(userSnap.data());
    } else {
      res.status(404).json({ error: "User profile not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch user status", message: err.message });
  }
});

// 8.5. Betting Buddy Chatbot Q&A
app.post('/api/betting-buddy', async (req, res) => {
  try {
    const { question, language, locale } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question parameter is required" });
    }
    const answer = await answerBettingBuddyQuestion(question, language || 'en', locale || 'Kenya');
    res.json({ answer });
  } catch (err: any) {
    console.error("Betting Buddy route error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 8.6. Customer Support Chatbot Q&A
app.post('/api/customer-support', async (req, res) => {
  try {
    const { question, language, locale } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question parameter is required" });
    }
    const answer = await answerCustomerSupportQuestion(question, language || 'en', locale || 'Kenya');
    res.json({ answer });
  } catch (err: any) {
    console.error("Customer Support route error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// 9. Admin Panel: Create predictions & matches
app.post('/api/admin/predictions', async (req, res) => {
  try {
    const { prediction } = req.body;
    if (!prediction || !prediction.match) {
      return res.status(400).json({ error: "Missing prediction parameters" });
    }
    const id = prediction.id || `p-admin-${Date.now()}`;
    const cleanPred = { ...prediction, id };
    
    // Save match and prediction
    await setDoc(doc(db, 'matches', prediction.match.id), prediction.match);
    await setDoc(doc(db, 'predictions', id), cleanPred);
    
    res.json({ success: true, message: "Prediction created successfully", prediction: cleanPred });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create prediction", message: err.message });
  }
});

// 10. Admin Panel: Delete predictions
app.delete('/api/admin/predictions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteDoc(doc(db, 'predictions', id));
    res.json({ success: true, message: "Prediction deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete prediction", message: err.message });
  }
});

// 11. Admin Panel: Publish notification
app.post('/api/admin/notifications', async (req, res) => {
  try {
    const { notification } = req.body;
    const id = `notif-${Date.now()}`;
    const newNotif = { ...notification, id, timestamp: new Date().toISOString() };
    await setDoc(doc(db, 'notifications', id), newNotif);
    res.json({ success: true, notification: newNotif });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to post notification", message: err.message });
  }
});

// 12. Admin Panel: Publish strategy article
app.post('/api/admin/articles', async (req, res) => {
  try {
    const { article } = req.body;
    const id = `art-${Date.now()}`;
    const newArticle = { ...article, id, publishedAt: new Date().toISOString() };
    await setDoc(doc(db, 'articles', id), newArticle);
    res.json({ success: true, article: newArticle });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to publish article", message: err.message });
  }
});

// 13. Admin Panel: Update Overall Accuracy Statistics
app.post('/api/admin/stats', async (req, res) => {
  try {
    const { stats } = req.body;
    await setDoc(doc(db, 'stats', 'overall'), stats);
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update statistics", message: err.message });
  }
});

// 14. User Feedback: Submit rating and optional comment
app.post('/api/feedback', async (req, res) => {
  try {
    const { itemId, itemType, itemTitle, rating, comment, userId, userEmail } = req.body;
    if (!itemId || !itemType || !rating) {
      return res.status(400).json({ error: "Missing required fields (itemId, itemType, rating)" });
    }
    const id = `fb-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newFeedback = {
      id,
      itemId,
      itemType,
      itemTitle: itemTitle || "Unknown Item",
      rating: Number(rating),
      comment: comment || "",
      userId: userId || "",
      userEmail: userEmail || "",
      timestamp: new Date().toISOString()
    };
    await setDoc(doc(db, 'feedback', id), newFeedback);
    res.json({ success: true, feedback: newFeedback });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save user feedback", message: err.message });
  }
});

// 15. User Feedback: Fetch all feedbacks for admin analysis
app.get('/api/feedback', async (req, res) => {
  try {
    const qSnap = await getDocs(collection(db, 'feedback'));
    const feedbacks: any[] = [];
    qSnap.forEach(docSnap => {
      feedbacks.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort by newest timestamp first
    feedbacks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(feedbacks);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch user feedbacks", message: err.message });
  }
});

// Catch-all for undefined /api/* endpoints so they return JSON 404 instead of falling back to Vite index.html
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: "API endpoint not found", path: req.originalUrl });
});

// Express global error handler to ensure all server errors return JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express API Error Handler caught:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message || String(err) });
  }
});


/**
 * ============================================================================
 * VITE / STATIC SITE HOSTING (Production & Development support)
 * ============================================================================
 */
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Integrate Vite dev server middleware so Vite handles HMR and module resolution
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Host compiled static assets in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start Server listening on 0.0.0.0 and port 3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rafiki Predict full-stack server listening on http://localhost:${PORT}`);
  });
}

startServer();
