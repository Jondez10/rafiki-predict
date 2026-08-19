import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithApple,
  signInWithMicrosoft,
  signOut,
  doc, 
  getDoc, 
  setDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  where
} from './lib/firebase';
import { FirebaseUser } from './lib/firebase';
import { 
  UserProfile, 
  Prediction, 
  Accumulator, 
  Article, 
  NotificationLog, 
  PerformanceStats,
  SavedPrediction
} from './types';

// Icons
import { 
  Trophy, 
  TrendingUp, 
  Coins, 
  BookOpen, 
  Bell, 
  ShieldAlert, 
  Sparkles, 
  Phone, 
  Mail, 
  MessageSquare, 
  LogOut, 
  LogIn, 
  UserPlus, 
  Lock, 
  Settings, 
  Share2,
  Activity, 
  Menu, 
  X,
  UserCheck,
  CheckCircle2,
  CalendarDays,
  Globe,
  Flame,
  Zap,
  Crown,
  Award,
  Scale,
  Cookie,
  Star,
  Twitter,
  Send,
  ChevronDown,
  HelpCircle
} from 'lucide-react';

import { translations } from './translations';

// Subcomponents
import PredictionsTab from './components/PredictionsTab';
import SubscriptionTab from './components/SubscriptionTab';
import ArchiveTab from './components/ArchiveTab';
import ArticlesTab from './components/ArticlesTab';
import ResponsibleGambling from './components/ResponsibleGambling';
import AdminDashboard from './components/AdminDashboard';
import DailyQuiz from './components/DailyQuiz';
import GmailTab from './components/GmailTab';
import BettingBuddy from './components/BettingBuddy';
import CustomerSupportAgent from './components/CustomerSupportAgent';
import { signInWithGoogleGmail } from './lib/gmail';

// Badge Definitions and Helpers
export interface PerformanceBadge {
  id: string;
  level: number;
  name: string;
  nameSw: string;
  iconName: string;
  colorClass: string;
  bgGradient: string;
  glowColor: string;
  description: string;
  descriptionSw: string;
  minStreak: number;
}

export const ALL_BADGES: PerformanceBadge[] = [
  {
    id: 'legendary',
    level: 5,
    name: 'Legendary Oracle',
    nameSw: 'Kiongozi wa Ajabu',
    iconName: 'Sparkles',
    colorClass: 'text-fuchsia-400 bg-fuchsia-950/20 border-fuchsia-900/30',
    bgGradient: 'from-fuchsia-500/20 to-indigo-500/10',
    glowColor: 'rgba(217,70,239,0.5)',
    description: 'Divine prediction streak of 10+ correct bets in a row! Pure legendary prediction god.',
    descriptionSw: 'Mfululizo wa kimungu wa utabiri sahihi 10+ mfululizo! Bingwa wa ajabu.',
    minStreak: 10
  },
  {
    id: 'elite',
    level: 4,
    name: 'Elite Predictor',
    nameSw: 'Mtabiri Mkuu',
    iconName: 'Crown',
    colorClass: 'text-violet-400 bg-violet-950/20 border-violet-900/30',
    bgGradient: 'from-violet-500/20 to-purple-500/10',
    glowColor: 'rgba(139,92,246,0.4)',
    description: 'A stellar run of 8+ consecutive correct predictions. Master level analysis.',
    descriptionSw: 'Mfululizo mzuri wa utabiri sahihi 8+ mfululizo. Uchambuzi wa kiwango cha juu.',
    minStreak: 8
  },
  {
    id: 'unstoppable',
    level: 3,
    name: 'Unstoppable Force',
    nameSw: 'Nguvu Isiyozuilika',
    iconName: 'Zap',
    colorClass: 'text-amber-400 bg-amber-950/20 border-amber-900/30',
    bgGradient: 'from-amber-500/20 to-orange-500/10',
    glowColor: 'rgba(245,158,11,0.4)',
    description: 'Incredible form! 5+ wins in a row. Bookmakers are starting to sweat.',
    descriptionSw: 'Fomu ya kustaajabisha! Ushindi 5+ mfululizo. Makampuni ya kamari yanaanza kuogopa.',
    minStreak: 5
  },
  {
    id: 'hot_streak',
    level: 2,
    name: 'Hot Streak',
    nameSw: 'Moto Unaowaka',
    iconName: 'Flame',
    colorClass: 'text-rose-400 bg-rose-950/20 border-rose-900/30',
    bgGradient: 'from-rose-500/20 to-red-500/10',
    glowColor: 'rgba(244,63,94,0.4)',
    description: '3+ wins in a row! The analysis engine is locked in and heated up.',
    descriptionSw: 'Ushindi 3+ mfululizo! Injini ya uchambuzi imejipanga na ina mfululizo mzuri.',
    minStreak: 3
  },
  {
    id: 'rising_star',
    level: 1,
    name: 'Rising Star',
    nameSw: 'Nyota Inayoibuka',
    iconName: 'Award',
    colorClass: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30',
    bgGradient: 'from-emerald-500/10 to-teal-500/5',
    glowColor: 'rgba(16,185,129,0.3)',
    description: 'Excellent accuracy, starting strong in the arena.',
    descriptionSw: 'Usahihi mzuri, anayeanza kwa kasi uwanjani.',
    minStreak: 1
  }
];

export function getBadgeForStreak(streakStr: string): PerformanceBadge {
  const match = (streakStr || '').match(/(\d+)\s*(\w+)/);
  if (!match) {
    return ALL_BADGES[ALL_BADGES.length - 1]; // Fallback to Rising Star
  }

  const count = parseInt(match[1]);
  const isLoss = match[2].toLowerCase().includes('loss') || match[2].toLowerCase().includes('lose');

  if (isLoss) {
    return {
      id: 'contender',
      level: 0,
      name: 'Active Contender',
      nameSw: 'Mshindani Hai',
      iconName: 'Activity',
      colorClass: 'text-gray-400 bg-zinc-900/40 border-zinc-800/30',
      bgGradient: 'from-zinc-800/10 to-zinc-700/5',
      glowColor: 'rgba(156,163,175,0.1)',
      description: 'Analyzing patterns and adjusting strategies to bounce back.',
      descriptionSw: 'Anachambua mifumo na kurekebisha mbinu ili kurudi vizuri.',
      minStreak: 0
    };
  }

  if (count >= 10) return ALL_BADGES[0]; // Legendary
  if (count >= 8) return ALL_BADGES[1]; // Elite
  if (count >= 5) return ALL_BADGES[2]; // Unstoppable
  if (count >= 3) return ALL_BADGES[3]; // Hot Streak
  return ALL_BADGES[4]; // Rising Star
}

export function renderBadgeIcon(iconName: string, className = "w-4 h-4") {
  switch (iconName) {
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Crown':
      return <Crown className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'Activity':
      return <Activity className={className} />;
    default:
      return <Trophy className={className} />;
  }
}

export default function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'predictions' | 'subscription' | 'archive' | 'articles' | 'responsible' | 'admin' | 'quiz' | 'gmail'>('predictions');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [buddyOpen, setBuddyOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [theme, setTheme] = useState<'midnight' | 'high-contrast'>(() => {
    return (localStorage.getItem('rafiki-theme') as 'midnight' | 'high-contrast') || 'high-contrast';
  });
  const [displayDensity, setDisplayDensity] = useState<'comfortable' | 'compact'>(() => {
    return (localStorage.getItem('rafiki-density') as 'comfortable' | 'compact') || 'comfortable';
  });

  const handleToggleTheme = (newTheme?: 'midnight' | 'high-contrast') => {
    const nextTheme = newTheme || (theme === 'midnight' ? 'high-contrast' : 'midnight');
    setTheme(nextTheme);
    localStorage.setItem('rafiki-theme', nextTheme);
  };

  const handleToggleDensity = (newDensity?: 'comfortable' | 'compact') => {
    const nextDensity = newDensity || (displayDensity === 'comfortable' ? 'compact' : 'comfortable');
    setDisplayDensity(nextDensity);
    localStorage.setItem('rafiki-density', nextDensity);
  };

  const handleRestoreDisplayDefaults = () => {
    setTheme('high-contrast');
    setDisplayDensity('comfortable');
    localStorage.setItem('rafiki-theme', 'high-contrast');
    localStorage.setItem('rafiki-density', 'comfortable');
  };
  const [language, setLanguage] = useState<'en' | 'sw'>(() => {
    return (localStorage.getItem('rafiki-language') as 'en' | 'sw') || 'en';
  });
  
  const t = translations[language];

  // Handler for sharing the application using native Web Share API
  const handleShareApp = async () => {
    const shareData = {
      title: 'Rafiki Predict',
      text: t.shareAppDesc,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Web Share API error:', err);
          copyToClipboardFallback();
        }
      }
    } else {
      copyToClipboardFallback();
    }
  };

  const copyToClipboardFallback = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    }).catch((err) => {
      console.error('Failed to copy link to clipboard:', err);
    });
  };
  
  // Default seamless profile for frictionless VIP access
  const getInitialProfile = (): UserProfile => {
    try {
      const saved = localStorage.getItem('rafiki_user_session');
      if (saved) {
        const parsed = JSON.parse(saved) as UserProfile;
        if (parsed && parsed.uid) return parsed;
      }
    } catch (_) {}

    const defaultProfile: UserProfile = {
      uid: 'usr_john_mushira',
      email: 'johnmushira@gmail.com',
      username: 'John Mushira',
      createdAt: new Date().toISOString(),
      role: 'admin',
      subscriptionStatus: 'premium',
      subscriptionPlan: 'VIP Master Pass',
      premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      trialStartedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('rafiki_user_session', JSON.stringify(defaultProfile));
    } catch (_) {}
    return defaultProfile;
  };

  // Auth States - Always active session
  const [userProfile, setUserProfile] = useState<UserProfile>(getInitialProfile);
  const [user, setUser] = useState<FirebaseUser | null>(() => {
    const p = getInitialProfile();
    return {
      uid: p.uid,
      email: p.email,
      displayName: p.username
    } as any;
  });
  const [profileNameInput, setProfileNameInput] = useState(() => getInitialProfile().username || 'John Mushira');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Badge States
  const [isBadgesModalOpen, setIsBadgesModalOpen] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<'terms' | 'privacy' | 'cookies' | null>(null);
  const [celebratingBadge, setCelebratingBadge] = useState<any>(null);
  const [lastBadgeLevel, setLastBadgeLevel] = useState<number | null>(null);

  // Platform Data States with Local Cache fallback/hydration
  const [predictions, setPredictions] = useState<Prediction[]>(() => {
    try {
      const cached = localStorage.getItem('rafiki-predictions-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed.predictions) ? parsed.predictions : [];
      }
    } catch (_) {}
    return [];
  });
  const [accumulators, setAccumulators] = useState<Accumulator[]>(() => {
    try {
      const cached = localStorage.getItem('rafiki-predictions-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed.accumulators) ? parsed.accumulators : [];
      }
    } catch (_) {}
    return [];
  });
  const [articles, setArticles] = useState<Article[]>(() => {
    try {
      const cached = localStorage.getItem('rafiki-predictions-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed.articles) ? parsed.articles : [];
      }
    } catch (_) {}
    return [];
  });
  const [notifications, setNotifications] = useState<NotificationLog[]>(() => {
    try {
      const cached = localStorage.getItem('rafiki-predictions-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed.notifications) ? parsed.notifications : [];
      }
    } catch (_) {}
    return [];
  });
  const [stats, setStats] = useState<PerformanceStats | null>(() => {
    try {
      const cached = localStorage.getItem('rafiki-predictions-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.stats || null;
      }
    } catch (_) {}
    return null;
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [savedPredictions, setSavedPredictions] = useState<SavedPrediction[]>([]);

  // Monitor saved/bookmarked predictions in Firestore with localStorage fallback
  useEffect(() => {
    const currentUid = user?.uid || userProfile?.uid || 'usr_guest_vip';
    const localKey = `rafiki_saved_preds_${currentUid}`;

    // 1. Load initial cached bookmarks from localStorage
    try {
      const localData = localStorage.getItem(localKey);
      if (localData) {
        setSavedPredictions(JSON.parse(localData));
      }
    } catch (_) {}

    // 2. Real-time Firestore sync
    let unsubscribe = () => {};
    try {
      const q = query(collection(db, 'saved'), where('userId', '==', currentUid));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const docs: SavedPrediction[] = [];
        snapshot.forEach((snapDoc) => {
          docs.push(snapDoc.data() as SavedPrediction);
        });
        docs.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        setSavedPredictions(docs);
        try {
          localStorage.setItem(localKey, JSON.stringify(docs));
        } catch (_) {}
      }, (error) => {
        // Log as non-fatal warning to avoid noisy console errors if permission rules syncing
        console.warn("Firestore saved predictions sync notice:", error?.message || error);
      });
    } catch (err) {
      console.warn("Firestore subscription error:", err);
    }

    return () => unsubscribe();
  }, [user?.uid, userProfile?.uid]);

  // 1. Monitor User State & Profile Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setShowAuthModal(false);
        try {
          // Sync with Firestore profile
          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          
          if (snap.exists()) {
            const profile = snap.data() as UserProfile;
            setUserProfile(profile);
            localStorage.setItem('rafiki_user_session', JSON.stringify(profile));
          } else {
            // Create default profile
            const isTargetAdmin = firebaseUser.email === 'johnmushira@gmail.com';
            const defaultProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              username: firebaseUser.displayName || (firebaseUser.email || '').split('@')[0] || 'Rafiki Member',
              createdAt: new Date().toISOString(),
              role: isTargetAdmin ? 'admin' : 'user',
              subscriptionStatus: 'premium',
              subscriptionPlan: 'VIP Pass',
              premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              trialStartedAt: new Date().toISOString()
            };
            await setDoc(userRef, defaultProfile);
            setUserProfile(defaultProfile);
            localStorage.setItem('rafiki_user_session', JSON.stringify(defaultProfile));
          }
        } catch (err) {
          console.error("Firestore sync notice:", err);
        }
      } else {
        // Maintain active VIP guest session
        const initial = getInitialProfile();
        setUserProfile(initial);
        setUser({
          uid: initial.uid,
          email: initial.email,
          displayName: initial.username
        } as any);
      }
    });

    return () => unsubscribe();
  }, []);

  // Helper to safely parse API JSON responses
  const safeFetchJson = async (res: Response) => {
    try {
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Failed to parse response JSON:", err);
    }
    return null;
  };

  // 2. Fetch API Data
  const fetchPlatformData = async () => {
    setDataLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (user?.uid) {
        headers['x-user-uid'] = user.uid;
      }
      const uidQuery = user?.uid ? `?uid=${encodeURIComponent(user.uid)}` : '';

      const [pRes, aRes, artRes, nRes, sRes] = await Promise.all([
        fetch(`/api/predictions${uidQuery}`, { headers }),
        fetch(`/api/accumulators${uidQuery}`, { headers }),
        fetch(`/api/articles${uidQuery}`, { headers }),
        fetch(`/api/notifications${uidQuery}`, { headers }),
        fetch(`/api/stats${uidQuery}`, { headers })
      ]);

      const [pData, aData, artData, nData, sData] = await Promise.all([
        safeFetchJson(pRes),
        safeFetchJson(aRes),
        safeFetchJson(artRes),
        safeFetchJson(nRes),
        safeFetchJson(sRes)
      ]);

      const cleanPredictions = Array.isArray(pData) ? pData : [];
      const cleanAccumulators = Array.isArray(aData) ? aData : [];
      const cleanArticles = Array.isArray(artData) ? artData : [];
      const cleanNotifications = Array.isArray(nData) ? nData : [];
      const cleanStats = (sData && !sData.error) ? sData : null;

      setPredictions(cleanPredictions);
      setAccumulators(cleanAccumulators);
      setArticles(cleanArticles);
      setNotifications(cleanNotifications);
      setStats(cleanStats);

      // Save to localStorage for robust offline caching
      if (cleanPredictions.length > 0 || cleanAccumulators.length > 0 || cleanArticles.length > 0) {
        try {
          localStorage.setItem('rafiki-predictions-cache', JSON.stringify({
            predictions: cleanPredictions,
            accumulators: cleanAccumulators,
            articles: cleanArticles,
            notifications: cleanNotifications,
            stats: cleanStats,
            cachedAt: new Date().toISOString()
          }));
        } catch (cacheErr) {
          console.error("Failed to write to localStorage:", cacheErr);
        }
      }
      setIsOffline(false);
    } catch (err) {
      console.warn("Platform API request returned non-OK or payment required state:", err);
      
      // Load fallback from cache
      try {
        const cached = localStorage.getItem('rafiki-predictions-cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.predictions)) setPredictions(parsed.predictions);
          if (Array.isArray(parsed.accumulators)) setAccumulators(parsed.accumulators);
          if (Array.isArray(parsed.articles)) setArticles(parsed.articles);
          if (Array.isArray(parsed.notifications)) setNotifications(parsed.notifications);
          if (parsed.stats) setStats(parsed.stats);
        }
      } catch (cacheLoadErr) {
        console.error("Failed to load cached content:", cacheLoadErr);
      }
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatformData();

    const handleOnline = () => {
      setIsOffline(false);
      fetchPlatformData();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user?.uid, userProfile?.paymentStatus, userProfile?.subscriptionStatus]);

  // Monitor streak milestones and trigger animations
  useEffect(() => {
    if (!stats) return;
    const currentBadge = getBadgeForStreak(stats.streak || '');
    if (lastBadgeLevel !== null && currentBadge.level > lastBadgeLevel) {
      // Trigger milestone celebration!
      setCelebratingBadge(currentBadge);
    }
    setLastBadgeLevel(currentBadge.level);
  }, [stats?.streak]);

  // 3. Frictionless Profile & Role Switcher
  const handleUpdateProfile = (newUsername: string, newRole: 'admin' | 'user', newEmail?: string) => {
    const isTargetAdmin = newRole === 'admin';
    const emailToUse = newEmail || (isTargetAdmin ? 'johnmushira@gmail.com' : 'vip_member@rafikipredict.com');
    const cleanUsername = (newUsername || (isTargetAdmin ? 'John Mushira' : 'VIP Member')).trim();
    
    const updatedProfile: UserProfile = {
      ...userProfile,
      username: cleanUsername,
      email: emailToUse,
      role: newRole,
      subscriptionStatus: 'premium',
      subscriptionPlan: isTargetAdmin ? 'Admin Master Key' : 'VIP All-Access Pass',
      premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };

    setUserProfile(updatedProfile);
    setUser({
      uid: updatedProfile.uid,
      email: updatedProfile.email,
      displayName: updatedProfile.username
    } as any);

    try {
      localStorage.setItem('rafiki_user_session', JSON.stringify(updatedProfile));
      const userRef = doc(db, 'users', updatedProfile.uid);
      setDoc(userRef, updatedProfile, { merge: true }).catch(() => {});
    } catch (_) {}

    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (_) {}
    // Reset to a clean VIP guest session so user is never locked out
    const guestProfile: UserProfile = {
      uid: 'usr_guest_vip',
      email: 'guest@rafikipredict.com',
      username: 'VIP Member',
      createdAt: new Date().toISOString(),
      role: 'user',
      subscriptionStatus: 'premium',
      subscriptionPlan: 'VIP Free Pass',
      trialStartedAt: new Date().toISOString()
    };
    setUserProfile(guestProfile);
    setUser({
      uid: guestProfile.uid,
      email: guestProfile.email,
      displayName: guestProfile.username
    } as any);
    localStorage.setItem('rafiki_user_session', JSON.stringify(guestProfile));
    setProfileNameInput('VIP Member');
    setActiveTab('predictions');
  };

  // 4. Update local userProfile after subscription billing completes
  const handlePaymentSuccess = (updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
  };

  const handleSimulateWin = () => {
    if (!stats) return;
    const match = (stats.streak || '').match(/(\d+)\s*(\w+)/);
    let count = match ? parseInt(match[1]) : 0;
    const type = match ? match[2].toLowerCase() : 'wins';
    
    if (type.includes('loss') || type.includes('lose') || count === 0) {
      count = 1;
    } else {
      count += 1;
    }
    const newStreak = `${count} ${count === 1 ? 'Win' : 'Wins'}`;
    const updatedStats = { ...stats, streak: newStreak };
    setStats(updatedStats);
    
    // Also save to cache so it persists!
    try {
      const cached = localStorage.getItem('rafiki-predictions-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.stats = updatedStats;
        localStorage.setItem('rafiki-predictions-cache', JSON.stringify(parsed));
      }
    } catch (_) {}
  };

  const handleSimulateLoss = () => {
    if (!stats) return;
    const match = (stats.streak || '').match(/(\d+)\s*(\w+)/);
    let count = match ? parseInt(match[1]) : 0;
    const type = match ? match[2].toLowerCase() : 'losses';
    
    if (type.includes('win') || count === 0) {
      count = 1;
    } else {
      count += 1;
    }
    const newStreak = `${count} ${count === 1 ? 'Loss' : 'Losses'}`;
    const updatedStats = { ...stats, streak: newStreak };
    setStats(updatedStats);
    
    try {
      const cached = localStorage.getItem('rafiki-predictions-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.stats = updatedStats;
        localStorage.setItem('rafiki-predictions-cache', JSON.stringify(parsed));
      }
    } catch (_) {}
  };

  const currentBadge = getBadgeForStreak(stats?.streak || '5 Wins');

  // Find current win streak count
  const streakMatch = (stats?.streak || '').match(/(\d+)\s*(\w+)/);
  const winCount = (streakMatch && !streakMatch[2].toLowerCase().includes('loss') && !streakMatch[2].toLowerCase().includes('lose')) ? parseInt(streakMatch[1]) : 0;
  
  // Find the next badge
  const nextBadge = ALL_BADGES.slice().reverse().find(b => b.minStreak > winCount) || null;
  
  const prevMin = currentBadge.minStreak;
  const nextMin = nextBadge ? nextBadge.minStreak : 12;
  const progressPercent = Math.min(100, Math.max(0, ((winCount - prevMin) / (nextMin - prevMin)) * 100));

  return (
    <div className={`min-h-screen ${theme === 'high-contrast' ? 'theme-high-contrast bg-slate-50 text-slate-900' : 'bg-black text-gray-100'} flex flex-col justify-between selection:bg-emerald-500 selection:text-black antialiased font-sans`}>
      
      {/* HEADER SECTION */}
      <header className="bg-zinc-950 border-b border-zinc-900 sticky top-0 z-40" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Branding Logo */}
            <div 
              className="flex items-center gap-2 cursor-pointer group" 
              onClick={() => setActiveTab('predictions')}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)] group-hover:scale-105 transition-all">
                <Trophy className="w-5 h-5 text-black" />
              </div>
              <div>
                <span className="text-base font-sans font-black tracking-tight text-white block">
                  Rafiki Predict <span className="text-emerald-400">⭐⭐⭐⭐⭐</span>
                </span>
                <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase block -mt-1">
                  Best overall
                </span>
              </div>
            </div>

            {/* Desktop Navigation Link Toggles */}
            <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
              <button 
                onClick={() => setActiveTab('predictions')}
                className={`px-3 py-2 rounded-xl transition-all ${
                  activeTab === 'predictions' ? 'bg-zinc-900 text-white border border-zinc-800' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.todaysPicks}
              </button>
              
              <button 
                onClick={() => setActiveTab('archive')}
                className={`px-3 py-2 rounded-xl transition-all ${
                  activeTab === 'archive' ? 'bg-zinc-900 text-white border border-zinc-800' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.performanceLogs}
              </button>

              <button 
                onClick={() => setActiveTab('articles')}
                className={`px-3 py-2 rounded-xl transition-all ${
                  activeTab === 'articles' ? 'bg-zinc-900 text-white border border-zinc-800' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.strategyGuides}
              </button>

              <button 
                onClick={() => setActiveTab('quiz')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeTab === 'quiz' ? 'bg-zinc-900 text-white border border-zinc-800 font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                {t.dailyQuiz}
              </button>

              <button 
                onClick={() => setActiveTab('gmail')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeTab === 'gmail' ? 'bg-zinc-900 text-white border border-zinc-800 font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-red-400" />
                {t.gmailInbox}
              </button>

              <button 
                onClick={() => setActiveTab('responsible')}
                className={`px-3 py-2 rounded-xl transition-all ${
                  activeTab === 'responsible' ? 'bg-zinc-900 text-white border border-zinc-800' : 'text-gray-400 hover:text-white'
                }`}
              >
                {t.stakingGuard}
              </button>

              <button 
                onClick={() => setActiveTab('subscription')}
                className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeTab === 'subscription' 
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30' 
                    : 'text-emerald-400/90 hover:text-emerald-300'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                {t.unlockVipAcca}
              </button>

              {userProfile?.role === 'admin' && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-2 rounded-xl transition-all border ${
                    activeTab === 'admin' 
                      ? 'bg-zinc-900 text-white border-zinc-700' 
                      : 'text-purple-400 border-purple-950 hover:bg-purple-950/20'
                  }`}
                >
                  {t.adminCenter}
                </button>
              )}
            </nav>

            {/* Right Side: Account Controls, Notifications */}
            <div className="flex items-center gap-3">
              
              {/* Betting Buddy AI Chat Trigger */}
              <button 
                onClick={() => {
                  setBuddyOpen(!buddyOpen);
                  setNotifDrawerOpen(false);
                  setSettingsOpen(false);
                }}
                className={`p-2 hover:bg-zinc-800 rounded-xl border relative cursor-pointer transition-colors ${
                  buddyOpen 
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' 
                    : 'bg-zinc-900 text-gray-300 hover:text-white border-zinc-800'
                }`}
                title={t.bettingBuddy}
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </button>

              {/* Notification bell trigger */}
              <button 
                onClick={() => {
                  setNotifDrawerOpen(!notifDrawerOpen);
                  setSettingsOpen(false);
                  setBuddyOpen(false);
                }}
                className="p-2 bg-zinc-900 hover:bg-zinc-800 text-gray-300 hover:text-white rounded-xl border border-zinc-800 relative cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>

              {/* Quick Display Theme Mode toggle */}
              <button 
                onClick={() => handleToggleTheme()}
                className={`p-2 hover:bg-zinc-800 rounded-xl border relative cursor-pointer transition-colors ${
                  theme === 'high-contrast'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                    : 'bg-zinc-900 text-gray-300 hover:text-white border-zinc-800'
                }`}
                title={theme === 'high-contrast' ? 'Switch to Midnight Dark Theme' : 'Switch to High Contrast Light Theme'}
              >
                {theme === 'high-contrast' ? '☀️' : '🌙'}
              </button>

              {/* Settings gear trigger */}
              <button 
                onClick={() => {
                  setSettingsOpen(!settingsOpen);
                  setNotifDrawerOpen(false);
                  setBuddyOpen(false);
                }}
                className={`p-2 hover:bg-zinc-800 rounded-xl border relative cursor-pointer transition-colors ${
                  settingsOpen 
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' 
                    : 'bg-zinc-900 text-gray-300 hover:text-white border-zinc-800'
                }`}
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Share button trigger */}
              <button 
                onClick={handleShareApp}
                className={`p-2 hover:bg-zinc-800 rounded-xl border relative cursor-pointer transition-all ${
                  shareSuccess
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                    : 'bg-zinc-900 text-gray-300 hover:text-white border-zinc-800'
                }`}
                title={t.shareApp}
              >
                <Share2 className={`w-4 h-4 ${shareSuccess ? 'animate-bounce text-emerald-400' : ''}`} />
                {shareSuccess && (
                  <span className="absolute top-10 right-0 bg-emerald-500 text-black text-[10px] font-bold font-mono px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                    {language === 'en' ? 'Link Copied!' : 'Kiungo Kimenakiliwa!'}
                  </span>
                )}
              </button>

              {/* User profile toggle / preferences */}
              <div className="flex items-center gap-2">
                {/* Doughnut Chart */}
                {stats && (
                  <div 
                    className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-zinc-900/60 rounded-xl border border-zinc-800/80 hover:border-zinc-750 transition-all"
                    title={`${language === 'en' ? 'Win/Loss Ratio' : 'Uwiano wa Ushindi/Kushindwa'}: ${stats.totalWon}W - ${stats.totalLost}L`}
                  >
                    <div className="w-8 h-8 relative flex items-center justify-center">
                      <PieChart width={32} height={32}>
                        <Pie
                          data={[
                            { name: 'Won', value: stats.totalWon || 1 },
                            { name: 'Lost', value: stats.totalLost || 0 }
                          ]}
                          cx={16}
                          cy={16}
                          innerRadius={9}
                          outerRadius={15}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          <Cell key="cell-0" fill="#10b981" />
                          <Cell key="cell-1" fill="#ef4444" />
                        </Pie>
                      </PieChart>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[9px] font-mono font-bold text-emerald-400">
                          {Math.round(((stats.totalWon || 0) / ((stats.totalWon || 0) + (stats.totalLost || 0) || 1)) * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col text-left pr-1">
                      <span className="text-[8px] text-gray-400 font-medium font-sans uppercase tracking-wider leading-none">
                        {language === 'en' ? 'Record' : 'Rekodi'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-white leading-tight mt-0.5">
                        {stats.totalWon}W - {stats.totalLost}L
                      </span>
                    </div>
                  </div>
                )}

                {/* Profile Details Button */}
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="hidden md:flex items-center gap-2.5 px-3 py-1.5 bg-zinc-900/70 hover:bg-zinc-800 rounded-xl border border-zinc-800 hover:border-emerald-500/40 text-right cursor-pointer transition-all"
                  title="Click to view & customize Member Profile / Switch to Admin"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-xs">
                    {userProfile?.username?.charAt(0)?.toUpperCase() || 'V'}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-white block leading-tight truncate max-w-[130px]">
                      {userProfile?.username || 'VIP Member'}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] font-mono uppercase tracking-wider ${
                        userProfile?.role === 'admin' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'
                      }`}>
                        {userProfile?.role === 'admin' ? '⭐ Admin VIP' : '👑 VIP Pass'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Streak Badge pill */}
                <button 
                  onClick={() => setIsBadgesModalOpen(true)}
                  className={`hidden sm:flex text-[9px] font-mono ${currentBadge.colorClass} font-bold items-center gap-1 px-2 py-1.5 rounded-xl border border-zinc-800/80 bg-zinc-900/60 cursor-pointer hover:scale-105 active:scale-95 transition-all`}
                  title={`${t.badgesTitle}: ${language === 'en' ? currentBadge.name : currentBadge.nameSw}`}
                >
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 15, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  >
                    {renderBadgeIcon(currentBadge.iconName, "w-3 h-3")}
                  </motion.div>
                  <span>{stats?.streak || (language === 'en' ? '5 Wins' : 'Ushindi 5')}</span>
                </button>

                <button 
                  onClick={handleLogout}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-gray-400 hover:text-white rounded-xl border border-zinc-800 cursor-pointer transition-colors"
                  title="Reset session to VIP Guest"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile menu button */}
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 md:hidden bg-zinc-900 text-gray-300 rounded-xl border border-zinc-800 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>

            </div>

          </div>
        </div>
      </header>

      {/* MOBILE MENU NAVIGATION */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-950 border-b border-zinc-900 p-4 space-y-2 text-xs font-semibold">
          {[
            { id: 'predictions', label: t.todaysPicks },
            { id: 'archive', label: t.performanceLogs },
            { id: 'articles', label: t.strategyGuides },
            { id: 'quiz', label: `${t.dailyQuiz} ✨` },
            { id: 'gmail', label: `📧 ${t.gmailInbox}` },
            { id: 'responsible', label: t.stakingGuard },
            { id: 'subscription', label: t.unlockVipAcca, premium: true }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl block transition-all ${
                activeTab === item.id 
                  ? item.premium 
                    ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30'
                    : 'bg-zinc-900 text-white' 
                  : item.premium
                  ? 'text-emerald-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}

          {userProfile?.role === 'admin' && (
            <button
              onClick={() => {
                setActiveTab('admin');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-3 rounded-xl bg-purple-950/20 text-purple-400 border border-purple-900 block"
            >
              Admin Center
            </button>
          )}

          {user && (
            <div className="border-t border-zinc-900 pt-3 mt-3 px-4 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">User:</span>
                <span className="font-semibold text-white">{userProfile?.username || 'Premium User'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Status:</span>
                <span className={`font-mono uppercase text-[10px] tracking-wider ${
                  userProfile?.subscriptionStatus === 'premium' ? 'text-emerald-400 font-bold' : 'text-gray-500'
                }`}>
                  {userProfile?.subscriptionStatus === 'premium' ? t.premium : t.trialMode}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">{t.badgesTitle || 'Badge'}:</span>
                <button 
                  onClick={() => {
                    setIsBadgesModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-[10px] font-mono ${currentBadge.colorClass} font-bold flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:scale-105 active:scale-95 transition-all`}
                  title={`${t.badgesTitle}: ${language === 'en' ? currentBadge.name : currentBadge.nameSw}`}
                >
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 15, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  >
                    {renderBadgeIcon(currentBadge.iconName, "w-3 h-3")}
                  </motion.div>
                  <span>{stats?.streak || (language === 'en' ? '5 Wins' : 'Ushindi 5')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SYSTEM NOTIFICATION ALERTS DRAWER */}
      {notifDrawerOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-zinc-950 border-l border-zinc-800 shadow-2xl p-6 flex flex-col justify-between animate-slideLeft">
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-2 text-white font-sans font-bold text-sm">
                <Bell className="w-4 h-4 text-emerald-400 animate-bounce" />
                Rafiki Notification Logs
              </div>
              <button 
                onClick={() => setNotifDrawerOpen(false)}
                className="text-gray-500 hover:text-white text-xs bg-zinc-900 p-1 rounded border border-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs font-mono">
                  No notifications recorded currently.
                </div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl space-y-1.5 hover:border-zinc-700 transition-colors">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-white">{notif.title}</span>
                      <span className="text-[8px] font-mono text-gray-500">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-4 text-center text-[10px] text-gray-500 font-mono">
            Directly monitoring cloud webhooks
          </div>
        </div>
      )}

      {/* APP SETTINGS DRAWER */}
      {settingsOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-zinc-950 border-l border-zinc-800 shadow-2xl p-6 flex flex-col justify-between animate-slideLeft" id="settings-drawer">
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
              <div className="flex items-center gap-2 text-white font-sans font-bold text-sm">
                <Settings className="w-4 h-4 text-emerald-400" />
                {t.settingsTitle}
              </div>
              <button 
                onClick={() => setSettingsOpen(false)}
                className="text-gray-500 hover:text-white text-xs bg-zinc-900 p-1 rounded border border-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Language Settings Section */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-500 block flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  {t.languageToggle}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setLanguage('en');
                      localStorage.setItem('rafiki-language', 'en');
                    }}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all py-2.5 flex items-center justify-center gap-1.5 ${
                      language === 'en'
                        ? theme === 'high-contrast'
                          ? 'bg-zinc-100 border-emerald-600 text-zinc-900 font-bold'
                          : 'bg-zinc-900 border-emerald-500 text-white font-bold'
                        : 'bg-zinc-950 border-zinc-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>🇺🇸</span>
                    <span className="text-xs font-sans">{t.english}</span>
                  </button>

                  <button
                    onClick={() => {
                      setLanguage('sw');
                      localStorage.setItem('rafiki-language', 'sw');
                    }}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all py-2.5 flex items-center justify-center gap-1.5 ${
                      language === 'sw'
                        ? theme === 'high-contrast'
                          ? 'bg-zinc-100 border-emerald-600 text-zinc-900 font-bold'
                          : 'bg-zinc-900 border-emerald-500 text-white font-bold'
                        : 'bg-zinc-950 border-zinc-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span>🇹🇿</span>
                    <span className="text-xs font-sans">{t.swahili}</span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 leading-normal font-sans">
                  {t.languageToggleDesc}
                </p>
              </div>

              {/* Visual Theme Settings Section */}
              <div className="space-y-3 pt-2 border-t border-zinc-900">
                <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-500 block flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  {t.visualInterfaceTheme}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleToggleTheme('midnight')}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all py-2.5 flex flex-col items-center gap-1 ${
                      theme === 'midnight'
                        ? 'bg-zinc-900 border-emerald-500 text-white font-bold shadow-lg'
                        : 'bg-zinc-950 border-zinc-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">🌙</span>
                    <span className="text-xs font-sans">{t.midnightDark}</span>
                  </button>

                  <button
                    onClick={() => handleToggleTheme('high-contrast')}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all py-2.5 flex flex-col items-center gap-1 ${
                      theme === 'high-contrast'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold shadow-lg'
                        : 'bg-zinc-950 border-zinc-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">☀️</span>
                    <span className="text-xs font-sans">{t.highContrast}</span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 leading-normal font-sans">
                  {theme === 'high-contrast' ? t.highContrastDesc : t.midnightDesc}
                </p>
              </div>

              {/* Display Layout Density Section */}
              <div className="space-y-3 pt-2 border-t border-zinc-900">
                <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-500 block flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  {t.displayDensityTitle}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleToggleDensity('comfortable')}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all py-2.5 flex flex-col items-center gap-1 ${
                      displayDensity === 'comfortable'
                        ? 'bg-zinc-900 border-emerald-500 text-emerald-400 font-bold shadow-lg'
                        : 'bg-zinc-950 border-zinc-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold">📐</span>
                    <span className="text-xs font-sans">{t.comfortableMode}</span>
                  </button>

                  <button
                    onClick={() => handleToggleDensity('compact')}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all py-2.5 flex flex-col items-center gap-1 ${
                      displayDensity === 'compact'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 font-bold shadow-lg'
                        : 'bg-zinc-950 border-zinc-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold">⚡</span>
                    <span className="text-xs font-sans">{t.compactMode}</span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 leading-normal font-sans">
                  {t.displayDensityDesc}
                </p>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleRestoreDisplayDefaults}
                    className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-xs text-gray-400 hover:text-white rounded-xl transition-all font-mono flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>↺</span>
                    <span>{t.restoreDefaults || 'Restore Defaults'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-4 text-center text-[10px] text-gray-500 font-mono">
            {t.versionLabel}
          </div>
        </div>
      )}

      {/* MAIN LAYOUT PLATFORM CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {/* Unauthenticated Front Page Feature Overview Banner */}
        {!user && (
          <div className="mb-8 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-2xl relative overflow-hidden space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-mono font-bold">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  <span>Rafiki Predict • Premium Sports Analytics</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-sans font-black tracking-tight text-white">
                  AI-Powered Predictions & High-Precision Sports Insights
                </h1>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Welcome to East Africa&apos;s leading sports betting analytics suite. Built with high-confidence machine learning models, real-time odds tracking, and verifiably logged performance stats.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all shadow-[0_0_20px_-3px_rgba(16,185,129,0.4)] cursor-pointer flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  <span>Member Profile & VIP Access</span>
                </button>
              </div>
            </div>

            {/* Feature Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4 border-t border-zinc-900">
              <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">AI Match Predictions</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Machine learning probability scoring, Expected Value (+EV) metrics, and confidence indicators across major global leagues.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">VIP Daily Accumulators</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Handpicked multi-bet slips with combined odds from 2.00 to 10.00+ optimized for maximum steady returns.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">Instant League Sound Alerts</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Subscribe to your favorite sports leagues to receive real-time audio chimes and push notifications as predictions drop.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">24/7 AI Assistants</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Chat with Betting Buddy AI for match analysis and Rafiki Support AI for instant payment & account guidance.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">Verifiable Performance Logs</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    100% transparent historical win/loss archives with live streak tracking and monthly ROI reports.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl flex items-start gap-3">
                <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-0.5">Staking Guard & Budget Tools</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Built-in bankroll managers, daily budget limits, and cooling-off timers for safe, disciplined betting.
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Front-Page Display Mode Switcher */}
            <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/60 p-3.5 rounded-2xl border border-zinc-850">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-gray-300">
                  {t.displayOptions}:
                </span>
                <span className="text-[11px] text-gray-400 font-sans hidden md:inline">
                  Customize visual interface mode & layout density
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleToggleTheme('midnight')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    theme === 'midnight'
                      ? 'bg-emerald-950/50 border-emerald-500 text-emerald-400 font-bold shadow-lg'
                      : 'bg-zinc-900 border-zinc-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <span>🌙</span>
                  <span>{t.midnightDark}</span>
                </button>

                <button
                  onClick={() => handleToggleTheme('high-contrast')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    theme === 'high-contrast'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold shadow-lg'
                      : 'bg-zinc-900 border-zinc-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <span>☀️</span>
                  <span>{t.highContrast}</span>
                </button>

                <button
                  onClick={() => handleToggleDensity()}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    displayDensity === 'compact'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                      : 'bg-zinc-900 border-zinc-800 text-gray-300 hover:text-white'
                  }`}
                >
                  <span>{displayDensity === 'compact' ? '⚡' : '📐'}</span>
                  <span>{displayDensity === 'compact' ? t.compactMode : t.comfortableMode}</span>
                </button>

                <button
                  onClick={handleRestoreDisplayDefaults}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-gray-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                  title="Restore default display mode settings"
                >
                  <span>↺</span>
                  <span>{t.restoreDefaults || 'Restore Defaults'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick User Subscription Status Indicator Ribbon */}
        {userProfile && (
          <div className="mb-6 bg-zinc-900/50 border border-zinc-850 p-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-gray-300">
                {t.loggedInAs} <strong className="text-white">{userProfile.email}</strong>
              </span>
              <span className="text-gray-600 font-mono">|</span>
              <span className="text-gray-400">
                {t.accessTier}: <strong className="text-white capitalize">{userProfile.subscriptionStatus === 'premium' ? `${t.premium} (${userProfile.subscriptionPlan})` : t.trial}</strong>
              </span>
            </div>

            {userProfile.subscriptionStatus !== 'premium' ? (
              <button 
                onClick={() => setActiveTab('subscription')}
                className="text-emerald-400 font-semibold hover:text-emerald-300 flex items-center gap-1 cursor-pointer underline underline-offset-4"
              >
                {t.claimVipNow}
              </button>
            ) : (
              <div className="text-emerald-400 font-mono text-[11px]">
                {t.activeUntil} {new Date(userProfile.premiumExpiresAt || '').toLocaleDateString()}
              </div>
            )}
          </div>
        )}

        {/* Offline Banner Indicator */}
        {isOffline && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-2xl flex items-center justify-between text-xs text-amber-400">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>{t.offlineMode || "Offline Mode (Showing cached data)"}</span>
            </div>
            <button 
              onClick={fetchPlatformData}
              className="px-2.5 py-1 text-[10px] bg-amber-950/40 hover:bg-amber-950/60 border border-amber-900/30 rounded-lg cursor-pointer text-amber-300 font-mono transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Global Loading Spinner */}
        {dataLoading ? (
          <div className="py-20 text-center space-y-3 font-mono text-xs text-gray-400">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto"></div>
            <span>Synchronizing secure sport registries...</span>
          </div>
        ) : (
          <div className="animate-fadeIn">
            {activeTab === 'predictions' && (
              <PredictionsTab 
                predictions={predictions} 
                accumulators={accumulators} 
                userProfile={userProfile} 
                onNavigateToBilling={() => setActiveTab('subscription')} 
                onRefreshData={fetchPlatformData}
                language={language}
                savedPredictions={savedPredictions}
                theme={theme}
                displayDensity={displayDensity}
                onToggleTheme={handleToggleTheme}
                onToggleDensity={handleToggleDensity}
                onRestoreDefaults={handleRestoreDisplayDefaults}
              />
            )}

            {activeTab === 'subscription' && (
              <SubscriptionTab 
                user={user} 
                userProfile={userProfile} 
                onPaymentSuccess={handlePaymentSuccess} 
              />
            )}

            {activeTab === 'archive' && (
              <ArchiveTab 
                historicalPredictions={predictions.filter(p => p.id.startsWith('p-hist-'))} 
                stats={stats} 
                language={language}
                savedPredictions={savedPredictions}
              />
            )}

            {activeTab === 'articles' && (
              <ArticlesTab articles={articles} />
            )}

            {activeTab === 'responsible' && (
              <ResponsibleGambling />
            )}

            {activeTab === 'quiz' && (
              <DailyQuiz 
                predictions={predictions} 
                userProfile={userProfile} 
              />
            )}

            {activeTab === 'gmail' && (
              <GmailTab 
                userProfile={userProfile}
                language={language}
                theme={theme}
                displayDensity={displayDensity}
              />
            )}

            {userProfile?.role === 'admin' && activeTab === 'admin' && (
              <AdminDashboard 
                predictions={predictions} 
                articles={articles} 
                notifications={notifications} 
                stats={stats} 
                onRefreshData={fetchPlatformData} 
              />
            )}
          </div>
        )}
      </main>

      {/* FOOTER & CONTACT CHANNELS */}
      <footer className={`border-t mt-12 py-12 transition-all duration-300 ${theme === 'high-contrast' ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-zinc-950 border-zinc-900 text-gray-400'}`} id="app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Responsive Grid */}
          <div className={`grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b ${theme === 'high-contrast' ? 'border-slate-200' : 'border-zinc-900/60'} transition-colors duration-300`}>
            
            {/* Brand Column */}
            <div className="md:col-span-3 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black tracking-tight ${theme === 'high-contrast' ? 'text-slate-950' : 'text-white'}`}>
                    Rafiki Predict
                  </span>
                  <span className="flex text-amber-400 text-[10px] gap-0.5">
                    <Star className="w-3 h-3 fill-current" />
                    <Star className="w-3 h-3 fill-current" />
                    <Star className="w-3 h-3 fill-current" />
                    <Star className="w-3 h-3 fill-current" />
                    <Star className="w-3 h-3 fill-current" />
                  </span>
                </div>
                <p className="text-xs leading-relaxed max-w-sm text-gray-500">
                  {t.footerDesc}
                </p>
              </div>
              
              {/* Compliance & Security */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md font-bold tracking-wider ${theme === 'high-contrast' ? 'bg-slate-200 text-slate-700' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
                  BeGambleAware 18+
                </span>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md font-bold tracking-wider ${theme === 'high-contrast' ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/20'}`}>
                  SSL SECURE
                </span>
              </div>
            </div>

            {/* Social & Community Column */}
            <div className="md:col-span-3 space-y-3">
              <div className="space-y-0.5">
                <h5 className={`text-xs font-mono font-bold uppercase tracking-wider ${theme === 'high-contrast' ? 'text-slate-950' : 'text-white'}`}>
                  {language === 'en' ? 'Official Community' : 'Jumuiya Rasmi'}
                </h5>
                <p className="text-[10px] font-mono text-gray-500">
                  {language === 'en' ? 'Connect for updates' : 'Unganisha kwa sasisho'}
                </p>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                {/* Official Website */}
                <a 
                  href="https://rafikibusinesssolutions.netlify.app" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${theme === 'high-contrast' ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-emerald-600' : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-900 text-gray-400 hover:text-emerald-400'}`}
                >
                  <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="truncate text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="block text-[9px] font-mono text-gray-500 leading-none mb-0.5">Website</span>
                    </div>
                    <span className="font-semibold text-[11px] truncate">https://rafikibusinesssolutions.netlify.app</span>
                  </div>
                </a>

                {/* Twitter / X */}
                <a 
                  href="https://x.com/RafikiPredict" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${theme === 'high-contrast' ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-emerald-600' : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-900 text-gray-400 hover:text-emerald-400'}`}
                >
                  <Twitter className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="truncate text-left">
                    <span className="block text-[9px] font-mono text-gray-500 leading-none mb-0.5">Twitter / X</span>
                    <span className="font-semibold text-[11px] truncate">@RafikiPredict</span>
                  </div>
                </a>

                {/* Telegram */}
                <a 
                  href="https://t.me/RafikiPredict" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${theme === 'high-contrast' ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-emerald-600' : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-900 text-gray-400 hover:text-emerald-400'}`}
                >
                  <Send className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="truncate text-left">
                    <span className="block text-[9px] font-mono text-gray-500 leading-none mb-0.5">Telegram</span>
                    <span className="font-semibold text-[11px] truncate">Rafiki Predict Community</span>
                  </div>
                </a>
              </div>
            </div>

            {/* Support Channels Column */}
            <div className="md:col-span-3 space-y-3">
              <div className="space-y-0.5">
                <h5 className={`text-xs font-mono font-bold uppercase tracking-wider ${theme === 'high-contrast' ? 'text-slate-950' : 'text-white'}`}>
                  {t.supportHeading}
                </h5>
                <p className="text-[10px] font-mono text-gray-500">
                  {t.contactHours}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2 text-xs">
                <a href="mailto:rafikibc1000@gmail.com" className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${theme === 'high-contrast' ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-emerald-600' : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-900 text-gray-400 hover:text-emerald-400'}`}>
                  <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="truncate">
                    <span className="block text-[9px] font-mono text-gray-500 leading-none mb-0.5">{t.emailSupport}</span>
                    <span className="font-mono text-[11px] truncate">rafikibc1000@gmail.com</span>
                  </div>
                </a>

                <a href="https://wa.me/254716483642" target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${theme === 'high-contrast' ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-emerald-600' : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-900 text-gray-400 hover:text-emerald-400'}`}>
                  <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <span className="block text-[9px] font-mono text-gray-500 leading-none mb-0.5">{t.whatsAppChat}</span>
                    <span className="font-mono text-[11px] truncate">0716483642 (+254716483642)</span>
                  </div>
                </a>

                <a href="tel:+254716483642" className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${theme === 'high-contrast' ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-emerald-600' : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-900 text-gray-400 hover:text-emerald-400'}`}>
                  <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="truncate">
                    <span className="block text-[9px] font-mono text-gray-500 leading-none mb-0.5">{t.callAgent}</span>
                    <span className="font-mono text-[11px] truncate">0716483642 (+254716483642)</span>
                  </div>
                </a>

                <a href="sms:+254716483642" className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${theme === 'high-contrast' ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-emerald-600' : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-900 text-gray-400 hover:text-emerald-400'}`}>
                  <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="truncate">
                    <span className="block text-[9px] font-mono text-gray-500 leading-none mb-0.5">{t.smsSupport}</span>
                    <span className="font-mono text-[11px] truncate">0716483642</span>
                  </div>
                </a>
              </div>
            </div>

            {/* Policies Column */}
            <div className="md:col-span-3 space-y-3">
              <h5 className={`text-xs font-mono font-bold uppercase tracking-wider ${theme === 'high-contrast' ? 'text-slate-950' : 'text-white'}`}>
                {t.legalHeading}
              </h5>

              <div className="flex flex-col gap-2 text-xs font-mono">
                <button 
                  onClick={() => {
                    setActiveTab('responsible');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} 
                  className={`flex items-center gap-2 py-1 hover:underline text-left cursor-pointer transition-colors ${theme === 'high-contrast' ? 'text-slate-600 hover:text-emerald-600' : 'text-gray-400 hover:text-emerald-400'}`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{t.responsibleGaming}</span>
                </button>

                <button 
                  onClick={() => setShowLegalModal('terms')} 
                  className={`flex items-center gap-2 py-1 hover:underline text-left cursor-pointer transition-colors ${theme === 'high-contrast' ? 'text-slate-600 hover:text-emerald-600' : 'text-gray-400 hover:text-emerald-400'}`}
                >
                  <Scale className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{language === 'en' ? 'Terms of Service' : 'Vigezo na Masharti'}</span>
                </button>

                <button 
                  onClick={() => setShowLegalModal('privacy')} 
                  className={`flex items-center gap-2 py-1 hover:underline text-left cursor-pointer transition-colors ${theme === 'high-contrast' ? 'text-slate-600 hover:text-emerald-600' : 'text-gray-400 hover:text-emerald-400'}`}
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{language === 'en' ? 'Privacy Policy' : 'Sera ya Faragha'}</span>
                </button>

                <button 
                  onClick={() => setShowLegalModal('cookies')} 
                  className={`flex items-center gap-2 py-1 hover:underline text-left cursor-pointer transition-colors ${theme === 'high-contrast' ? 'text-slate-600 hover:text-emerald-600' : 'text-gray-400 hover:text-emerald-400'}`}
                >
                  <Cookie className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>{t.cookieSettings}</span>
                </button>
              </div>
            </div>
          </div>

          {/* FAQ Accordion Section */}
          <div className={`mt-8 pt-8 border-t ${theme === 'high-contrast' ? 'border-slate-200' : 'border-zinc-900/60'} space-y-6`} id="footer-faq-section">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <h4 className={`text-xs font-mono font-bold uppercase tracking-wider ${theme === 'high-contrast' ? 'text-slate-950' : 'text-white'}`}>
                {language === 'en' ? 'Frequently Asked Questions' : 'Maswali yanayoulizwa mara kwa mara'}
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'upgrade',
                  question: language === 'en' ? 'How do I upgrade to Premium?' : 'Ninalipia vipi kujiunga na VIP Premium?',
                  answer: language === 'en' 
                    ? 'Upgrading to Premium is quick and secure! Navigate to the "Subscription" tab, select your preferred plan (Daily, Weekly, or Monthly), and click "Unlock Premium Now". You can complete the checkout using our secure payment gateway mockup with any test credit card details.'
                    : 'Kujiunga na Premium ni haraka na salama! Nenda kwenye tabo ya "Subscription" (Usajili), chagua mpango unaopendelea (Kila Siku, Wiki, au Mwezi), na ubofye "Unlock Premium Now". Unaweza kukamilisha malipo kwa kutumia lango letu la malipo salama la majaribio kwa kutumia nambari yoyote ya kadi ya majaribio.'
                },
                {
                  id: 'accuracy',
                  question: language === 'en' ? 'Is the AI accuracy guaranteed?' : 'Je, usahihi wa AI umehifadhiwa kikamilifu?',
                  answer: language === 'en'
                    ? 'While our multi-criteria AI consensus modeling engine operates at a high verified historical success rate (typically exceeding 80%+ on low-risk picks), sports outcomes are inherently unpredictable. No prediction is 100% guaranteed. We highly advise following our Responsible Gambling guidelines and bankroll management strategies.'
                    : 'Ingawa mfumo wetu wa makubaliano wa AI hufanya kazi kwa kiwango cha juu cha mafanikio ya kihistoria kilichothibitishwa (kawaida kinazidi 80%+ kwenye chaguo za hatari ndogo), matokeo ya michezo hayajatulia kwa asili. Hakuna utabiri unaohakikishwa 100%. Tunashauri sana kufuata miongozo yetu ya Kamari ya Kiwajibikaji na mikakati ya usimamizi wa mtaji.'
                },
                {
                  id: 'cancel',
                  question: language === 'en' ? 'How do I cancel my subscription?' : 'Je, ninafuta vipi usajili wangu?',
                  answer: language === 'en'
                    ? 'You are in full control of your subscriptions. Since we support offline-first local states and simulated secure profiles, you can cancel, pause, or reset your current premium tier directly at any time by visiting the "Subscription" tab and clicking "Cancel Active Plan" inside the billing management section, with no questions asked and zero penalties.'
                    : 'Una udhibiti kamili wa usajili wako. Kwa sababu tunasaidia hifadhi ya karibu ya kwanza (offline-first) na wasifu salama wa majaribio, unaweza kufuta, kusitisha, au kuweka upya mpango wako wa premium moja kwa moja wakati wowote kwa kutembelea tabo ya "Subscription" na kubofya "Cancel Active Plan" ndani ya sehemu ya usimamizi wa bili, bila maswali yoyote na bila adhabu.'
                }
              ].map((faq) => {
                const isExpanded = expandedFaq === faq.id;
                return (
                  <div 
                    key={faq.id} 
                    className={`rounded-2xl border transition-all duration-350 overflow-hidden ${
                      isExpanded 
                        ? 'bg-zinc-900/60 border-emerald-500/30 shadow-lg shadow-emerald-500/5' 
                        : 'bg-zinc-950/40 border-zinc-900/60 hover:bg-zinc-900/20 hover:border-zinc-850'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                      className="w-full flex items-center justify-between p-4 text-left cursor-pointer transition-colors"
                    >
                      <span className="text-xs font-sans font-bold text-white pr-4">
                        {faq.question}
                      </span>
                      <ChevronDown 
                        className={`w-3.5 h-3.5 text-emerald-400 shrink-0 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180 text-emerald-300' : ''
                        }`} 
                      />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                        >
                          <div className="px-4 pb-4 border-t border-zinc-900/30 pt-3">
                            <p className="text-[11px] leading-relaxed text-gray-400">
                              {faq.answer}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disclaimer & Copyright */}
          <div className="pt-6 space-y-4">
            <p className="text-[10px] leading-relaxed text-gray-500 text-justify">
              {t.disclaimerText}
            </p>

            <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-gray-500 font-mono border-t pt-4 ${theme === 'high-contrast' ? 'border-slate-200' : 'border-zinc-900/60'}`}>
              <span>© 2026 Rafiki Predict Inc. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <span>{t.versionLabel || 'Version 2.4.0'}</span>
                <span>•</span>
                <span className="text-emerald-500 font-bold">100% SECURE</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* MEMBER PROFILE & PREFERENCES MODAL (ZERO-FRICTION ACCESS) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAuthModal(false)} />
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden p-6 shadow-2xl relative z-10 space-y-5">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[11px] font-mono font-bold">
                  <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Member Profile & Access</span>
                </div>
                <h4 className="text-lg font-bold font-sans text-white">
                  Rafiki Predict Member
                </h4>
                <p className="text-xs text-emerald-400 font-mono">
                  ✓ Instant VIP Access Active • No Passwords Required
                </p>
              </div>
              <button 
                onClick={() => setShowAuthModal(false)}
                className="p-1 text-gray-400 hover:text-white bg-zinc-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Customizer Box */}
            <div className="bg-zinc-950/80 border border-zinc-850 rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">
                  Display Name / Alias
                </label>
                <input
                  type="text"
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none"
                />
              </div>

              {/* 1-Click Role Switcher */}
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1.5">
                  Account Role & Privileges
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateProfile(profileNameInput || 'VIP Member', 'user')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      userProfile?.role !== 'admin'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg'
                        : 'bg-zinc-900 border-zinc-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-1">
                      <span>👑</span>
                      <span>VIP Member</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">
                      Full access to all AI match picks & VIP slips
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateProfile(profileNameInput || 'John Mushira', 'admin', 'johnmushira@gmail.com')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      userProfile?.role === 'admin'
                        ? 'bg-amber-950/40 border-amber-500 text-white shadow-lg'
                        : 'bg-zinc-900 border-zinc-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
                      <span>⭐</span>
                      <span>Admin Mode</span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">
                      Manage predictions & admin publishing tools
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Display Mode Switcher inside Profile Dialog */}
            <div className="bg-zinc-950/80 border border-zinc-850 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" /> Display Mode & Theme
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {theme === 'high-contrast' ? 'Light' : 'Dark'} • {displayDensity === 'compact' ? 'Compact' : 'Comfortable'}
                </span>
              </div>

              {/* Theme Mode Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleToggleTheme('midnight')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    theme === 'midnight'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>🌙</span>
                  <span>Midnight Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleTheme('high-contrast')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    theme === 'high-contrast'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span>☀️</span>
                  <span>High Contrast</span>
                </button>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={() => handleUpdateProfile(profileNameInput || userProfile?.username || 'VIP Member', userProfile?.role || 'user')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_20px_-3px_rgba(16,185,129,0.3)]"
            >
              <span>Save & Continue</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Triggers Container */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Floating Customer Support AI Trigger Button */}
        <button
          onClick={() => setSupportOpen(true)}
          className="relative group p-3.5 bg-blue-500 hover:bg-blue-400 text-black shadow-2xl rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer border border-blue-350"
          title={language === 'en' ? 'AI Customer Support' : 'Msaada wa AI'}
        >
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 border border-black"></span>
          </span>
          <MessageSquare className="w-5 h-5 text-black fill-black/10" />
          
          {/* Tooltip */}
          <div className="absolute right-14 bg-zinc-950 border border-zinc-800 text-[11px] font-sans text-gray-200 px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-xl flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span className="font-semibold">{language === 'en' ? 'AI Customer Support' : 'Huduma kwa Wateja (AI)'}</span>
          </div>
        </button>

        {/* Floating Betting Buddy Trigger Button */}
        <button
          onClick={() => setBuddyOpen(true)}
          className="relative group p-3.5 bg-emerald-500 hover:bg-emerald-400 text-black shadow-2xl rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer border border-emerald-350"
          title={translations[language].bettingBuddy}
        >
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-black"></span>
          </span>
          <Sparkles className="w-5 h-5" />
          
          {/* Tooltip */}
          <div className="absolute right-14 bg-zinc-950 border border-zinc-800 text-[11px] font-sans text-gray-200 px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-xl flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="font-semibold">{translations[language].bettingBuddy}</span>
          </div>
        </button>
      </div>

      {/* Betting Buddy AI Drawer */}
      <BettingBuddy 
        isOpen={buddyOpen} 
        onClose={() => setBuddyOpen(false)} 
        language={language} 
        translations={translations[language]} 
      />

      {/* AI Customer Support Agent Drawer */}
      <CustomerSupportAgent
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        language={language}
      />

      {/* BADGES SHOWCASE MODAL */}
      <AnimatePresence>
        {isBadgesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBadgesModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative z-10 p-6 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="text-sm font-bold font-sans text-white uppercase tracking-wider">
                      {t.badgesTitle}
                    </h4>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {t.badgesDesc}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsBadgesModalOpen(false)}
                  className="text-gray-500 hover:text-white text-xs bg-zinc-950 px-2 py-1.5 rounded-lg border border-zinc-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="py-6 space-y-6 overflow-y-auto flex-grow pr-1">
                
                {/* Active Badge Card */}
                <div className={`p-5 rounded-2xl bg-gradient-to-br ${currentBadge.bgGradient} border border-zinc-850 flex flex-col items-center text-center relative overflow-hidden group`}>
                  {/* Decorative glowing background */}
                  <div className="absolute inset-0 opacity-15 filter blur-xl transition-all duration-500 group-hover:scale-110 pointer-events-none" style={{ backgroundColor: currentBadge.glowColor }} />
                  
                  <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 mb-2 font-bold px-2 py-0.5 bg-emerald-950/40 border border-emerald-900/30 rounded-full">
                    {t.activeBadge}
                  </span>

                  <motion.div 
                    animate={{ 
                      y: [0, -6, 0],
                      rotate: [0, 2, -2, 0]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 4, 
                      ease: "easeInOut" 
                    }}
                    className={`w-16 h-16 rounded-2xl bg-zinc-950 flex items-center justify-center border border-zinc-850 shadow-xl ${currentBadge.colorClass} mb-3`}
                  >
                    {renderBadgeIcon(currentBadge.iconName, "w-8 h-8")}
                  </motion.div>

                  <h5 className="text-base font-bold text-white font-sans">
                    {language === 'en' ? currentBadge.name : currentBadge.nameSw}
                  </h5>

                  <p className="text-xs text-gray-400 max-w-sm mt-1.5 leading-relaxed">
                    {language === 'en' ? currentBadge.description : currentBadge.descriptionSw}
                  </p>

                  <div className="mt-4 font-mono text-[10px] text-gray-400 bg-zinc-950/60 px-3 py-1.5 rounded-xl border border-zinc-900 flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-amber-500" />
                    <span>Current Streak: <strong>{stats?.streak || '5 Wins'}</strong></span>
                  </div>
                </div>

                {/* Milestone Progress Bar */}
                {nextBadge && (
                  <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center text-[11px] font-mono">
                      <span className="text-gray-500">{t.nextMilestone}:</span>
                      <span className="text-emerald-400 font-bold">
                        {language === 'en' ? nextBadge.name : nextBadge.nameSw} ({nextBadge.minStreak} {language === 'en' ? 'Wins' : 'Ushindi'})
                      </span>
                    </div>

                    <div className="relative w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono">
                      <span>{currentBadge.minStreak} wins</span>
                      <span>{nextBadge.minStreak - winCount} wins left</span>
                      <span>{nextBadge.minStreak} wins</span>
                    </div>
                  </div>
                )}

                {/* Showcase List */}
                <div className="space-y-3">
                  <h6 className="text-[11px] font-mono text-gray-500 uppercase tracking-wider pl-1">
                    All Medal Milestones
                  </h6>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    {ALL_BADGES.map((badge) => {
                      const isUnlocked = winCount >= badge.minStreak;
                      return (
                        <div 
                          key={badge.id} 
                          className={`p-3.5 rounded-xl border flex items-center gap-4 transition-all ${
                            isUnlocked 
                              ? 'bg-zinc-950/40 border-zinc-800' 
                              : 'bg-zinc-950/10 border-zinc-900/60 opacity-45'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-center ${isUnlocked ? badge.colorClass : 'text-gray-600'}`}>
                            {renderBadgeIcon(badge.iconName, "w-5 h-5")}
                          </div>

                          <div className="flex-grow space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {language === 'en' ? badge.name : badge.nameSw}
                              </span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isUnlocked ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : 'bg-zinc-900 text-gray-500'}`}>
                                {badge.minStreak}+ Wins
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-tight">
                              {language === 'en' ? badge.description : badge.descriptionSw}
                            </p>
                          </div>

                          <div className="text-right">
                            {isUnlocked ? (
                              <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/20 px-2 py-1 border border-emerald-900/20 rounded-lg">
                                Unlocked
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-gray-500 bg-zinc-900 px-2 py-1 rounded-lg">
                                Locked
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Simulation Control Panel */}
                <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
                    <Settings className="w-3.5 h-3.5" />
                    <span>SYSTEM STREAK SIMULATION (ADMIN MODE)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={handleSimulateWin}
                      className="px-3 py-2 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 hover:text-emerald-300 font-mono text-[10px] font-bold rounded-xl transition-all cursor-pointer text-center"
                    >
                      {t.testStreakBtn}
                    </button>
                    <button 
                      onClick={handleSimulateLoss}
                      className="px-3 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 text-red-400 hover:text-red-300 font-mono text-[10px] font-bold rounded-xl transition-all cursor-pointer text-center"
                    >
                      {t.resetStreakBtn}
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MILESTONE CELEBRATORY OVERLAY */}
      <AnimatePresence>
        {celebratingBadge && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCelebratingBadge(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            
            {/* Confetti Explosion particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(24)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    x: "50vw", 
                    y: "50vh", 
                    scale: 0.5,
                    opacity: 1,
                    rotate: 0 
                  }}
                  animate={{ 
                    x: `${50 + (Math.random() * 80 - 40)}vw`, 
                    y: `${50 + (Math.random() * 80 - 40)}vh`,
                    scale: Math.random() * 1.5 + 0.5,
                    opacity: [1, 1, 0],
                    rotate: Math.random() * 720
                  }}
                  transition={{ 
                    duration: Math.random() * 2 + 1.5, 
                    ease: "easeOut" 
                  }}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: i % 4 === 0 ? '#10b981' : i % 4 === 1 ? '#e11d48' : i % 4 === 2 ? '#f59e0b' : '#c084fc',
                    boxShadow: '0 0 10px rgba(255,255,255,0.4)'
                  }}
                />
              ))}
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
              className="bg-zinc-950 border border-zinc-850 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)] relative z-10 p-8 flex flex-col items-center text-center space-y-6"
            >
              {/* Star bursts in background */}
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full filter blur-3xl -z-10 animate-pulse pointer-events-none" />

              <div className="space-y-1">
                <div className="text-[11px] font-mono tracking-widest text-emerald-400 font-bold uppercase animate-bounce">
                  {t.milestoneAchieved}
                </div>
                <h3 className="text-xl font-black font-sans text-white tracking-tight">
                  {language === 'en' ? celebratingBadge.name : celebratingBadge.nameSw}
                </h3>
              </div>

              {/* Giant Medal badge spinning and bouncing */}
              <motion.div
                initial={{ rotate: -180, scale: 0 }}
                animate={{ rotate: 360, scale: 1 }}
                transition={{ type: "spring", stiffness: 100, damping: 12, delay: 0.2 }}
                className={`w-24 h-24 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center relative ${celebratingBadge.colorClass}`}
                style={{
                  boxShadow: `0 0 40px ${celebratingBadge.glowColor}`
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-2 -right-2 text-yellow-400"
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
                
                {renderBadgeIcon(celebratingBadge.iconName, "w-12 h-12")}
              </motion.div>

              <div className="space-y-2 max-w-sm">
                <p className="text-xs text-gray-300 font-sans leading-relaxed">
                  {t.congratsMsg}
                </p>
                <p className="text-[11px] text-gray-500 font-mono italic">
                  "{language === 'en' ? celebratingBadge.description : celebratingBadge.descriptionSw}"
                </p>
              </div>

              <div className="pt-2 w-full">
                <button
                  onClick={() => setCelebratingBadge(null)}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-black py-3 rounded-2xl text-xs transition-all cursor-pointer transform active:scale-95 shadow-[0_0_20px_-3px_rgba(16,185,129,0.3)]"
                >
                  {t.dismissBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LEGAL POLICIES MODAL */}
      <AnimatePresence>
        {showLegalModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLegalModal(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className={`border rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative z-[120] p-6 max-h-[85vh] flex flex-col ${theme === 'high-contrast' ? 'bg-white border-slate-200 text-slate-900' : 'bg-zinc-900 border-zinc-800 text-white'}`}
            >
              {/* Header */}
              <div className={`flex justify-between items-center border-b pb-4 ${theme === 'high-contrast' ? 'border-slate-100' : 'border-zinc-800'}`}>
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-emerald-500 animate-pulse" />
                  <div>
                    <h4 className="text-sm font-bold font-sans uppercase tracking-wider">
                      {showLegalModal === 'terms' 
                        ? (language === 'en' ? 'Terms of Service' : 'Vigezo na Masharti')
                        : showLegalModal === 'privacy'
                        ? (language === 'en' ? 'Privacy Policy' : 'Sera ya Faragha')
                        : (language === 'en' ? 'Cookie Preferences' : 'Mapendeleo ya Kuki')
                      }
                    </h4>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {language === 'en' ? 'Last updated: July 2026' : 'Ilisasishwa mwisho: Julai 2026'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLegalModal(null)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer font-bold ${theme === 'high-contrast' ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800' : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-gray-400 hover:text-white'}`}
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="py-4 space-y-4 overflow-y-auto flex-grow pr-1 text-xs leading-relaxed text-gray-400">
                {showLegalModal === 'terms' && (
                  <>
                    <div className="space-y-1.5">
                      <h6 className={`font-bold font-sans ${theme === 'high-contrast' ? 'text-slate-900' : 'text-white'}`}>
                        1. {language === 'en' ? 'Acceptance of Terms' : 'Kukubali Masharti'}
                      </h6>
                      <p>
                        {language === 'en' 
                          ? 'By accessing Rafiki Predict, you agree to comply with our general conditions. Our platform utilizes custom mathematical AI models to analyze past performance indicators and produce daily football, basketball, and tennis predictions.' 
                          : 'Kwa kupata Rafiki Predict, unakubali kufuata masharti yetu. Jukwaa letu linatumia mifumo maalum ya AI ya hisabati ili kuchambua viashiria vya utendaji wa nyuma na kutoa utabiri wa kila siku wa soka, mpira vya kikapu, na tenisi.'
                        }
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h6 className={`font-bold font-sans ${theme === 'high-contrast' ? 'text-slate-900' : 'text-white'}`}>
                        2. {language === 'en' ? 'Analytical Accuracy & No Guarantees' : 'Usahihi wa Kiutafiti na Hakuna Dhamana'}
                      </h6>
                      <p>
                        {language === 'en'
                          ? 'Sports forecasting involves inherent uncertainties. All probability scores and predictions are simulated calculations. We do not provide financial betting recommendations or guaranteed outcomes. Wager solely at your own discretion.'
                          : 'Utabiri wa michezo unahusisha mabadiliko yasiyotabirika. Alama zote za uwezekano na utabiri ni hesabu zilizojengwa kwa mfano. Hatutoi ushauri wa kifedha au matokeo ya uhakika. Weka dau kwa hiari yako mwenyewe.'
                        }
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h6 className={`font-bold font-sans ${theme === 'high-contrast' ? 'text-slate-900' : 'text-white'}`}>
                        3. {language === 'en' ? 'Age Restrictions (18+)' : 'Vizuizi vya Umri (18+)'}
                      </h6>
                      <p>
                        {language === 'en'
                          ? 'Our predictive service is exclusively designed for mature audiences. Users must be at least 18 years of age (or the legal age in their specific legal jurisdiction) to browse active forecast accumulators or subscribe to analytics feeds.'
                          : 'Huduma yetu ya utabiri imeundwa mahususi kwa watu wazima. Watumiaji lazima wawe na umri wa angalau miaka 18 (au umri wa kisheria katika mamlaka yao) ili kuvinjari majamvi ya utabiri au kujiandikisha.'
                        }
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h6 className={`font-bold font-sans ${theme === 'high-contrast' ? 'text-slate-900' : 'text-white'}`}>
                        4. {language === 'en' ? 'Intellectual Property' : 'Miliki ya Kimaono'}
                      </h6>
                      <p>
                        {language === 'en'
                          ? 'The proprietary machine learning algorithms, database configurations, and UI designs of Rafiki Predict are copyrighted and protected globally. Unauthorized reproduction or API scrapings are strictly prohibited.'
                          : 'Algoridmu za kipekee za kujifunza kwa mashine, usanidi wa hifadhidata, na miundo ya UI ya Rafiki Predict inalindwa kisheria kote duniani. Kuzalisha upya bila ruhusa au kukwapua API ni marufuku kabisa.'
                        }
                      </p>
                    </div>
                  </>
                )}

                {showLegalModal === 'privacy' && (
                  <>
                    <div className="space-y-1.5">
                      <h6 className={`font-bold font-sans ${theme === 'high-contrast' ? 'text-slate-900' : 'text-white'}`}>
                        1. {language === 'en' ? 'Data We Collect' : 'Data Tunazokusanya'}
                      </h6>
                      <p>
                        {language === 'en'
                          ? 'We strictly collect and process minimal data parameters required for platform operations. This includes your secure authentication email, registration date, custom performance streak statistics, and active visual themes.'
                          : 'Tunakusanya na kuchakata vigezo vidogo vya data vinavyohitajika kwa uendeshaji wa jukwaa. Hii ni pamoja na barua pepe ya uthibitishaji salama, tarehe ya usajili, takwimu za mfululizo wa ushindi, na mandhari unayopendelea.'
                        }
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h6 className={`font-bold font-sans ${theme === 'high-contrast' ? 'text-slate-900' : 'text-white'}`}>
                        2. {language === 'en' ? 'Database Synchronization' : 'Ulandanishaji wa Hifadhidata'}
                      </h6>
                      <p>
                        {language === 'en'
                          ? 'Our app leverages secure cloud synchronization powered by Google Firebase. User profiles, subscription statuses, and local preferences are encrypted during transit and stored securely inside authenticated Firestore records.'
                          : 'Programu yetu inatumia ulandanishaji salama wa wingu unaowezeshwa na Google Firebase. Wasifu wa mtumiaji, hali ya usajili, na mapendeleo ya ndani yanasimbwa wakati wa kusafirishwa na kuhifadhiwa salama kwenye Firestore.'
                        }
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h6 className={`font-bold font-sans ${theme === 'high-contrast' ? 'text-slate-900' : 'text-white'}`}>
                        3. {language === 'en' ? 'No Commercial Share' : 'Hakuna Kushiriki kwa Biashara'}
                      </h6>
                      <p>
                        {language === 'en'
                          ? 'Your private analytics, wager logs, and email handles are never shared with or sold to third-party commercial marketing platforms. All profile data is handled with maximum privacy standards.'
                          : 'Uchambuzi wako wa kibinafsi, kumbukumbu za dau, na barua pepe hazishirikiwi kamwe au kuuzwa kwa jukwaa lolote la uuzaji wa kibiashara la upande wa tatu. Data zote zinashughulikiwa kwa siri kuu.'
                        }
                      </p>
                    </div>
                  </>
                )}

                {showLegalModal === 'cookies' && (
                  <>
                    <div className="space-y-1.5">
                      <h6 className={`font-bold font-sans ${theme === 'high-contrast' ? 'text-slate-900' : 'text-white'}`}>
                        1. {language === 'en' ? 'Essential Local Storage Usage' : 'Matumizi Muhimu ya Hifadhi ya Ndani'}
                      </h6>
                      <p>
                        {language === 'en'
                          ? 'Rafiki Predict does not use invasive tracker cookies. We utilize standard client-side LocalStorage to preserve your user configurations, visual theme choice, and Swahili/English language selections.'
                          : 'Rafiki Predict haitumii kuki vamizi za ufuatiliaji. Tunatumia LocalStorage ya kawaida ya kivinjari ili kuhifadhi usanidi wako, chaguo la mandhari ya kuona, na uteuzi wa lugha ya Kiswahili/Kiingereza.'
                        }
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h6 className={`font-bold font-sans ${theme === 'high-contrast' ? 'text-slate-900' : 'text-white'}`}>
                        2. {language === 'en' ? 'Offline Data Cache' : 'Data za Akiba Nje ya Mtandao'}
                      </h6>
                      <p>
                        {language === 'en'
                          ? 'We cache active analytical forecast models locally. This allows you to review sports accumulators and stats securely even during poor cellular network coverage or complete offline status.'
                          : 'Tunahifadhi mifumo ya utabiri ya uchambuzi kwenye kifaa chako. Hii inakuruhusu kukagua majamvi na takwimu za michezo kwa usalama hata wakati wa mtandao dhaifu au ukiwa nje ya mtandao.'
                        }
                      </p>
                    </div>

                    <div className="space-y-3 pt-3">
                      <button
                        onClick={() => setShowLegalModal(null)}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-bold py-2 rounded-xl text-xs transition-all cursor-pointer text-center"
                      >
                        {language === 'en' ? 'Accept All Preferences' : 'Kubali Mapendeleo Yote'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className={`border-t pt-4 flex justify-end ${theme === 'high-contrast' ? 'border-slate-100' : 'border-zinc-800'}`}>
                <button
                  onClick={() => setShowLegalModal(null)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-black px-6 py-2.5 rounded-2xl text-xs transition-all cursor-pointer transform active:scale-95"
                >
                  {language === 'en' ? 'Close Dialog' : 'Funga Dirisha'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
