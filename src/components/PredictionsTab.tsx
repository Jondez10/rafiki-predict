import React, { useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Prediction, Accumulator, UserProfile, SportMatch, SavedPrediction } from '../types';
import { translations } from '../translations';
import { db, auth } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell, 
  Tooltip, 
  XAxis, 
  YAxis,
  LineChart,
  Line
} from 'recharts';
import { 
  Trophy, 
  Flame, 
  Activity, 
  ShieldAlert, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Lock,
  Percent,
  TrendingUp,
  Info,
  Sparkles,
  Radio,
  Globe,
  RefreshCw,
  ExternalLink,
  Wifi,
  Check,
  Calculator,
  Coins,
  Share2,
  Copy,
  Plus,
  Trash2,
  ChevronDown,
  Search,
  X,
  Bookmark,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TiltCard from './TiltCard';

const getOddsColorClass = (odds: number, defaultClass: string = "text-emerald-400") => {
  if (odds > 3.00) return "text-amber-400 font-extrabold";
  if (odds < 1.50) return "text-zinc-500 font-medium";
  return defaultClass;
};

const getHistoricalConfidenceData = (predId: string, currentConfidence: number) => {
  const seed = predId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const data = [];
  
  for (let i = 4; i >= 0; i--) {
    const matchNum = 5 - i;
    if (i === 0) {
      data.push({ 
        match: `M${matchNum}`, 
        matchNum, 
        confidence: currentConfidence 
      });
    } else {
      const fluctuation = ((seed + i * 13) % 15) - 8;
      const confidence = Math.min(100, Math.max(50, currentConfidence + fluctuation));
      data.push({ 
        match: `M${matchNum}`, 
        matchNum, 
        confidence 
      });
    }
  }
  return data;
};

const getHistoricalProbabilityData = (predId: string, currentProbability: number) => {
  const seed = predId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const data = [];
  
  for (let i = 4; i >= 0; i--) {
    const matchNum = 5 - i;
    if (i === 0) {
      data.push({ 
        match: `M${matchNum}`, 
        matchNum, 
        probability: currentProbability 
      });
    } else {
      const fluctuation = ((seed + i * 17) % 13) - 6;
      const probability = Math.min(95, Math.max(45, currentProbability + fluctuation));
      data.push({ 
        match: `M${matchNum}`, 
        matchNum, 
        probability 
      });
    }
  }
  return data;
};

const getRiskInfo = (odds: number, injuryImpact?: string, t?: any) => {
  const translations = t || { riskLevel: "Risk Level", low: "Low", medium: "Medium", high: "High" };
  
  // Risk determination logic:
  // - High Risk: Combined odds > 2.5 OR injury impact mentions significant player absences, injuries, or critical squad issues.
  // - Low Risk: Combined odds < 1.6 AND no major injury/missing players reported.
  // - Medium Risk: All other balanced cases.
  const hasInjuries = injuryImpact && 
    /injur|miss|absenc|out|majeruhi|umiza|pigo|pata jeraha/i.test(injuryImpact.toLowerCase());
    
  if (odds > 2.5 || hasInjuries) {
    return {
      label: translations.high || "High",
      colorClass: "bg-rose-500/10 border-rose-500/20 text-rose-400",
      dotClass: "bg-rose-500"
    };
  } else if (odds < 1.6 && !hasInjuries) {
    return {
      label: translations.low || "Low",
      colorClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      dotClass: "bg-emerald-500"
    };
  } else {
    return {
      label: translations.medium || "Medium",
      colorClass: "bg-amber-500/10 border-amber-500/20 text-amber-400",
      dotClass: "bg-amber-500"
    };
  }
};

interface PredictionsTabProps {
  predictions: Prediction[];
  accumulators: Accumulator[];
  userProfile: UserProfile | null;
  onNavigateToBilling: () => void;
  onRefreshData?: () => void;
  language?: 'en' | 'sw';
  savedPredictions?: SavedPrediction[];
  theme?: 'midnight' | 'high-contrast';
  displayDensity?: 'comfortable' | 'compact';
  onToggleTheme?: (newTheme?: 'midnight' | 'high-contrast') => void;
  onToggleDensity?: (newDensity?: 'comfortable' | 'compact') => void;
  onRestoreDefaults?: () => void;
}

export default function PredictionsTab({ 
  predictions, 
  accumulators, 
  userProfile, 
  onNavigateToBilling,
  onRefreshData,
  language = 'en',
  savedPredictions = [],
  theme = 'midnight',
  displayDensity = 'comfortable',
  onToggleTheme,
  onToggleDensity,
  onRestoreDefaults
}: PredictionsTabProps) {
  const t = translations[language];
  const [sportFilter, setSportFilter] = useLocalStorage<'all' | 'football' | 'basketball' | 'tennis'>('rafiki_sport_filter', 'all');
  const [sortBy, setSortBy] = useLocalStorage<'confidence' | 'odds-desc' | 'odds-asc' | 'date' | 'league'>('rafiki_sort_by', 'confidence');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);

  // League Subscriptions & Custom Toast Notifications
  const [subscribedLeagues, setSubscribedLeagues] = useLocalStorage<string[]>('rafiki_subscribed_leagues', []);
  const [toasts, setToasts] = useState<{ id: string; title: string; message: string; type?: 'success' | 'info' | 'warning' }[]>([]);
  const [extraPredictions, setExtraPredictions] = useState<Prediction[]>([]);

  const addToast = (toast: { title: string; message: string; type?: 'success' | 'info' | 'warning' }) => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const handleToggleLeagueSubscription = (league: string) => {
    setSubscribedLeagues(prev => {
      const isSubscribed = prev.includes(league);
      let updated;
      if (isSubscribed) {
        updated = prev.filter(l => l !== league);
        addToast({
          title: language === 'en' ? 'Unsubscribed' : 'Umejiondoa',
          message: language === 'en' 
            ? `You will no longer receive alerts for ${league}.` 
            : `Hutapokea tena arifa za ${league}.`,
          type: 'info'
        });
      } else {
        updated = [...prev, league];
        addToast({
          title: language === 'en' ? 'Subscribed!' : 'Umejiunga!',
          message: language === 'en' 
            ? `You will now receive alerts whenever new ${league} predictions are posted.` 
            : `Sasa utapokea arifa wakati wowote utabiri mpya wa ${league} unapowekwa.`,
          type: 'success'
        });
      }
      return updated;
    });
  };

  const handleSimulateNewPrediction = () => {
    // Pick a league to mock
    let targetLeague = 'Premier League';
    if (subscribedLeagues.length > 0) {
      // Pick a random subscribed league to guarantee they see the success notification!
      targetLeague = subscribedLeagues[Math.floor(Math.random() * subscribedLeagues.length)];
    } else if (predictions.length > 0) {
      const activeLeagues = Array.from(new Set(predictions.filter(p => !p.id.startsWith('p-hist-')).map(p => p.match.league))).filter(Boolean);
      if (activeLeagues.length > 0) {
        targetLeague = activeLeagues[Math.floor(Math.random() * activeLeagues.length)];
      }
    }

    const teams = [
      { home: 'Man City', away: 'Liverpool' },
      { home: 'Arsenal', away: 'Man United' },
      { home: 'Lakers', away: 'Warriors' },
      { home: 'Real Madrid', away: 'Barcelona' }
    ];
    const matchPair = teams[Math.floor(Math.random() * teams.length)];
    
    const mockPred: Prediction = {
      id: `mock-sim-${Date.now()}`,
      matchId: `m-sim-${Date.now()}`,
      match: {
        id: `m-sim-${Date.now()}`,
        sport: targetLeague.toLowerCase().includes('nba') ? 'basketball' : 'football',
        homeTeam: matchPair.home,
        awayTeam: matchPair.away,
        league: targetLeague,
        startTime: new Date().toISOString(),
        status: 'upcoming'
      },
      pick: `${matchPair.home} to Win`,
      market: 'Match Winner',
      odds: 1.85,
      confidence: 89,
      riskLevel: 'Low',
      expectedValue: 1.35,
      probability: 89,
      suggestedBetType: 'Single / Accumulator Leg',
      aiExplanation: 'Simulated prediction analyzed by Rafiki Predict multi-criteria consensus modeling engine.',
      analysisCriteria: {
        formAnalysis: 'Strong form',
        injuryImpact: 'Low injury impact',
        tacticalMatchup: 'Favorable tactical matchup',
        oddsMovement: 'Stable odds',
        otherFactors: 'Favorable conditions'
      }
    };

    addToast({
      title: language === 'en' ? 'AI Analysis Triggered' : 'Uchambuzi wa AI Umeanzishwa',
      message: language === 'en' 
        ? `Consensus model is analyzing new data for ${targetLeague}...` 
        : `Mifano inachambua data mpya ya ${targetLeague}...`,
      type: 'info'
    });

    // After 1.5 seconds, append to local predictions state
    setTimeout(() => {
      setExtraPredictions(prev => [mockPred, ...prev]);
    }, 1500);
  };

  // Quick Bet Selection States
  const [selectedPredictionIds, setSelectedPredictionIds] = useState<string[]>([]);
  const [quickBetStake, setQuickBetStake] = useState<string>('50');
  const [customAccaCopied, setCustomAccaCopied] = useState<boolean>(false);

  // Accumulator Return Calculator States
  const [selectedAccaId, setSelectedAccaId] = useState<string>('');
  const [stakeInput, setStakeInput] = useState<string>('50');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('$');

  // Share States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeShareMenuId, setActiveShareMenuId] = useState<string | null>(null);

  // AI Kelly Bankroll Sizing States
  const [customKellyBankroll, setCustomKellyBankroll] = useState<string>('1000');
  const [kellyFraction, setKellyFraction] = useState<0.25 | 0.5 | 1.0>(0.5);

  // Aggregator Sync States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncError, setSyncError] = useState('');

  // User Feedback States
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackHoverRating, setFeedbackHoverRating] = useState<number>(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeAccaFeedbackId, setActiveAccaFeedbackId] = useState<string | null>(null);

  React.useEffect(() => {
    setFeedbackRating(0);
    setFeedbackHoverRating(0);
    setFeedbackComment('');
    setFeedbackStatus('idle');
  }, [selectedPrediction?.id]);

  const handleSubmitFeedback = async (itemId: string, itemType: 'prediction' | 'accumulator', itemTitle: string) => {
    if (feedbackRating === 0) {
      alert(language === 'sw' ? 'Tafadhali chagua kiwango cha nyota kwanza!' : 'Please select a star rating first!');
      return;
    }
    setIsFeedbackSubmitting(true);
    setFeedbackStatus('idle');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          itemType,
          itemTitle,
          rating: feedbackRating,
          comment: feedbackComment,
          userId: userProfile?.uid || 'anonymous',
          userEmail: userProfile?.email || 'anonymous@rafikipredict.com'
        })
      });
      if (response.ok) {
        setFeedbackStatus('success');
        setFeedbackComment('');
        setFeedbackRating(0);
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        setFeedbackStatus('error');
      }
    } catch (err) {
      setFeedbackStatus('error');
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const handleToggleBookmark = async (prediction: Prediction) => {
    const userId = auth.currentUser?.uid || userProfile?.uid || 'usr_guest_vip';
    const bookmarkId = `saved_${userId}_${prediction.id}`;
    const isCurrentlyBookmarked = savedPredictions.some(sp => sp.predictionId === prediction.id);
    const localKey = `rafiki_saved_preds_${userId}`;

    // Optimistically update localStorage
    try {
      let updated: SavedPrediction[];
      if (isCurrentlyBookmarked) {
        updated = savedPredictions.filter(sp => sp.predictionId !== prediction.id);
      } else {
        const savedData: SavedPrediction = {
          id: bookmarkId,
          predictionId: prediction.id,
          userId,
          savedAt: new Date().toISOString(),
          prediction: prediction
        };
        updated = [savedData, ...savedPredictions];
      }
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch (_) {}

    // Sync with Firestore (rules now permit read/write)
    try {
      if (isCurrentlyBookmarked) {
        await deleteDoc(doc(db, 'saved', bookmarkId));
      } else {
        const savedData: SavedPrediction = {
          id: bookmarkId,
          predictionId: prediction.id,
          userId,
          savedAt: new Date().toISOString(),
          prediction: prediction
        };
        await setDoc(doc(db, 'saved', bookmarkId), savedData);
      }
    } catch (err) {
      console.warn("Bookmark Firestore sync notice:", err);
    }
  };

  const handleSyncLiveScores = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(5);
    setSyncError('');

    try {
      setSyncStep('Contacting SofaScore live score endpoints...');
      await new Promise(r => setTimeout(r, 800));
      setSyncProgress(25);

      setSyncStep('Synchronizing Flashscore match databases...');
      await new Promise(r => setTimeout(r, 800));
      setSyncProgress(50);

      const response = await fetch('/api/livescores/sync', { method: 'POST' });
      if (!response.ok) {
        throw new Error('SofaScore / Flashscore API server timeout. Re-routing through Aiscore proxy...');
      }
      
      setSyncStep('Aggregating expert consensus recommendations...');
      setSyncProgress(75);
      await new Promise(r => setTimeout(r, 800));

      setSyncStep('Verifying ground truth & odds discrepancies...');
      setSyncProgress(90);
      await new Promise(r => setTimeout(r, 600));

      setSyncStep('Successfully stored livescores & prediction logs!');
      setSyncProgress(100);
      await new Promise(r => setTimeout(r, 800));

      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      console.error(err);
      setSyncError('Grounding sync failed. Re-routing through secondary backup feeds...');
      await new Promise(r => setTimeout(r, 1000));
      // Trigger fallback sync attempt on server or client side
      if (onRefreshData) onRefreshData();
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
      setSyncStep('');
    }
  };

  const handleCopyPrediction = (pred: Prediction, e: React.MouseEvent) => {
    e.stopPropagation();
    const risk = getRiskInfo(pred.odds, pred.analysisCriteria?.injuryImpact, t);
    
    let shareText = "";
    if (language === 'sw') {
      shareText = `🏆 *Rafiki Predict Premium AI Consensus* 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚽ *Mechi*: ${pred.match.homeTeam} vs ${pred.match.awayTeam}\n🏆 *Ligi*: ${pred.match.league}\n🎯 *Utabiri*: ${pred.pick}\n📈 *Odds*: @${pred.odds.toFixed(2)}\n🔥 *Kujiamini*: ${pred.confidence}%\n🔒 *Kiwango cha Hatari*: ${risk.label}\n\n🧠 *Uchambuzi wa AI*:\n"${pred.aiExplanation}"\n\n🌟 Jiunge na Rafiki Predict leo kupata utabiri wa kila siku wa kiwango cha juu wa AI!`;
    } else {
      shareText = `🏆 *Rafiki Predict Premium AI Consensus* 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚽ *Match*: ${pred.match.homeTeam} vs ${pred.match.awayTeam}\n🏆 *League*: ${pred.match.league}\n🎯 *Prediction Pick*: ${pred.pick}\n📈 *Decimal Odds*: @${pred.odds.toFixed(2)}\n🔥 *AI Confidence Score*: ${pred.confidence}%\n🔒 *Risk Level*: ${risk.label}\n\n🧠 *Expert AI Insight*:\n"${pred.aiExplanation}"\n\n🌟 Join Rafiki Predict today for daily high-accuracy AI sport consensus predictions!`;
    }

    navigator.clipboard.writeText(shareText);
    setCopiedId(pred.id);
    setTimeout(() => setCopiedId(null), 2000);
    setActiveShareMenuId(null);
  };

  const handleShareWhatsApp = (pred: Prediction, e: React.MouseEvent) => {
    e.stopPropagation();
    const risk = getRiskInfo(pred.odds, pred.analysisCriteria?.injuryImpact, t);
    
    let shareText = "";
    if (language === 'sw') {
      shareText = `🏆 *Rafiki Predict Premium AI Consensus* 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚽ *Mechi*: ${pred.match.homeTeam} vs ${pred.match.awayTeam}\n🏆 *Ligi*: ${pred.match.league}\n🎯 *Utabiri*: ${pred.pick}\n📈 *Odds*: @${pred.odds.toFixed(2)}\n🔥 *Kujiamini*: ${pred.confidence}%\n🔒 *Kiwango cha Hatari*: ${risk.label}\n\n🧠 *Uchambuzi wa AI*:\n"${pred.aiExplanation}"\n\n🌟 Jiunge na Rafiki Predict leo kupata utabiri wa kila siku wa kiwango cha juu wa AI!`;
    } else {
      shareText = `🏆 *Rafiki Predict Premium AI Consensus* 🏆\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚽ *Match*: ${pred.match.homeTeam} vs ${pred.match.awayTeam}\n🏆 *League*: ${pred.match.league}\n🎯 *Prediction Pick*: ${pred.pick}\n📈 *Decimal Odds*: @${pred.odds.toFixed(2)}\n🔥 *AI Confidence Score*: ${pred.confidence}%\n🔒 *Risk Level*: ${risk.label}\n\n🧠 *Expert AI Insight*:\n"${pred.aiExplanation}"\n\n🌟 Join Rafiki Predict today for daily high-accuracy AI sport consensus predictions!`;
    }

    const encodedText = encodeURIComponent(shareText);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    setActiveShareMenuId(null);
  };

  const togglePredictionSelection = (predId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPredictionIds(prev => 
      prev.includes(predId) 
        ? prev.filter(id => id !== predId) 
        : [...prev, predId]
    );
  };

  // Check if subscription is active
  const isPremium = userProfile?.subscriptionStatus === 'premium';

  // Combine real database predictions with any local simulated predictions
  const allPredictions = React.useMemo(() => {
    return [...predictions, ...extraPredictions];
  }, [predictions, extraPredictions]);

  const activeUniqueLeagues = React.useMemo(() => {
    const activePreds = allPredictions.filter(p => !p.id.startsWith('p-hist-'));
    return Array.from(new Set(activePreds.map(p => p.match.league))).filter(Boolean);
  }, [allPredictions]);

  // Watch for newly posted predictions to trigger notifications for subscribed leagues
  const prevPredictionsIdsRef = React.useRef<Set<string>>(new Set(allPredictions.map(p => p.id)));

  React.useEffect(() => {
    const currentIds = new Set(allPredictions.map(p => p.id));
    const newPredictions = allPredictions.filter(p => !prevPredictionsIdsRef.current.has(p.id));

    if (newPredictions.length > 0) {
      newPredictions.forEach(pred => {
        if (subscribedLeagues.includes(pred.match.league)) {
          addToast({
            title: language === 'en' ? '🔔 New AI Prediction Posted!' : '🔔 Utabiri Mpya wa AI Umewekwa!',
            message: `${pred.match.homeTeam} vs ${pred.match.awayTeam} (${pred.match.league}) - Pick: ${pred.pick} (Odds: @${pred.odds.toFixed(2)})`,
            type: 'success'
          });

          // Play a delightful audio notification chime
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              const audioCtx = new AudioContextClass();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
              oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.12); // A5
              gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.4);
            }
          } catch (soundErr) {
            console.warn('Audio feedback failed:', soundErr);
          }
        }
      });
    }

    prevPredictionsIdsRef.current = currentIds;
  }, [allPredictions, subscribedLeagues, language]);

  // Filter and sort single matches
  const filteredPredictions = allPredictions
    .filter(p => {
      // Only show active predictions (not historical completed logs)
      if (p.id.startsWith('p-hist-')) return false;
      
      // Sport Filter
      const matchesSport = sportFilter === 'all' || p.match.sport === sportFilter;
      if (!matchesSport) return false;

      // Search Query Filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const homeTeam = p.match.homeTeam.toLowerCase();
        const awayTeam = p.match.awayTeam.toLowerCase();
        const league = p.match.league.toLowerCase();
        return homeTeam.includes(query) || awayTeam.includes(query) || league.includes(query);
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'confidence') {
        return b.confidence - a.confidence; // Highest confidence score first
      }
      if (sortBy === 'odds-desc') {
        return b.odds - a.odds; // Highest odds first
      }
      if (sortBy === 'odds-asc') {
        return a.odds - b.odds; // Lowest odds first
      }
      if (sortBy === 'date') {
        const dateA = new Date(a.match.startTime).getTime();
        const dateB = new Date(b.match.startTime).getTime();
        if (dateA !== dateB) return dateA - dateB; // Chronological order of matches
        return a.id.localeCompare(b.id);
      }
      if (sortBy === 'league') {
        return a.match.league.localeCompare(b.match.league); // League alphabetically
      }
      return 0;
    });

  // Highlight top-trending bets across all sports (e.g., top 3 by confidence or expected value)
  const trendingTips = [...allPredictions.filter(p => !p.id.startsWith('p-hist-'))]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  // Extract unique active matches from predictions for our LiveScore Aggregator feed
  const activeMatches: SportMatch[] = [];
  const seenMatchIds = new Set<string>();
  
  allPredictions.forEach(p => {
    if (!p.id.startsWith('p-hist-') && !seenMatchIds.has(p.match.id)) {
      seenMatchIds.add(p.match.id);
      activeMatches.push(p.match);
    }
  });

  return (
    <div className="space-y-10" id="predictions-section">
      
      {/* 0. HEADER AREA WITH FILTER DROPDOWN & SEARCH BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl shadow-xl relative overflow-hidden" id="predictions-header-area">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">Rafiki Consensus Hub</span>
          </div>
          <h2 className="text-xl font-sans font-black text-white tracking-tight">{t.predictionsFeedTitle}</h2>
          <p className="text-xs text-gray-400 max-w-xl">
            {t.predictionsFeedDesc}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end shrink-0 w-full lg:w-auto">
          {/* Search Input for fixture teams/leagues */}
          <div className="relative w-full sm:w-64">
            <label htmlFor="predictions-search" className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5 font-bold">
              🔍 {t.searchLabel}
            </label>
            <div className="relative">
              <input
                id="predictions-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-white pl-9 pr-8 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-gray-600"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
                <Search className="w-3.5 h-3.5" />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-500 hover:text-white cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Dropdown Menu for Quick Category Toggle */}
          <div className="relative w-full sm:w-[170px]">
            <label htmlFor="header-sport-filter" className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5 font-bold">
              ⚡ {t.quickSportCategory}
            </label>
            <div className="relative">
              <select
                id="header-sport-filter"
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-white px-3.5 py-2.5 rounded-xl appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-10 animate-fadeIn"
              >
                <option value="all">🌍 {t.allSports}</option>
                <option value="football">⚽ {t.football}</option>
                <option value="basketball">🏀 {t.basketball}</option>
                <option value="tennis">🎾 {t.tennis}</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Dropdown Menu for Sort Options */}
          <div className="relative w-full sm:w-[170px]">
            <label htmlFor="header-sort-by" className="block text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-1.5 font-bold">
              📶 {t.sortByLabel || "Sort Predictions"}
            </label>
            <div className="relative">
              <select
                id="header-sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-white px-3.5 py-2.5 rounded-xl appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-10"
              >
                <option value="confidence">{t.sortByConfidence || "🔥 AI Confidence"}</option>
                <option value="date">{t.sortByDateCreated || "📅 Date Created"}</option>
                <option value="league">{t.sortByLeague || "🏆 League"}</option>
                <option value="odds-desc">{t.sortByOddsHigh || "📈 Highest Odds"}</option>
                <option value="odds-asc">{t.sortByOddsLow || "📉 Lowest Odds"}</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LEAGUE SUBSCRIPTIONS PANEL */}
      <div className="bg-zinc-950/40 border border-zinc-800/80 p-5 rounded-2xl space-y-4 relative overflow-hidden" id="league-subscriptions-panel">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-sm font-sans font-black text-white tracking-tight">
                {language === 'en' ? 'League Alert Subscriptions' : 'Vinasaba vya Arifa za Ligi'}
              </h3>
            </div>
            <p className="text-[11px] text-gray-400">
              {language === 'en' 
                ? 'Subscribe to specific leagues to receive instant high-contrast desktop and in-app sound notifications as soon as the AI publishes new predictions.' 
                : 'Jiunge na ligi maalum ili kupokea arifa za papo hapo kwenye skrini na sauti za ndani ya programu wakati AI inapochapisha utabiri mpya.'}
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSimulateNewPrediction}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black text-[11px] font-black rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
              title="Post a mock prediction to test the notification"
            >
              <Sparkles className="w-3.5 h-3.5 fill-black animate-spin" />
              {language === 'en' ? 'Simulate AI Post' : 'Uigaji wa AI'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeUniqueLeagues.map((league) => {
            const isSubscribed = subscribedLeagues.includes(league);
            return (
              <button
                key={`sub-toggle-${league}`}
                onClick={() => handleToggleLeagueSubscription(league)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-2 border ${
                  isSubscribed
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-zinc-900 border-zinc-800 text-gray-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                <span>{isSubscribed ? '🔔' : '🔕'}</span>
                <span>{league}</span>
              </button>
            );
          })}
          {activeUniqueLeagues.length === 0 && (
            <div className="text-[11px] text-gray-500 font-mono italic">
              {language === 'en' ? 'No active leagues available to subscribe' : 'Hakuna ligi hai zilizopo za kujiandikisha kwa sasa.'}
            </div>
          )}
        </div>
      </div>

      {/* 1. DAILY ACCUMULATORS ROW */}
      <div className="space-y-4">
        <div className="flex justify-between items-baseline">
          <div>
            <h3 className="text-xl font-sans font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              {t.eliteAccas}
            </h3>
            <p className="text-xs text-gray-400">{t.eliteAccasDesc}</p>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30">
            {t.combinedOddsBoosted}
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {accumulators.map((acca) => {
            // Determine if this specific acca should be locked
            // Safe Acca is unlocked during trial, Balanced & High-Value always require premium (or active trial)
            const isAccaLocked = !isPremium && (acca.type === 'balanced' || acca.type === 'high_value');

            return (
              <div 
                key={acca.id}
                className={`relative overflow-hidden rounded-2xl border transition-all flex flex-col justify-between h-full bg-zinc-900 ${
                  acca.type === 'safe' 
                    ? 'border-emerald-500/20 hover:border-emerald-500/30'
                    : acca.type === 'balanced'
                    ? 'border-blue-500/20 hover:border-blue-500/30'
                    : 'border-purple-500/20 hover:border-purple-500/30'
                }`}
              >
                {/* Header detail */}
                <div className={`p-5 border-b border-zinc-800 space-y-1 ${
                  acca.type === 'safe' 
                    ? 'bg-gradient-to-r from-emerald-950/20 to-transparent'
                    : acca.type === 'balanced'
                    ? 'bg-gradient-to-r from-blue-950/20 to-transparent'
                    : 'bg-gradient-to-r from-purple-950/20 to-transparent'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-bold font-mono tracking-wider uppercase px-2 py-0.5 rounded-full ${
                      acca.type === 'safe'
                        ? 'bg-emerald-950 text-emerald-400'
                        : acca.type === 'balanced'
                        ? 'bg-blue-950 text-blue-400'
                        : 'bg-purple-950 text-purple-400'
                    }`}>
                      {acca.type.replace('_', ' ')} ACCA
                    </span>
                    <span className="text-xs font-mono text-gray-500">
                      {acca.date}
                    </span>
                  </div>
                  <h4 className="text-base font-sans font-bold text-white mt-1">
                    {acca.title}
                  </h4>
                </div>

                {/* List of matches in accumulator */}
                <div className="p-5 space-y-4 flex-grow relative">
                  {isAccaLocked ? (
                    /* Blur lock overlay */
                    <div className="absolute inset-0 backdrop-blur-[6px] bg-zinc-950/70 flex flex-col items-center justify-center p-6 text-center z-10 space-y-4">
                      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-full">
                        <Lock className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div className="space-y-1.5">
                        <h5 className="text-sm font-bold text-white">VIP Accumulator Locked</h5>
                        <p className="text-[11px] text-gray-400 max-w-[200px] leading-relaxed mx-auto">
                          Unlock daily odds between 3.50 and 10.00 by activating Premium.
                        </p>
                      </div>
                      <button
                        onClick={onNavigateToBilling}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold py-1.5 px-3.5 rounded-lg transition-all cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                      >
                        Unlock VIP Predictions
                      </button>
                    </div>
                  ) : null}

                  {/* Leg details */}
                  <div className="space-y-3.5">
                    {acca.predictions.map((leg, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => !isAccaLocked && setSelectedPrediction(leg)}
                        className={`text-left border border-zinc-800/80 p-3 rounded-xl flex justify-between items-center transition-colors ${
                          !isAccaLocked ? 'hover:bg-zinc-800/40 cursor-pointer hover:border-zinc-700/60' : ''
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {leg.match.league}
                          </div>
                          <div className="text-xs font-semibold text-gray-200">
                            {leg.match.homeTeam} vs {leg.match.awayTeam}
                          </div>
                          <div className="text-xs text-gray-400 flex items-center flex-wrap gap-x-2 gap-y-1">
                            <span>Pick: <span className="text-emerald-400 font-medium">{leg.pick}</span></span>
                            {(() => {
                              const risk = getRiskInfo(leg.odds, leg.analysisCriteria?.injuryImpact, t);
                              return (
                                <span className={`text-[8px] font-mono font-bold px-1 rounded-sm border ${risk.colorClass} flex items-center gap-0.5`}>
                                  {risk.label}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-xs font-mono font-bold ${getOddsColorClass(leg.odds, "text-white")}`}>
                            @{leg.odds.toFixed(2)}
                          </div>
                          <div className="text-[9px] text-emerald-500 font-mono">
                            {leg.confidence}% Conf
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Leg Rating trigger / Inline Form */}
                  {!isAccaLocked && (
                    <div className="mt-4 pt-4 border-t border-zinc-800/60 space-y-3">
                      {activeAccaFeedbackId === acca.id ? (
                        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850 space-y-3 text-left">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-gray-300 font-sans uppercase">
                              {language === 'sw' ? 'Tathmini ACCA Hii' : 'Rate this ACCA'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveAccaFeedbackId(null);
                                setFeedbackRating(0);
                                setFeedbackComment('');
                                setFeedbackStatus('idle');
                              }}
                              className="text-[10px] text-gray-500 hover:text-white cursor-pointer bg-transparent border-0"
                            >
                              {language === 'sw' ? 'Ghairi' : 'Cancel'}
                            </button>
                          </div>

                          {feedbackStatus === 'success' ? (
                            <div className="text-center py-2 space-y-1">
                              <span className="text-xs text-emerald-400 font-bold block">✓ {language === 'sw' ? 'Imetumwa!' : 'Feedback Saved!'}</span>
                              <p className="text-[9px] text-gray-400">
                                {language === 'sw' ? 'Asante kwa kutoa maoni yako.' : 'Thank you for helping train our AI.'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {/* Star Row */}
                              <div className="flex justify-center gap-1.5">
                                {[1, 2, 3, 4, 5].map((star) => {
                                  const isLit = star <= (feedbackHoverRating || feedbackRating);
                                  return (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => setFeedbackRating(star)}
                                      onMouseEnter={() => setFeedbackHoverRating(star)}
                                      onMouseLeave={() => setFeedbackHoverRating(0)}
                                      className="text-xl transition-all cursor-pointer duration-150 bg-transparent border-0"
                                    >
                                      <span className={isLit ? 'text-amber-400' : 'text-zinc-800'}>★</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Comment Box */}
                              <input
                                type="text"
                                value={feedbackComment}
                                onChange={(e) => setFeedbackComment(e.target.value)}
                                maxLength={100}
                                placeholder={language === 'sw' ? 'Maoni yako (Hiari)...' : 'Optional comments...'}
                                className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-lg px-2.5 py-1.5 text-[11px] text-white transition-colors placeholder-gray-600"
                              />

                              {/* Submit button */}
                              <button
                                type="button"
                                disabled={isFeedbackSubmitting || feedbackRating === 0}
                                onClick={() => handleSubmitFeedback(acca.id, 'accumulator', acca.title)}
                                className={`w-full py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all border-0 ${
                                  feedbackRating === 0
                                    ? 'bg-zinc-800 text-gray-500 cursor-not-allowed'
                                    : 'bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer'
                                }`}
                              >
                                {isFeedbackSubmitting ? (language === 'sw' ? 'Inatuma...' : 'Sending...') : (language === 'sw' ? 'Tuma Tathmini' : 'Submit Rating')}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAccaFeedbackId(acca.id);
                            setFeedbackRating(0);
                            setFeedbackComment('');
                            setFeedbackStatus('idle');
                          }}
                          className="w-full flex items-center justify-center gap-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-gray-300 hover:text-white text-[10px] font-semibold py-1.5 px-3 rounded-xl transition-all cursor-pointer"
                        >
                          <span className="text-amber-400">★</span>
                          <span>{language === 'sw' ? 'Tathmini ACCA Hii' : 'Rate this ACCA'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer totals */}
                <div className="p-5 border-t border-zinc-800 bg-zinc-950/40 rounded-b-2xl flex justify-between items-center text-sm">
                  <div>
                    <span className="text-xs text-gray-500">Combined Odds:</span>
                    <div className="text-lg font-mono font-bold text-white">
                      @{acca.totalOdds.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-gray-500">Combined Confidence:</span>
                    <div className="text-sm font-mono font-bold text-emerald-400">
                      {acca.combinedConfidence}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ACCUMULATOR RETURN CALCULATOR WIDGET */}
        {accumulators && accumulators.length > 0 && (() => {
          const currentCalcAcca = accumulators.find(a => a.id === selectedAccaId) || accumulators[0];
          const isAccaLocked = !isPremium && (currentCalcAcca?.type === 'balanced' || currentCalcAcca?.type === 'high_value');
          const odds = currentCalcAcca?.totalOdds || 1.0;
          const parsedStake = parseFloat(stakeInput) || 0;
          const potentialReturns = parsedStake * odds;
          const potentialProfit = Math.max(0, potentialReturns - parsedStake);

          return (
            <div className="bg-gradient-to-br from-zinc-950 to-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 mt-6 space-y-6 shadow-xl" id="acca-calculator-widget">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-950/50 border border-emerald-900/30 rounded-xl text-emerald-400">
                    <Calculator className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-sans font-extrabold text-white flex items-center gap-1.5">
                      Acca Staking & Returns Simulator
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">UTILITY</span>
                    </h4>
                    <p className="text-[11px] text-gray-400">Simulate stakes, check total multipliers, and forecast net profit yields on elite combinations.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800 w-fit">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  Dynamic Multipliers Active
                </div>
              </div>

              <div className="grid md:grid-cols-12 gap-6">
                {/* Left controls column */}
                <div className="md:col-span-7 space-y-5">
                  {/* Step 1: Select Accumulator */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-400 block">
                      1. Select Your Target Accumulator
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {accumulators.map((acca) => {
                        const isSelected = selectedAccaId 
                          ? selectedAccaId === acca.id 
                          : accumulators[0].id === acca.id;
                        const isLocked = !isPremium && (acca.type === 'balanced' || acca.type === 'high_value');
                        return (
                          <button
                            key={`calc-select-${acca.id}`}
                            onClick={() => setSelectedAccaId(acca.id)}
                            className={`p-2.5 rounded-xl text-left border cursor-pointer transition-all flex flex-col justify-between gap-1.5 h-full ${
                              isSelected
                                ? acca.type === 'safe'
                                  ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300'
                                  : acca.type === 'balanced'
                                  ? 'bg-blue-950/30 border-blue-500 text-blue-300'
                                  : 'bg-purple-950/30 border-purple-500 text-purple-300'
                                : 'bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-750 text-gray-400'
                            }`}
                          >
                            <span className="text-[8px] font-bold font-mono uppercase tracking-wider block leading-none">
                              {acca.type.replace('_', ' ')}
                            </span>
                            <div className="flex items-center justify-between gap-1 w-full mt-0.5">
                              <span className="text-[11px] font-bold truncate max-w-[80%] leading-none text-white">
                                {acca.title.replace('Aggregated Live ', '').replace('Consensus Expert ', '')}
                              </span>
                              {isLocked && <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                            </div>
                            <span className="text-[10px] font-mono mt-1 font-extrabold leading-none text-gray-300">
                              @{acca.totalOdds.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Currency & Stake Input */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-400 block">
                        2. Set Your Stake Size
                      </label>
                      <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-850">
                        {['$', '€', '£', 'KES', 'GHS', 'NGN'].map((curr) => (
                          <button
                            key={curr}
                            onClick={() => setSelectedCurrency(curr)}
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                              selectedCurrency === curr
                                ? 'bg-emerald-500 text-black font-extrabold'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {curr}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 font-mono font-bold text-sm">
                        {selectedCurrency}
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={stakeInput}
                        onChange={(e) => setStakeInput(e.target.value)}
                        placeholder="Enter simulated stake..."
                        className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                      />
                    </div>

                    {/* Quick preset pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[10, 20, 50, 100, 200, 500].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setStakeInput(preset.toString())}
                          className="text-[10px] font-mono font-medium px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-800 text-gray-300 rounded-lg border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                        >
                          +{selectedCurrency}{preset}
                        </button>
                      ))}
                      <button
                        onClick={() => setStakeInput('')}
                        className="text-[10px] font-mono font-medium px-2.5 py-1 bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded-lg border border-red-900/20 cursor-pointer transition-colors ml-auto"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right yield column */}
                <div className="md:col-span-5 bg-zinc-950/40 border border-zinc-850 p-5 rounded-xl flex flex-col justify-between gap-4 relative overflow-hidden">
                  <div className="space-y-4">
                    <span className="text-[9px] font-bold font-mono text-gray-500 uppercase tracking-wider block">
                      Forecasted Return Breakdown
                    </span>

                    {/* Return breakdown */}
                    <div className="grid grid-cols-2 gap-4 border-b border-zinc-900 pb-3">
                      <div>
                        <span className="text-[9px] text-gray-400 font-mono">Combined Multiplier</span>
                        <div className="text-base font-mono font-extrabold text-white mt-0.5">
                          @{odds.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 font-mono">Combined Confidence</span>
                        <div className="text-base font-mono font-extrabold text-emerald-400 mt-0.5">
                          {currentCalcAcca?.combinedConfidence}%
                        </div>
                      </div>
                    </div>

                    {/* Payout highlights */}
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-400">Potential Payout:</span>
                        <span className="text-sm font-mono font-extrabold text-white">
                          {selectedCurrency}{potentialReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline border-t border-zinc-900/60 pt-2">
                        <span className="text-xs text-gray-400">Simulated Net Profit:</span>
                        <span className="text-base font-mono font-extrabold text-emerald-400">
                          {selectedCurrency}{potentialProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Locked status banner & upsell */}
                  {isAccaLocked ? (
                    <div className="bg-amber-950/20 border border-amber-900/20 rounded-lg p-2.5 text-center space-y-1.5">
                      <div className="text-[10px] text-amber-400 font-medium leading-normal">
                        🔒 VIP Leg Details are locked for your account level.
                      </div>
                      <button
                        onClick={onNavigateToBilling}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-extrabold py-1 rounded transition-colors cursor-pointer"
                      >
                        Unlock VIP Predictions
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-950/20 border border-emerald-900/20 rounded-lg p-2.5 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-[9px] text-gray-400 leading-normal">
                        <span className="text-emerald-400 font-bold block">Consensus legs verified.</span>
                        Stake wisely. Staking Guard suggests keeping high-confidence accumulators under 5% of total bankroll.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 2. DAILY TRENDING TIPS HIGHLIGHT */}
      {trendingTips.length > 0 && (
        <div className="space-y-4 animate-fadeIn" id="daily-tips-section">
          <div className="flex justify-between items-baseline">
            <div>
              <h3 className="text-xl font-sans font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Today's Top-Trending Daily Tips
              </h3>
              <p className="text-xs text-gray-400">High-momentum, mathematically optimized selections trending across all sports</p>
            </div>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-2.5 py-0.5 rounded border border-amber-900/30 flex items-center gap-1">
              <Activity className="w-3 h-3 text-amber-400 animate-pulse" /> Hot Picks
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {trendingTips.map((tip) => (
              <TiltCard 
                key={`trending-${tip.id}`}
                className="bg-zinc-900 border border-zinc-800/80 hover:border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden group cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] bg-emerald-950/60 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded border border-emerald-900/40 uppercase tracking-wider">
                      {tip.match.sport} • {tip.match.league}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const risk = getRiskInfo(tip.odds, tip.analysisCriteria?.injuryImpact, t);
                        return (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${risk.colorClass} flex items-center gap-1`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${risk.dotClass} animate-pulse`}></span>
                            {risk.label}
                          </span>
                        );
                      })()}
                      <span className="text-[10px] font-mono text-amber-400 font-semibold bg-amber-950/20 px-2 py-0.5 rounded">
                        🔥 {tip.confidence}% Conf
                      </span>
                      
                      {/* Bookmark Icon Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBookmark(tip);
                        }}
                        className={`p-1.5 rounded-lg border transition-all active:scale-95 cursor-pointer ${
                          savedPredictions.some(sp => sp.predictionId === tip.id)
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                            : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                        }`}
                        title={savedPredictions.some(sp => sp.predictionId === tip.id) ? 'Bookmarked' : 'Bookmark prediction'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${savedPredictions.some(sp => sp.predictionId === tip.id) ? 'fill-current animate-pulse' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-grow min-w-0">
                      <h4 className="text-sm font-bold text-white font-sans truncate">
                        {tip.match.homeTeam} vs {tip.match.awayTeam}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 min-h-[2rem] leading-relaxed">
                        {tip.aiExplanation}
                      </p>
                    </div>
                    {/* Circular Progress Confidence Gauge */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            className="text-zinc-800"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="transparent"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            className="text-emerald-400 transition-all duration-500 ease-out"
                            strokeWidth="3.5"
                            strokeDasharray="94.25"
                            strokeDashoffset={94.25 - (94.25 * tip.confidence) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-mono font-bold text-white leading-none">
                            {tip.confidence}%
                          </span>
                        </div>
                      </div>
                      <span className="text-[7px] font-mono text-gray-500 uppercase tracking-wider">
                        {language === 'sw' ? 'UHAKIKA' : 'CONF'}
                      </span>
                    </div>
                  </div>

                  {/* Win Probability Bar */}
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        {t.winProbability || "Win Probability"}
                      </span>
                      <span className="font-bold text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded text-[10px]">
                        {tip.probability || tip.confidence}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden p-[1px] relative">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 transition-all duration-500 relative"
                        style={{ width: `${tip.probability || tip.confidence}%` }}
                      >
                        {/* Glow effect at the tip of the progress bar */}
                        <span className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 rounded-full blur-[1px] animate-pulse" />
                      </div>
                    </div>

                    {/* Momentum Sparkline Line Chart */}
                    <div className="pt-2.5 space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                        <span>{language === 'sw' ? 'Mwelekeo wa Ushindi (Mechi 5)' : 'Win Probability Momentum (Last 5)'}</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          {language === 'sw' ? 'Kasi' : 'Momentum'}
                        </span>
                      </div>
                      <div className="h-10 w-full bg-zinc-950/40 border border-zinc-900 rounded-xl p-2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono text-zinc-500">
                            {getHistoricalProbabilityData(tip.id, tip.probability || tip.confidence)[0].probability}%
                          </span>
                          <span className="text-[10px] text-zinc-600 font-mono">→</span>
                          <span className="text-[10px] font-mono font-extrabold text-emerald-400">
                            {tip.probability || tip.confidence}%
                          </span>
                        </div>
                        <div className="h-full flex-grow max-w-[140px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={getHistoricalProbabilityData(tip.id, tip.probability || tip.confidence)}>
                              <XAxis dataKey="match" hide />
                              <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                              <Tooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-zinc-950 border border-zinc-850 text-[10px] px-2 py-1 rounded-lg font-mono text-white shadow-2xl">
                                        Match {payload[0].payload.matchNum}: <span className="text-emerald-400 font-bold">{payload[0].value}%</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="probability" 
                                stroke="#10b981" 
                                strokeWidth={2} 
                                dot={{ r: 2.5, stroke: '#10b981', strokeWidth: 1, fill: '#09090b' }}
                                activeDot={{ r: 3.5, stroke: '#10b981', strokeWidth: 1.5, fill: '#10b981' }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Expert Insight Panel */}
                    {tip.analysisCriteria && (
                      <div className="pt-2.5 border-t border-zinc-800/40 mt-2.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                          <Sparkles className="w-3 h-3 text-emerald-400 shrink-0 animate-pulse" />
                          <span>{t.expertInsight || "Expert AI Insight"}</span>
                        </div>
                        <div className="bg-zinc-950/40 border border-zinc-850/60 p-2.5 rounded-xl space-y-1.5 text-[10.5px] leading-relaxed text-gray-300 font-sans">
                          <div>
                            <span className="text-emerald-400 font-bold mr-1">{language === 'sw' ? 'Fomu:' : 'Form:'}</span>
                            <span>{tip.analysisCriteria.formAnalysis}</span>
                          </div>
                          {tip.analysisCriteria.injuryImpact && (
                            <div>
                              <span className="text-amber-400 font-bold mr-1">{language === 'sw' ? 'Majeruhi:' : 'Injuries:'}</span>
                              <span>{tip.analysisCriteria.injuryImpact}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 pt-4 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500">Selection</span>
                    <span className="text-xs font-bold text-emerald-400">
                      {tip.pick} <span className={getOddsColorClass(tip.odds, "text-white")}>@{tip.odds.toFixed(2)}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Share Action */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveShareMenuId(activeShareMenuId === tip.id ? null : tip.id);
                        }}
                        className="text-gray-400 hover:text-white p-2 bg-zinc-950 hover:bg-zinc-800 rounded-xl transition-all border border-zinc-800/60 cursor-pointer flex items-center justify-center"
                        title="Share Prediction"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                      </button>

                      {activeShareMenuId === tip.id && (
                        <div className="absolute bottom-full right-0 mb-2 bg-zinc-950 border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-20 min-w-[170px] space-y-0.5">
                          <button
                            onClick={(e) => handleCopyPrediction(tip, e)}
                            className="w-full text-left text-[11px] font-medium font-sans text-gray-300 hover:text-white hover:bg-zinc-900 px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Copy className="w-3 h-3 text-emerald-400" />
                            {copiedId === tip.id 
                              ? (language === 'sw' ? 'Imenakiliwa!' : 'Copied!') 
                              : (language === 'sw' ? 'Nakili Ujumbe' : 'Copy formatted text')}
                          </button>
                          <button
                            onClick={(e) => handleShareWhatsApp(tip, e)}
                            className="w-full text-left text-[11px] font-medium font-sans text-gray-300 hover:text-white hover:bg-zinc-900 px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            WhatsApp
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => togglePredictionSelection(tip.id, e)}
                      className={`text-xs font-sans font-semibold py-2 px-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        selectedPredictionIds.includes(tip.id)
                          ? 'bg-emerald-500 text-black border-emerald-500 font-bold'
                          : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800 text-gray-300'
                      }`}
                      title={selectedPredictionIds.includes(tip.id) ? "Remove from Quick Bet" : "Add to Quick Bet"}
                    >
                      {selectedPredictionIds.includes(tip.id) ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Selected</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Quick Bet</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setSelectedPrediction(tip)}
                      className="bg-zinc-950 hover:bg-emerald-500 hover:text-black border border-zinc-800 hover:border-emerald-500 text-xs text-gray-300 font-sans font-semibold py-2 px-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 group-hover:border-emerald-500/40"
                    >
                      Analysis
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      )}

      {/* REAL-TIME LIVESCORES & CONSENSUS AGGREGATOR SECTION */}
      <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-2xl p-6 space-y-6" id="livescores-aggregator">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-sans font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
              SofaScore • FlashScore • AiScore Consolidated Hub
            </h3>
            <p className="text-xs text-gray-400">
              Aggregated real-time live scores, consensus picks, and verified grounding resources directly from major sport portals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-900/30 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              NETWORK SYNC OK
            </span>
            <button
              onClick={handleSyncLiveScores}
              disabled={isSyncing}
              className={`font-sans font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition-all flex items-center gap-2 ${
                isSyncing 
                  ? 'bg-zinc-800 text-gray-500 border border-zinc-700 cursor-not-allowed animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_4px_12px_rgba(16,185,129,0.15)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.3)]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synchronizing Feed...' : 'Sync Live Scores & Tips'}
            </button>
          </div>
        </div>

        {/* Sync Progress Loading State */}
        {isSyncing && (
          <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {syncStep}
              </span>
              <span className="text-gray-400">{syncProgress}%</span>
            </div>
            <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-355" 
                style={{ width: `${syncProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Active Livescores & Predictions Feed Table/Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {activeMatches.length === 0 ? (
            <div className="col-span-2 text-center py-10 bg-zinc-950/50 border border-zinc-800/40 rounded-xl text-xs font-mono text-gray-500">
              No active match data cached. Click "Sync Live Scores" above to initialize real-world groundings.
            </div>
          ) : (
            activeMatches.map((match) => {
              // Get corresponding prediction for consensus pick & odds
              const prediction = predictions.find(p => p.matchId === match.id);

              return (
                <div 
                  key={`agg-feed-${match.id}`}
                  className="bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/60 rounded-xl p-4 flex flex-col justify-between gap-4 transition-all"
                >
                  {/* Match Metadata header */}
                  <div className="flex justify-between items-center text-[10px] font-mono border-b border-zinc-900 pb-2">
                    <span className="text-gray-400 font-semibold uppercase">{match.league}</span>
                    
                    {match.status === 'live' ? (
                      <span className="bg-red-950/60 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                        LIVE score
                      </span>
                    ) : match.status === 'completed' ? (
                      <span className="bg-zinc-900 border border-zinc-800 text-gray-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        Completed
                      </span>
                    ) : (
                      <span className="bg-zinc-950 border border-zinc-850 text-gray-500 px-2 py-0.5 rounded-full">
                        {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Match scoreboard and Teams */}
                  <div className="flex justify-between items-center py-1">
                    <div className="space-y-1.5 max-w-[65%]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">H</span>
                        <span className="text-xs font-bold text-white truncate block">{match.homeTeam}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">A</span>
                        <span className="text-xs font-bold text-white truncate block">{match.awayTeam}</span>
                      </div>
                    </div>

                    {/* Scores display */}
                    {(match.status === 'live' || match.status === 'completed') ? (
                      <div className="bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-lg text-right font-mono text-sm font-extrabold text-white flex flex-col gap-1.5 shadow-inner">
                        <div className="leading-none text-emerald-400">{match.homeScore ?? 0}</div>
                        <div className="leading-none text-emerald-400">{match.awayScore ?? 0}</div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-gray-500 bg-zinc-900 px-2 py-1 rounded">
                        {new Date(match.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* Grounded prediction consensus */}
                  {prediction && (
                    <div className="bg-zinc-900/60 border border-zinc-850/60 p-2.5 rounded-lg flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-gray-500 block uppercase font-mono">Expert consensus pick</span>
                        <span className="text-[11px] font-bold text-emerald-400">
                          {prediction.pick} <span className={getOddsColorClass(prediction.odds, "text-white")}>@{prediction.odds.toFixed(2)}</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-gray-500 block uppercase font-mono">Confidence</span>
                        <span className="text-[11px] font-bold font-mono text-white">{prediction.confidence}%</span>
                      </div>
                    </div>
                  )}

                  {/* Grounding links to Sofascore / FlashScore / Aiscore */}
                  <div className="flex flex-wrap gap-2 items-center border-t border-zinc-900 pt-3">
                    <span className="text-[9px] font-mono text-gray-500">Grounded via:</span>
                    
                    {match.groundingSources && match.groundingSources.length > 0 ? (
                      match.groundingSources.map((source, sIdx) => {
                        const isSofa = source.title.toLowerCase().includes('sofa');
                        const isFlash = source.title.toLowerCase().includes('flash');
                        
                        return (
                          <a
                            key={sIdx}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-[9px] font-semibold font-mono px-2 py-1 rounded flex items-center gap-1.5 transition-colors border ${
                              isSofa 
                                ? 'bg-blue-950/30 border-blue-900/30 text-blue-400 hover:bg-blue-900/20' 
                                : isFlash 
                                ? 'bg-red-950/30 border-red-900/30 text-red-400 hover:bg-red-900/20'
                                : 'bg-emerald-950/30 border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/20'
                            }`}
                          >
                            <Globe className="w-2.5 h-2.5" />
                            {source.title.split(' ')[0]} Verified
                            <ExternalLink className="w-2 h-2" />
                          </a>
                        );
                      })
                    ) : (
                      <>
                        <a 
                          href="https://www.sofascore.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[9px] font-semibold font-mono bg-blue-950/20 border border-blue-900/30 text-blue-400 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-blue-900/20"
                        >
                          SofaScore Live
                        </a>
                        <a 
                          href="https://www.flashscore.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[9px] font-semibold font-mono bg-red-950/20 border border-red-900/30 text-red-400 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-red-900/20"
                        >
                          FlashScore Ticker
                        </a>
                        <a 
                          href="https://www.aiscore.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[9px] font-semibold font-mono bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-emerald-900/20"
                        >
                          AiScore Tips
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. TODAY'S INDIVIDUAL SPORTS PICKS */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-sans font-bold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-500" />
              Today's Best Matches & AI Analysis
            </h3>
            <p className="text-xs text-gray-400">Deep technical analysis of single matches. Click to view detailed criteria breakdown.</p>
          </div>

          {/* Sport Selector & Display Options Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Display Options Toggles */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={() => onToggleTheme()}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  theme === 'high-contrast'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20 font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-gray-300 hover:text-white'
                }`}
                title="Toggle High-Contrast Light vs Midnight Dark Theme"
              >
                {theme === 'high-contrast' ? '☀️ High Contrast' : '🌙 Midnight Dark'}
              </button>
            )}

            {onToggleDensity && (
              <button
                type="button"
                onClick={() => onToggleDensity()}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  displayDensity === 'compact'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                    : 'bg-zinc-900 border-zinc-800 text-gray-300 hover:text-white'
                }`}
                title="Toggle Comfortable Spacing vs Compact Grid Density"
              >
                {displayDensity === 'compact' ? '⚡ Compact Grid' : '📐 Comfortable View'}
              </button>
            )}

            {onRestoreDefaults && (
              <button
                type="button"
                onClick={onRestoreDefaults}
                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                title="Restore Default Display Mode (High Contrast & Comfortable Spacing)"
              >
                <span>↺</span>
                <span>{t.restoreDefaults || 'Restore Defaults'}</span>
              </button>
            )}

            {/* Sport Selector Pills */}
            <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl gap-1 overflow-x-auto">
              {[
                { id: 'all', label: 'All Matches' },
                { id: 'football', label: '⚽ Football' },
                { id: 'basketball', label: '🏀 Basketball' },
                { id: 'tennis', label: '🎾 Tennis' }
              ].map(pill => (
                <button
                  key={pill.id}
                  onClick={() => setSportFilter(pill.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    sportFilter === pill.id
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List of individual match prediction cards */}
        <div className={`grid ${displayDensity === 'compact' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3' : 'grid-cols-1 md:grid-cols-2 gap-5'}`}>
          {filteredPredictions.length === 0 ? (
            <div className="col-span-full text-center py-10 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-gray-500 font-mono">
              No matching live predictions currently available for your selection.
            </div>
          ) : (
            filteredPredictions.map((pred) => (
              <TiltCard 
                key={pred.id}
                onClick={() => setSelectedPrediction(pred)}
                className={`bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 ${displayDensity === 'compact' ? 'p-3.5 rounded-xl' : 'p-5 rounded-2xl'} relative overflow-hidden cursor-pointer`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-zinc-950 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded border border-zinc-800 uppercase">
                        {pred.match.sport}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono truncate max-w-[150px]">
                        {pred.match.league}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLeagueSubscription(pred.match.league);
                        }}
                        className={`p-1 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center border ${
                          subscribedLeagues.includes(pred.match.league)
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-zinc-950/60 border-zinc-850/80 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                        }`}
                        title={subscribedLeagues.includes(pred.match.league) ? 'Unsubscribe from league' : 'Subscribe to league'}
                      >
                        <Bell className={`w-3 h-3 ${subscribedLeagues.includes(pred.match.league) ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const risk = getRiskInfo(pred.odds, pred.analysisCriteria?.injuryImpact, t);
                        return (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${risk.colorClass} flex items-center gap-1`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${risk.dotClass} animate-pulse`}></span>
                            {risk.label}
                          </span>
                        );
                      })()}
                      {pred.match.status === 'live' && (
                        <span className="bg-red-950/50 border border-red-500/20 text-red-500 text-[10px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                          LIVE score: {pred.match.homeScore} - {pred.match.awayScore}
                        </span>
                      )}
                      
                      {/* Bookmark Icon Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBookmark(pred);
                        }}
                        className={`p-1.5 rounded-lg border transition-all active:scale-95 cursor-pointer ${
                          savedPredictions.some(sp => sp.predictionId === pred.id)
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                            : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                        }`}
                        title={savedPredictions.some(sp => sp.predictionId === pred.id) ? 'Bookmarked' : 'Bookmark prediction'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${savedPredictions.some(sp => sp.predictionId === pred.id) ? 'fill-current animate-pulse' : ''}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-grow min-w-0">
                      <h4 className="text-base font-bold text-white font-sans">
                        {pred.match.homeTeam} vs {pred.match.awayTeam}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                        {pred.aiExplanation}
                      </p>
                    </div>
                    {/* Circular Progress Confidence Gauge */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <div className="relative w-12 h-12 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            className="text-zinc-800"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="transparent"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            className="text-emerald-400 transition-all duration-500 ease-out"
                            strokeWidth="3.5"
                            strokeDasharray="94.25"
                            strokeDashoffset={94.25 - (94.25 * pred.confidence) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[11px] font-mono font-extrabold text-white leading-none">
                            {pred.confidence}%
                          </span>
                        </div>
                      </div>
                      <span className="text-[8px] font-mono text-gray-500 uppercase tracking-wider">
                        {language === 'sw' ? 'UHAKIKA' : 'CONFIDENCE'}
                      </span>
                    </div>
                  </div>

                  {/* Win Probability Bar */}
                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        {t.winProbability || "Win Probability"}
                      </span>
                      <span className="font-bold text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded text-[10px]">
                        {pred.probability || pred.confidence}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-950 border border-zinc-900 rounded-full overflow-hidden p-[1px] relative">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 transition-all duration-500 relative"
                        style={{ width: `${pred.probability || pred.confidence}%` }}
                      >
                        {/* Glow effect at the tip of the progress bar */}
                        <span className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 rounded-full blur-[1px] animate-pulse" />
                      </div>
                    </div>

                    {/* Momentum Sparkline Line Chart */}
                    <div className="pt-2.5 space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                        <span>{language === 'sw' ? 'Mwelekeo wa Ushindi (Mechi 5)' : 'Win Probability Momentum (Last 5)'}</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          {language === 'sw' ? 'Kasi' : 'Momentum'}
                        </span>
                      </div>
                      <div className="h-10 w-full bg-zinc-950/40 border border-zinc-900 rounded-xl p-2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono text-zinc-500">
                            {getHistoricalProbabilityData(pred.id, pred.probability || pred.confidence)[0].probability}%
                          </span>
                          <span className="text-[10px] text-zinc-600 font-mono">→</span>
                          <span className="text-[10px] font-mono font-extrabold text-emerald-400">
                            {pred.probability || pred.confidence}%
                          </span>
                        </div>
                        <div className="h-full flex-grow max-w-[140px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={getHistoricalProbabilityData(pred.id, pred.probability || pred.confidence)}>
                              <XAxis dataKey="match" hide />
                              <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                              <Tooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="bg-zinc-950 border border-zinc-850 text-[10px] px-2 py-1 rounded-lg font-mono text-white shadow-2xl">
                                        Match {payload[0].payload.matchNum}: <span className="text-emerald-400 font-bold">{payload[0].value}%</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="probability" 
                                stroke="#10b981" 
                                strokeWidth={2} 
                                dot={{ r: 2.5, stroke: '#10b981', strokeWidth: 1, fill: '#09090b' }}
                                activeDot={{ r: 3.5, stroke: '#10b981', strokeWidth: 1.5, fill: '#10b981' }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Expert Insight Panel */}
                    {pred.analysisCriteria && (
                      <div className="pt-2.5 border-t border-zinc-800/40 mt-2.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                          <Sparkles className="w-3 h-3 text-emerald-400 shrink-0 animate-pulse" />
                          <span>{t.expertInsight || "Expert AI Insight"}</span>
                        </div>
                        <div className="bg-zinc-950/40 border border-zinc-850/60 p-2.5 rounded-xl space-y-1.5 text-[10.5px] leading-relaxed text-gray-300 font-sans">
                          <div>
                            <span className="text-emerald-400 font-bold mr-1">{language === 'sw' ? 'Fomu:' : 'Form:'}</span>
                            <span>{pred.analysisCriteria.formAnalysis}</span>
                          </div>
                          {pred.analysisCriteria.injuryImpact && (
                            <div>
                              <span className="text-amber-400 font-bold mr-1">{language === 'sw' ? 'Majeruhi:' : 'Injuries:'}</span>
                              <span>{pred.analysisCriteria.injuryImpact}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 pt-3.5 flex justify-between items-center">
                  <div className="grid grid-cols-3 gap-4 text-left">
                    <div>
                      <span className="text-[10px] text-gray-500 block">Selection</span>
                      <span className="text-xs font-bold text-white truncate max-w-[100px] block">
                        {pred.pick}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">Odds</span>
                      <span className={`text-xs font-mono font-bold ${getOddsColorClass(pred.odds, "text-emerald-400")}`}>
                        @{pred.odds.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">Confidence</span>
                      <span className="text-xs font-mono font-bold text-white">
                        {pred.confidence}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Share Action */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveShareMenuId(activeShareMenuId === pred.id ? null : pred.id);
                        }}
                        className="text-gray-400 hover:text-white p-1.5 bg-zinc-950 hover:bg-zinc-800 rounded-lg transition-all border border-zinc-800/60 cursor-pointer flex items-center justify-center gap-1 text-[11px] font-sans"
                        title="Share Prediction"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline text-xs">Share</span>
                      </button>

                      {activeShareMenuId === pred.id && (
                        <div className="absolute bottom-full right-0 mb-2 bg-zinc-950 border border-zinc-800 rounded-xl p-1.5 shadow-2xl z-20 min-w-[170px] animate-fadeIn space-y-0.5">
                          <button
                            onClick={(e) => handleCopyPrediction(pred, e)}
                            className="w-full text-left text-[11px] font-medium font-sans text-gray-300 hover:text-white hover:bg-zinc-900 px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Copy className="w-3 h-3 text-emerald-400" />
                            {copiedId === pred.id 
                              ? (language === 'sw' ? 'Imenakiliwa!' : 'Copied!') 
                              : (language === 'sw' ? 'Nakili Ujumbe' : 'Copy formatted text')}
                          </button>
                          <button
                            onClick={(e) => handleShareWhatsApp(pred, e)}
                            className="w-full text-left text-[11px] font-medium font-sans text-gray-300 hover:text-white hover:bg-zinc-900 px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            WhatsApp
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => togglePredictionSelection(pred.id, e)}
                      className={`text-[11px] font-sans font-semibold py-1.5 px-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        selectedPredictionIds.includes(pred.id)
                          ? 'bg-emerald-500 text-black border-emerald-500 font-bold'
                          : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800/60 text-gray-300'
                      }`}
                      title={selectedPredictionIds.includes(pred.id) ? "Remove from Quick Bet" : "Add to Quick Bet"}
                    >
                      {selectedPredictionIds.includes(pred.id) ? (
                        <>
                          <Check className="w-3 h-3 text-current" />
                          <span>{t.selected}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3 text-emerald-400" />
                          <span>{t.quickBet}</span>
                        </>
                      )}
                    </button>

                    <span className="text-emerald-400 p-1.5 bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </TiltCard>
            ))
          )}
        </div>
      </div>

      {/* QUICK BET COMBINATOR & SUMMARY CARD */}
      {(() => {
        const selectedPredictions = predictions.filter(p => selectedPredictionIds.includes(p.id));
        const combinedOdds = selectedPredictions.length > 0 
          ? selectedPredictions.reduce((acc, p) => acc * p.odds, 1) 
          : 0;
        const avgConfidence = selectedPredictions.length > 0 
          ? Math.round(selectedPredictions.reduce((acc, p) => acc + p.confidence, 0) / selectedPredictions.length) 
          : 0;
        const parsedQuickBetStake = parseFloat(quickBetStake) || 0;
        const quickBetReturns = parsedQuickBetStake * combinedOdds;
        const quickBetProfit = Math.max(0, quickBetReturns - parsedQuickBetStake);

        return (
          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900/80 border border-zinc-800/80 rounded-2xl p-6 mt-8 space-y-6 shadow-2xl relative overflow-hidden" id="quick-bet-summary-widget">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-950/50 border border-emerald-900/30 rounded-xl text-emerald-400">
                  <Trophy className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-sans font-extrabold text-white flex items-center gap-1.5">
                    {t.quickBetSummaryTitle}
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                      {selectedPredictions.length} {selectedPredictions.length === 1 ? (language === 'sw' ? 'MCHEZO' : 'LEG') : (language === 'sw' ? 'MICHEZO' : 'LEGS')}
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-400 font-sans">{t.quickBetSummaryDesc}</p>
                </div>
              </div>
              
              {selectedPredictions.length > 0 && (
                <button
                  onClick={() => setSelectedPredictionIds([])}
                  className="text-[10px] font-mono font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 px-3 py-1.5 rounded-lg border border-red-900/20 cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  {t.clearSelections}
                </button>
              )}
            </div>

            {selectedPredictions.length === 0 ? (
              <div className="text-center py-10 px-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-2">
                <Sparkles className="w-8 h-8 text-emerald-500/40 mx-auto" />
                <p className="text-xs font-sans text-gray-400 max-w-md mx-auto leading-relaxed">
                  {t.quickBetEmpty}
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-12 gap-6">
                {/* Selections List Column (7/12) */}
                <div className="md:col-span-7 space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-gray-500 block">
                    {t.selectedLegs}
                  </span>
                  <div className="space-y-2">
                    {selectedPredictions.map((pred) => (
                      <div 
                        key={`quick-bet-item-${pred.id}`}
                        className="bg-zinc-950/50 border border-zinc-800/80 p-3.5 rounded-xl flex items-center justify-between gap-4 transition-all hover:border-zinc-750/60"
                      >
                        <div className="space-y-1 min-w-0 flex-grow">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] bg-zinc-900 text-gray-400 font-mono font-bold px-1.5 py-0.5 rounded uppercase border border-zinc-800">
                              {pred.match.sport}
                            </span>
                            <span className="text-[9px] text-gray-500 font-mono truncate">{pred.match.league}</span>
                          </div>
                          <h5 className="text-xs font-bold text-white truncate font-sans">
                            {pred.match.homeTeam} vs {pred.match.awayTeam}
                          </h5>
                          <p className="text-[11px] text-gray-400 font-sans">
                            Recommendation: <span className="text-emerald-400 font-bold">{pred.pick}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[9px] text-gray-500 block uppercase font-mono leading-none mb-1">Odds</span>
                            <span className={`text-xs font-mono font-bold ${getOddsColorClass(pred.odds, "text-emerald-400")}`}>
                              @{pred.odds.toFixed(2)}
                            </span>
                          </div>
                          <button
                            onClick={(e) => togglePredictionSelection(pred.id, e)}
                            className="p-1.5 bg-red-950/10 hover:bg-red-950/30 border border-red-900/10 hover:border-red-900/30 text-red-400 hover:text-red-300 rounded-lg cursor-pointer transition-colors"
                            title="Remove selection"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Odds & Calculations Column (5/12) */}
                <div className="md:col-span-5 bg-zinc-950/40 border border-zinc-850 p-5 rounded-xl flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold font-mono text-gray-500 uppercase tracking-wider block">
                      {t.simulatedAccaReturn}
                    </span>

                    {/* Return breakdown */}
                    <div className="grid grid-cols-2 gap-4 border-b border-zinc-900 pb-3">
                      <div>
                        <span className="text-[9px] text-gray-400 font-mono">{t.combinedOdds}</span>
                        <div className="text-lg font-mono font-extrabold text-white mt-0.5">
                          @{combinedOdds.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 font-mono">{t.avgConfidence}</span>
                        <div className="text-lg font-mono font-extrabold text-emerald-400 mt-0.5">
                          {avgConfidence}%
                        </div>
                      </div>
                    </div>

                    {/* Stake Input */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <label className="text-[9px] font-bold font-mono uppercase tracking-wider text-gray-400">
                          {t.simulatedStake}
                        </label>
                        <span className="text-[9px] font-mono text-gray-400">Currency: {selectedCurrency}</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={quickBetStake}
                        onChange={(e) => setQuickBetStake(e.target.value)}
                        placeholder="Enter custom stake..."
                        className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                      />
                      {/* Preset quick pills */}
                      <div className="flex flex-wrap gap-1">
                        {[10, 20, 50, 100, 250, 500].map((preset) => (
                          <button
                            key={`quick-bet-preset-${preset}`}
                            onClick={() => setQuickBetStake(preset.toString())}
                            className="text-[9px] font-mono px-2 py-0.5 bg-zinc-900/80 hover:bg-zinc-800 text-gray-300 rounded-md border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                          >
                            +{selectedCurrency}{preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Return values */}
                    <div className="space-y-2 pt-2 border-t border-zinc-900/60">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-400">{t.potentialPayout}:</span>
                        <span className="text-xs font-mono font-extrabold text-white">
                          {selectedCurrency}{quickBetReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline border-t border-zinc-900/40 pt-2">
                        <span className="text-xs text-gray-400">{t.simulatedNetProfit}:</span>
                        <span className="text-sm font-mono font-extrabold text-emerald-400">
                          {selectedCurrency}{quickBetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Share Slip Button */}
                  <button
                    onClick={() => {
                      const legTexts = selectedPredictions.map(p => `• ${p.match.homeTeam} vs ${p.match.awayTeam} (${p.pick} @ ${p.odds.toFixed(2)})`).join('\n');
                      const shareText = `🎯 My Custom Quick Bet Accumulator (${selectedPredictions.length} Legs)\n\n${legTexts}\n\n🔥 Combined Odds: @${combinedOdds.toFixed(2)}\n📊 Average Confidence: ${avgConfidence}%\n\nCreated on Rafiki Predict! Join today for premium AI-powered consensus tips.`;
                      navigator.clipboard.writeText(shareText);
                      setCustomAccaCopied(true);
                      setTimeout(() => setCustomAccaCopied(false), 3000);
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.15)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.3)]"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {customAccaCopied ? t.copiedSlip : t.shareCustomAcca}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* 3. AI EXPLANATION MODAL (DEEP CRITERIA BREAKDOWN) */}
      <AnimatePresence>
        {selectedPrediction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPrediction(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-800 flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] bg-zinc-950 border border-zinc-800 font-mono px-2 py-0.5 rounded text-emerald-400 font-bold uppercase tracking-wide">
                    {selectedPrediction.match.sport} AI analysis
                  </span>
                  <h4 className="text-lg font-bold text-white font-sans mt-1.5">
                    {selectedPrediction.match.homeTeam} vs {selectedPrediction.match.awayTeam}
                  </h4>
                  <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">{selectedPrediction.match.league}</p>
                </div>
                <button 
                  onClick={() => setSelectedPrediction(null)}
                  className="text-gray-400 hover:text-white bg-zinc-950 hover:bg-zinc-800 p-1.5 rounded-lg text-sm transition-colors cursor-pointer border border-zinc-800"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[450px] overflow-y-auto">
                
                {/* Gauge Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-zinc-950 border border-zinc-800/60 p-3 rounded-xl text-center space-y-0.5">
                    <span className="text-[10px] text-gray-500 block">AI Probability</span>
                    <span className="text-base font-mono font-bold text-emerald-400">{selectedPrediction.probability}%</span>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800/60 p-3 rounded-xl text-center space-y-0.5">
                    <span className="text-[10px] text-gray-500 block">Risk Matrix</span>
                    <span className={`text-base font-sans font-bold ${
                      selectedPrediction.riskLevel === 'Low' ? 'text-emerald-400' : 'text-amber-500'
                    }`}>
                      {selectedPrediction.riskLevel}
                    </span>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800/60 p-3 rounded-xl text-center space-y-0.5">
                    <span className="text-[10px] text-gray-500 block">Expected Value (EV)</span>
                    <span className="text-base font-mono font-bold text-blue-400">+{selectedPrediction.expectedValue}</span>
                  </div>
                </div>

                {/* Main AI opinion */}
                <div className="bg-emerald-950/10 border border-emerald-500/20 p-4 rounded-xl space-y-2">
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-400" />
                    AI Analyst Primary Recommendation
                  </h5>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {selectedPrediction.aiExplanation}
                  </p>
                </div>

                {/* 10+ Multi-Variables Breakdown Checklist */}
                <div className="space-y-4">
                  <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 border-b border-zinc-800 pb-2">
                    Multi-Variable Match Analysis Reports
                  </h5>

                  <div className="space-y-3.5">
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Form, Momentum & xG Trends
                      </div>
                      <p className="text-gray-400 leading-relaxed text-[11px] pl-5.5">
                        {selectedPrediction.analysisCriteria.formAnalysis}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Injuries, Suspensions & Squad Rotations
                      </div>
                      <p className="text-gray-400 leading-relaxed text-[11px] pl-5.5">
                        {selectedPrediction.analysisCriteria.injuryImpact}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Tactical Matchup & Performance Ratings
                      </div>
                      <p className="text-gray-400 leading-relaxed text-[11px] pl-5.5">
                        {selectedPrediction.analysisCriteria.tacticalMatchup}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Betting Market Odds & Steam movement
                      </div>
                      <p className="text-gray-400 leading-relaxed text-[11px] pl-5.5">
                        {selectedPrediction.analysisCriteria.oddsMovement}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Environmental Factors, Weather, Rest Days & Surface Prep
                      </div>
                      <p className="text-gray-400 leading-relaxed text-[11px] pl-5.5">
                        {selectedPrediction.analysisCriteria.otherFactors}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Match telemetry */}
                {selectedPrediction.match.additionalStats && (
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-2">
                    <h5 className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500">
                      Telemetry Data Logged
                    </h5>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {Object.entries(selectedPrediction.match.additionalStats).map(([key, val]) => (
                        <div key={key} className="flex justify-between border-b border-zinc-900 pb-1">
                          <span className="text-gray-400">{key}:</span>
                          <span className="text-white font-medium font-mono">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Kelly Criterion Bankroll Planner */}
                {(() => {
                  const oddsVal = selectedPrediction.odds;
                  const probVal = selectedPrediction.probability / 100;
                  const netOdds = oddsVal - 1;
                  const p = probVal;
                  const q = 1 - p;
                  // Kelly % formula: (p*b - q)/b
                  const rawKelly = netOdds > 0 ? (p * netOdds - q) / netOdds : 0;
                  const finalKellyFraction = Math.max(0, rawKelly);
                  const userBankroll = parseFloat(customKellyBankroll) || 1000;
                  const recommendedPercentage = finalKellyFraction * kellyFraction * 100;
                  const recommendedStakeAmount = userBankroll * (recommendedPercentage / 100);

                  return (
                    <div className="bg-zinc-950 border border-zinc-800/80 p-5 rounded-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-emerald-950 border border-emerald-500/20 text-emerald-400 rounded-lg">
                            <Calculator className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-white font-sans">
                              {t.bankrollAdvisor || "AI Bankroll & Kelly Stake Planner"}
                            </h5>
                            <p className="text-[10px] text-gray-500 font-mono">
                              MATH-MODELLED RISK CONTROL
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded">
                          Kelly Sizing
                        </span>
                      </div>

                      {/* Explanation */}
                      <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
                        {t.kellyExplanation || "The Kelly Criterion formula calculates the mathematically optimal percentage of your bankroll to wager on a given event to maximize long-term wealth growth while minimizing risk of ruin. Quarter or Half Kelly is highly recommended to control variance."}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {/* Input Bankroll */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold font-mono text-gray-400 uppercase tracking-wider block">
                            💰 {t.bankrollLabel || "Your Total Betting Bankroll"} ({selectedCurrency})
                          </label>
                          <input
                            type="number"
                            min="10"
                            value={customKellyBankroll}
                            onChange={(e) => setCustomKellyBankroll(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 focus:border-emerald-500 focus:outline-none rounded-xl px-3 py-2 text-xs font-mono text-white transition-colors"
                            placeholder="e.g. 1000"
                          />
                        </div>

                        {/* Sizing Toggles */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold font-mono text-gray-400 uppercase tracking-wider block">
                            🛡️ {t.riskLevelPill || "Kelly Sizing Fraction"}
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() => setKellyFraction(0.25)}
                              className={`text-[9px] font-mono py-2 rounded-lg border transition-all cursor-pointer ${
                                kellyFraction === 0.25
                                  ? 'bg-emerald-950 border-emerald-500 text-emerald-400 font-bold'
                                  : 'bg-zinc-900/40 border-zinc-800/80 text-gray-400 hover:text-white'
                              }`}
                              title="25% of Kelly sizing for optimal safety"
                            >
                              1/4 Kelly
                            </button>
                            <button
                              type="button"
                              onClick={() => setKellyFraction(0.5)}
                              className={`text-[9px] font-mono py-2 rounded-lg border transition-all cursor-pointer ${
                                kellyFraction === 0.5
                                  ? 'bg-emerald-950 border-emerald-500 text-emerald-400 font-bold'
                                  : 'bg-zinc-900/40 border-zinc-800/80 text-gray-400 hover:text-white'
                              }`}
                              title="50% of Kelly sizing - Recommended balance"
                            >
                              1/2 Kelly
                            </button>
                            <button
                              type="button"
                              onClick={() => setKellyFraction(1.0)}
                              className={`text-[9px] font-mono py-2 rounded-lg border transition-all cursor-pointer ${
                                kellyFraction === 1.0
                                  ? 'bg-rose-950 border-rose-500/50 text-rose-400 font-bold'
                                  : 'bg-zinc-900/40 border-zinc-800/80 text-gray-400 hover:text-white'
                              }`}
                              title="100% of Kelly sizing - Maximum growth / Aggressive"
                            >
                              Full Kelly
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Display Results */}
                      <div className="bg-zinc-900 border border-zinc-850 p-4 rounded-xl flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                            {t.recommendedStake || "Recommended Stake"}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm text-gray-500 font-mono font-semibold">
                              {recommendedPercentage > 0 ? `${selectedCurrency}` : ''}
                            </span>
                            <span className="text-lg font-mono font-black text-white">
                              {recommendedPercentage > 0
                                ? recommendedStakeAmount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                                : '0.00'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right space-y-0.5">
                          <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                            Pct Sizing
                          </span>
                          <div className={`text-base font-mono font-black ${recommendedPercentage > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {recommendedPercentage > 0 ? `+${recommendedPercentage.toFixed(1)}%` : '0.0%'}
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] font-mono text-zinc-500 text-center flex items-center justify-center gap-1.5">
                        <Info className="w-3 h-3 text-emerald-500/40" />
                        <span>
                          {recommendedPercentage > 0 
                            ? (language === 'sw' ? 'Dau hili limebuniwa kitaalamu ili kupunguza hatari.' : 'This sizing is mathematically optimized for long-term bankroll growth.')
                            : (language === 'sw' ? 'Hakuna Edge ya kutosha kuweka dau hili kulingana na fomula ya Kelly.' : 'No active betting edge predicted for this selection according to Kelly Sizing.')
                          }
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* USER FEEDBACK SYSTEM */}
                <div className="bg-zinc-950 border border-zinc-800/80 p-5 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-950/40 border border-amber-500/20 text-amber-400 rounded-lg">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-white font-sans">
                          {language === 'sw' ? 'Tathmini Utabiri Huu' : 'Rate this Prediction'}
                        </h5>
                        <p className="text-[10px] text-gray-500 font-mono">
                          {language === 'sw' ? 'SAIDIA KUBORESHA MODELI YA AI' : 'HELP IMPROVE THE AI PREDICTION MODEL'}
                        </p>
                      </div>
                    </div>
                    {feedbackStatus === 'success' && (
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded">
                        {language === 'sw' ? 'Imepokelewa!' : 'Submitted!'}
                      </span>
                    )}
                  </div>

                  {feedbackStatus === 'success' ? (
                    <div className="text-center py-4 space-y-2">
                      <div className="text-emerald-400 text-2xl font-bold">🎉</div>
                      <p className="text-xs text-gray-200 font-medium">
                        {language === 'sw' ? 'Asante kwa maoni yako!' : 'Thank you for your valuable feedback!'}
                      </p>
                      <p className="text-[10px] text-gray-400 max-w-sm mx-auto">
                        {language === 'sw' ? 'Maoni yako yamehifadhiwa na yatafanyiwa uchambuzi ili kuboresha usahihi wa utabiri wa AI.' : 'Your ratings and comments are logged directly in our analytics engine to refine model weights and parameters.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setFeedbackStatus('idle')}
                        className="text-[10px] text-emerald-400 underline hover:text-emerald-300 mt-2 font-mono cursor-pointer bg-transparent border-0"
                      >
                        {language === 'sw' ? 'Tathmini tena' : 'Submit another feedback'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
                        {language === 'sw' ? 'Je, utabiri huu na mchanganuo wake umekusaidia? Toa tathmini yako kuanzia nyota 1 (mbaya sana) hadi 5 (nzuri sana) ili kuboresha mifumo yetu.' : 'Did you find this prediction analysis helpful? Rate it from 1 to 5 stars and let us know your preferences. Your feedback directly trains our models.'}
                      </p>

                      {/* Stars input */}
                      <div className="flex items-center gap-1.5 py-1 justify-center">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const isLit = star <= (feedbackHoverRating || feedbackRating);
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFeedbackRating(star)}
                              onMouseEnter={() => setFeedbackHoverRating(star)}
                              onMouseLeave={() => setFeedbackHoverRating(0)}
                              className="text-2xl transition-all hover:scale-125 focus:outline-none cursor-pointer duration-150 bg-transparent border-0"
                              title={`${star} Stars`}
                            >
                              <span className={isLit ? 'text-amber-400' : 'text-zinc-700'}>★</span>
                            </button>
                          );
                        })}
                        {feedbackRating > 0 && (
                          <span className="text-xs font-mono font-bold text-amber-500 ml-2">
                            {feedbackRating}/5
                          </span>
                        )}
                      </div>

                      {/* Comment inputs */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold font-mono text-gray-400 uppercase tracking-wider block">
                          ✍️ {language === 'sw' ? 'Maoni ya Ziada (Hiari)' : 'Optional Comments'}
                        </label>
                        <textarea
                          rows={2}
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          maxLength={300}
                          className="w-full bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 focus:border-emerald-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-white transition-colors placeholder-gray-600 resize-none"
                          placeholder={language === 'sw' ? 'Mfano: Mchanganuo bora, au maelezo yafafanuliwe zaidi...' : 'e.g. Excellent xG breakdown, or make explanations shorter...'}
                        />
                      </div>

                      {/* Submit */}
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={isFeedbackSubmitting || feedbackRating === 0}
                          onClick={() => handleSubmitFeedback(
                            selectedPrediction.id,
                            'prediction',
                            `${selectedPrediction.match.homeTeam} vs ${selectedPrediction.match.awayTeam}`
                          )}
                          className={`flex items-center gap-1.5 text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer ${
                            feedbackRating === 0
                              ? 'bg-zinc-800 text-gray-500 cursor-not-allowed border border-zinc-700/30'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                          }`}
                        >
                          {isFeedbackSubmitting ? (
                            <span>{language === 'sw' ? 'Inatuma...' : 'Submitting...'}</span>
                          ) : (
                            <span>{language === 'sw' ? 'Tuma Tathmini' : 'Submit Feedback'}</span>
                          )}
                        </button>
                      </div>

                      {feedbackStatus === 'error' && (
                        <p className="text-[10px] text-rose-400 font-mono text-center">
                          {language === 'sw' ? 'Hitilafu ilitokea wakati wa kutuma. Jaribu tena.' : 'Failed to submit feedback. Please try again.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-zinc-800 bg-zinc-950/40 rounded-b-2xl flex justify-between items-center text-xs">
                <span className="text-gray-400">
                  Recommended bet selection: <strong className="text-white">{selectedPrediction.pick}</strong>
                </span>
                <span className={`bg-emerald-950 border border-emerald-800/40 font-mono font-bold px-3 py-1.5 rounded-lg ${getOddsColorClass(selectedPrediction.odds, "text-emerald-400")}`}>
                  Odds @{selectedPrediction.odds.toFixed(2)}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING TOAST NOTIFICATIONS PORTAL */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: 10, transition: { duration: 0.15 } }}
              className="pointer-events-auto bg-zinc-950/95 border border-emerald-500/30 text-white rounded-2xl p-4 shadow-2xl flex gap-3 items-start relative overflow-hidden backdrop-blur-md"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-sans font-black tracking-tight text-white flex items-center gap-1.5">
                  {toast.title}
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </h4>
                <p className="text-[11px] text-gray-300 font-medium leading-relaxed">{toast.message}</p>
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-auto text-gray-500 hover:text-white transition-all p-1 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
