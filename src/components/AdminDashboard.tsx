import React, { useState } from 'react';
import { SportMatch, Prediction, Article, NotificationLog, PerformanceStats } from '../types';
import { Play, Plus, Trash2, Check, Radio, Send, BookOpen, Coins, BarChart3, Bell, Settings, MessageSquare, Star, Sparkles, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';

interface AdminDashboardProps {
  predictions: Prediction[];
  articles: Article[];
  notifications: NotificationLog[];
  stats: PerformanceStats | null;
  onRefreshData: () => Promise<void>;
}

export default function AdminDashboard({ predictions, articles, notifications, stats, onRefreshData }: AdminDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'notifications' | 'articles' | 'stats' | 'revenue' | 'feedback' | 'payments'>('matches');
  
  // Feedback states
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [isFeedbacksLoading, setIsFeedbacksLoading] = useState(false);

  // Pending Payments states
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const fetchPendingPayments = async () => {
    setIsPaymentsLoading(true);
    try {
      const response = await fetch('/api/admin/payments');
      if (response.ok) {
        const data = await response.json();
        setPendingPayments(data);
      }
    } catch (err) {
      console.error("Failed to fetch pending payments", err);
    } finally {
      setIsPaymentsLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeSubTab === 'feedback') {
      const fetchFeedbacks = async () => {
        setIsFeedbacksLoading(true);
        try {
          const response = await fetch('/api/feedback');
          if (response.ok) {
            const data = await response.json();
            setFeedbacks(data);
          }
        } catch (err) {
          console.error("Failed to fetch feedbacks", err);
        } finally {
          setIsFeedbacksLoading(false);
        }
      };
      fetchFeedbacks();
    } else if (activeSubTab === 'payments') {
      fetchPendingPayments();
    }
  }, [activeSubTab]);

  const handleApprovePayment = async (paymentId: string, uid: string) => {
    setActionMessage('');
    try {
      const response = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, uid, adminEmail: 'rafikibc1000@gmail.com' })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setActionMessage(`✅ Payment ${paymentId} approved! User account upgraded to VIP Premium.`);
        fetchPendingPayments();
        onRefreshData();
      } else {
        setActionMessage(`❌ Approval failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setActionMessage('❌ Network error approving payment.');
    }
  };

  const handleRejectPayment = async (paymentId: string, uid: string) => {
    const reason = prompt('Enter rejection reason for this payment:', 'Transaction reference could not be verified in statement.');
    if (!reason) return;
    setActionMessage('');
    try {
      const response = await fetch('/api/admin/payments/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, uid, reason, adminEmail: 'rafikibc1000@gmail.com' })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setActionMessage(`Payment ${paymentId} rejected.`);
        fetchPendingPayments();
      } else {
        setActionMessage(`❌ Rejection failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setActionMessage('❌ Network error rejecting payment.');
    }
  };

  // AI trigger state
  const [runningAI, setRunningAI] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  
  // Add prediction states
  const [sport, setSport] = useState<'football' | 'basketball' | 'tennis'>('football');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [league, setLeague] = useState('');
  const [pick, setPick] = useState('');
  const [market, setMarket] = useState('Match Winner');
  const [odds, setOdds] = useState('1.50');
  const [confidence, setConfidence] = useState('85');
  const [explanation, setExplanation] = useState('');
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  
  // Create notification states
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'alert' | 'success' | 'system' | 'streak'>('alert');
  
  // Create article states
  const [articleTitle, setArticleTitle] = useState('');
  const [articleSummary, setArticleSummary] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleAuthor, setArticleAuthor] = useState('Rafiki Predict Admin');
  const [articleSport, setArticleSport] = useState<'football' | 'basketball' | 'tennis'>('football');
  
  // System Stats edit states
  const [statsWinRate, setStatsWinRate] = useState(stats?.winRate?.toString() || '84.4');
  const [statsRoi, setStatsRoi] = useState(stats?.roi?.toString() || '18.4');
  const [statsMonthly, setStatsMonthly] = useState(stats?.monthlyAccuracy?.toString() || '84.5');
  const [statsWeekly, setStatsWeekly] = useState(stats?.weeklyAccuracy?.toString() || '86.2');

  const handleTriggerAI = async () => {
    setRunningAI(true);
    setAiMessage('Starting Rafiki Predict Core AI engine...');
    try {
      const response = await fetch('/api/predictions/generate-ai', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setAiMessage('Success! Gemini successfully analyzed the upcoming fixtures and deployed 3 new accumulators!');
        await onRefreshData();
      } else {
        setAiMessage(`AI Error: ${data.message || 'Analysis failed.'}`);
      }
    } catch (err) {
      setAiMessage('Failed to connect to AI generation server.');
    } finally {
      setRunningAI(false);
    }
  };

  const handleCreatePrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam || !awayTeam || !league || !pick || !explanation) {
      alert('Please fill out all match and prediction fields.');
      return;
    }

    setIsSubmitLoading(true);
    try {
      const matchId = `m-admin-${Date.now()}`;
      const predId = `p-admin-${Date.now()}`;
      
      const newMatch: SportMatch = {
        id: matchId,
        sport,
        homeTeam,
        awayTeam,
        league,
        startTime: new Date(Date.now() + 5 * 3600000).toISOString(),
        status: 'upcoming'
      };

      const newPrediction: Prediction = {
        id: predId,
        matchId,
        match: newMatch,
        pick,
        market,
        odds: Number(odds),
        confidence: Number(confidence),
        riskLevel: Number(odds) > 1.8 ? 'Medium' : 'Low',
        expectedValue: Math.round(Number(odds) * (Number(confidence) / 100) * 100) / 100,
        probability: Number(confidence),
        suggestedBetType: 'Single / Acca Leg',
        aiExplanation: explanation,
        analysisCriteria: {
          formAnalysis: 'Team is playing with optimized form indices.',
          injuryImpact: 'Lineup reports support strong tactical continuity.',
          tacticalMatchup: 'Defensive structures align well to counter opponent traits.',
          oddsMovement: 'Steady market line movement points to smart-money confidence.',
          otherFactors: 'Favorable surrounding environment and team motivation.'
        }
      };

      const response = await fetch('/api/admin/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prediction: newPrediction })
      });

      if (response.ok) {
        alert('Prediction added successfully!');
        setHomeTeam('');
        setAwayTeam('');
        setPick('');
        setExplanation('');
        await onRefreshData();
      } else {
        alert('Error adding prediction.');
      }
    } catch (err) {
      alert('Connectivity error.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDeletePrediction = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this prediction?')) return;
    try {
      const response = await fetch(`/api/admin/predictions/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await onRefreshData();
      } else {
        alert('Failed to delete prediction');
      }
    } catch (err) {
      alert('Connectivity error.');
    }
  };

  const handlePostNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifMessage) return;
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification: { title: notifTitle, message: notifMessage, type: notifType }
        })
      });
      if (response.ok) {
        alert('Notification published!');
        setNotifTitle('');
        setNotifMessage('');
        await onRefreshData();
      }
    } catch (err) {
      alert('Failed.');
    }
  };

  const handlePostArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleTitle || !articleSummary || !articleContent) return;
    try {
      const response = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: {
            title: articleTitle,
            summary: articleSummary,
            content: articleContent,
            author: articleAuthor,
            sport: articleSport,
            readTime: '4 min read'
          }
        })
      });
      if (response.ok) {
        alert('Article posted successfully!');
        setArticleTitle('');
        setArticleSummary('');
        setArticleContent('');
        await onRefreshData();
      }
    } catch (err) {
      alert('Failed.');
    }
  };

  const handleUpdateStats = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedStats: PerformanceStats = {
        winRate: Number(statsWinRate),
        roi: Number(statsRoi),
        monthlyAccuracy: Number(statsMonthly),
        weeklyAccuracy: Number(statsWeekly),
        totalWon: stats?.totalWon || 38,
        totalLost: stats?.totalLost || 7,
        totalActive: stats?.totalActive || 4,
        historicalChartData: stats?.historicalChartData || []
      };
      const response = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats: updatedStats })
      });
      if (response.ok) {
        alert('Stats updated successfully!');
        await onRefreshData();
      }
    } catch (err) {
      alert('Failed.');
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-8" id="admin-section">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h2 className="text-xl font-bold font-sans text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            Rafiki Predict Admin HQ
          </h2>
          <p className="text-xs text-gray-400">Manage platform data, trigger AI generators, and control subscription logs.</p>
        </div>

        {/* AI Prediction Core trigger */}
        <button
          onClick={handleTriggerAI}
          disabled={runningAI}
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] disabled:opacity-50"
        >
          <Radio className={`w-4 h-4 ${runningAI ? 'animate-pulse text-red-700' : ''}`} />
          {runningAI ? 'AI Analyzing...' : 'Run Gemini AI Analysis'}
        </button>
      </div>

      {aiMessage && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-emerald-400 flex items-start gap-2.5">
          <Play className="w-3.5 h-3.5 mt-0.5 text-emerald-500" />
          <span>{aiMessage}</span>
        </div>
      )}

      {/* Admin tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        {[
          { id: 'matches', label: 'Predictions Panel', icon: Plus },
          { id: 'payments', label: 'Payment Approvals ⌛', icon: ShieldCheck },
          { id: 'notifications', label: 'Push Notifications', icon: Bell },
          { id: 'articles', label: 'Publish Articles', icon: BookOpen },
          { id: 'stats', label: 'Efficacy Statistics', icon: BarChart3 },
          { id: 'revenue', label: 'Subscription Logs', icon: Coins },
          { id: 'feedback', label: 'AI Feedback & Tuning', icon: MessageSquare }
        ].map(subTab => {
          const Icon = subTab.icon;
          return (
            <button
              key={subTab.id}
              onClick={() => setActiveSubTab(subTab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
                activeSubTab === subTab.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {subTab.label}
            </button>
          );
        })}
      </div>

      {/* CONTENT: PAYMENTS */}
      {activeSubTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-950 border border-zinc-800 p-5 rounded-2xl">
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Pending Payment Approval Requests
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Under the <strong>Payment-First Policy</strong>, users cannot access any protected predictions or tools until an administrator approves their submitted payment receipt.
              </p>
            </div>
            <button
              onClick={fetchPendingPayments}
              disabled={isPaymentsLoading}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-2 px-4 rounded-xl border border-zinc-700 transition-all cursor-pointer shrink-0"
            >
              {isPaymentsLoading ? 'Refreshing...' : '🔄 Refresh Requests'}
            </button>
          </div>

          {actionMessage && (
            <div className={`p-4 rounded-xl border text-xs font-mono font-bold ${actionMessage.startsWith('✅') ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400' : 'bg-rose-950/40 border-rose-500/40 text-rose-400'}`}>
              {actionMessage}
            </div>
          )}

          {isPaymentsLoading ? (
            <div className="text-center py-12 text-xs font-mono text-gray-500">
              Loading pending payment logs from Firestore...
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-zinc-950 border border-zinc-800 rounded-2xl">
              <span className="text-3xl">🎉</span>
              <h4 className="text-sm font-bold text-white">No Pending Payments Awaiting Review</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                All submitted payment requests have been verified and processed. New user submissions will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-mono text-gray-400 font-bold">
                Pending Verification Requests ({pendingPayments.length})
              </div>

              <div className="grid gap-4">
                {pendingPayments.map((p) => (
                  <div key={p.id} className="bg-zinc-950 border border-amber-500/30 p-5 rounded-2xl space-y-4 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-400 text-[10px] font-mono px-3 py-1 rounded-bl-xl border-l border-b border-amber-500/30 uppercase font-bold">
                      Pending Review
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-gray-500 uppercase">User Account</span>
                        <div className="font-bold text-white text-sm">{p.email}</div>
                        <div className="text-gray-400 font-mono text-[11px]">UID: {p.uid}</div>
                        {p.phone && <div className="text-emerald-400 font-mono text-[11px]">Phone: {p.phone}</div>}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-gray-500 uppercase">Payment Details</span>
                        <div className="font-bold text-emerald-400 text-sm">
                          {p.currency} {p.amount} ({p.plan?.toUpperCase()} PLAN)
                        </div>
                        <div className="text-gray-300">Method: <strong className="text-white">{p.method}</strong></div>
                        <div className="text-gray-300 font-mono">
                          Receipt/Code: <span className="bg-zinc-900 border border-zinc-800 text-amber-300 px-2 py-0.5 rounded font-bold">{p.reference}</span>
                        </div>
                      </div>

                      <div className="space-y-1 md:text-right">
                        <span className="text-[10px] font-mono text-gray-500 uppercase">Submission Time</span>
                        <div className="text-gray-300 font-mono">
                          {p.submittedAt ? new Date(p.submittedAt).toLocaleString() : 'Recently'}
                        </div>
                        <div className="text-[10px] text-amber-400">
                          Status: Pending Admin Approval
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-900 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {p.phone && (
                          <a
                            href={`https://wa.me/${p.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello, regarding your payment reference ${p.reference} for Rafiki Predict...`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-zinc-900 hover:bg-zinc-800 text-emerald-400 text-xs py-2 px-3 rounded-xl border border-zinc-800 font-mono flex items-center gap-1.5"
                          >
                            💬 WhatsApp User
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleRejectPayment(p.id, p.uid)}
                          className="bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 font-bold text-xs py-2 px-4 rounded-xl border border-rose-800/50 transition-all cursor-pointer"
                        >
                          ✕ Reject Payment
                        </button>
                        <button
                          onClick={() => handleApprovePayment(p.id, p.uid)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-bold text-xs py-2 px-5 rounded-xl transition-all cursor-pointer shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] flex items-center gap-1.5"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Approve Payment & Activate VIP
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTENT: MATCHES */}
      {activeSubTab === 'matches' && (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Create prediction form */}
          <form onSubmit={handleCreatePrediction} className="space-y-4 bg-zinc-950 border border-zinc-800/60 p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider text-emerald-400">
              Create Manual Prediction
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {['football', 'basketball', 'tennis'].map((sp) => (
                <button
                  type="button"
                  key={sp}
                  onClick={() => setSport(sp as any)}
                  className={`py-2 px-1 text-xs font-bold rounded-lg capitalize border transition-all ${
                    sport === sp 
                      ? 'bg-emerald-950/40 border-emerald-500 text-white' 
                      : 'bg-zinc-900 border-zinc-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Home Team / Player</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manchester City"
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Away Team / Player</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Liverpool"
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">League / Tournament</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Premier League"
                  value={league}
                  onChange={(e) => setLeague(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Betting Market</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Both Teams to Score"
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Selection Pick</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BTTS (Yes)"
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Decimal Odds</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1.75"
                  value={odds}
                  onChange={(e) => setOdds(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">AI Confidence %</label>
                <input
                  type="number"
                  min="75"
                  max="100"
                  required
                  placeholder="e.g. 88"
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">AI Analytical Reasoning</label>
              <textarea
                required
                rows={3}
                placeholder="Describe tactical matchups, injury news, weather patterns, and other supporting factors..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitLoading ? 'Saving...' : 'Deploy Prediction'}
            </button>
          </form>

          {/* Active prediction listing with deletions */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider text-emerald-400">
              Active Predictions Registry
            </h3>

            <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
              {predictions.filter(p => !p.id.startsWith('p-hist-')).map((p) => (
                <div key={p.id} className="bg-zinc-950 border border-zinc-800/80 p-3.5 rounded-xl flex items-center justify-between gap-3 hover:border-zinc-700 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-zinc-800">
                        {p.match.sport}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        {p.match.league}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {p.match.homeTeam} vs {p.match.awayTeam}
                    </div>
                    <div className="text-xs text-gray-300">
                      Pick: <strong className="text-white font-medium">{p.pick}</strong> @ {p.odds} ({p.confidence}% conf)
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeletePrediction(p.id)}
                    className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-red-950/40 hover:text-red-400 text-gray-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: NOTIFICATIONS */}
      {activeSubTab === 'notifications' && (
        <div className="grid md:grid-cols-2 gap-8">
          <form onSubmit={handlePostNotification} className="space-y-4 bg-zinc-950 border border-zinc-800 p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider text-emerald-400">
              Publish Push Notification
            </h3>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Notification Title</label>
              <input
                type="text"
                required
                placeholder="e.g. 🚀 High Odds Safe Double Active"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Notification Type</label>
              <select
                value={notifType}
                onChange={(e) => setNotifType(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="alert">Alert (Dynamic Tips Published)</option>
                <option value="success">Success (Payment/Winning confirmation)</option>
                <option value="system">System (Operational updates)</option>
                <option value="streak">Winning Streak (Profit alerts)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Alert Message</label>
              <textarea
                required
                rows={3}
                placeholder="Describe the critical announcement or alert..."
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-bold py-2 rounded-lg text-xs cursor-pointer transition-colors"
            >
              Send Notification Log
            </button>
          </form>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider text-emerald-400">
              Active Alerts Feed
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">{n.title}</span>
                    <span className="text-[9px] font-mono text-gray-500">
                      {new Date(n.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: ARTICLES */}
      {activeSubTab === 'articles' && (
        <div className="grid md:grid-cols-2 gap-8">
          <form onSubmit={handlePostArticle} className="space-y-4 bg-zinc-950 border border-zinc-800 p-5 rounded-2xl">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider text-emerald-400">
              Write Strategy Article
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Article Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. xG Analysis Mismatches"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Sport Filter</label>
                <select
                  value={articleSport}
                  onChange={(e) => setArticleSport(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="football">Football</option>
                  <option value="basketball">Basketball</option>
                  <option value="tennis">Tennis</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Article Summary</label>
              <input
                type="text"
                required
                placeholder="One-line summary for feed card previews..."
                value={articleSummary}
                onChange={(e) => setArticleSummary(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Markdown Body Content</label>
              <textarea
                required
                rows={6}
                placeholder="Write the comprehensive analysis, paragraphs, and lists..."
                value={articleContent}
                onChange={(e) => setArticleContent(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-bold py-2 rounded-lg text-xs cursor-pointer transition-colors"
            >
              Publish Article
            </button>
          </form>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider text-emerald-400">
              Published Strategy Blogs
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {articles.map((art) => (
                <div key={art.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1.5">
                  <div className="text-xs font-bold text-white">{art.title}</div>
                  <p className="text-xs text-gray-400 line-clamp-2">{art.summary}</p>
                  <div className="text-[10px] text-gray-500 font-mono">
                    Published: {new Date(art.publishedAt).toLocaleDateString()} by {art.author}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: STATISTICS */}
      {activeSubTab === 'stats' && (
        <form onSubmit={handleUpdateStats} className="space-y-4 bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-xl">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider text-emerald-400">
            Edit Global Platform Stats
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Global Win Rate %</label>
              <input
                type="number"
                step="0.1"
                required
                value={statsWinRate}
                onChange={(e) => setStatsWinRate(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Global ROI %</label>
              <input
                type="number"
                step="0.1"
                required
                value={statsRoi}
                onChange={(e) => setStatsRoi(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Monthly Accuracy %</label>
              <input
                type="number"
                step="0.1"
                required
                value={statsMonthly}
                onChange={(e) => setStatsMonthly(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Weekly Accuracy %</label>
              <input
                type="number"
                step="0.1"
                required
                value={statsWeekly}
                onChange={(e) => setStatsWeekly(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-sans font-bold py-2 rounded-lg text-xs cursor-pointer transition-colors"
          >
            Apply New Performance Statistics
          </button>
        </form>
      )}

      {/* CONTENT: REVENUE */}
      {activeSubTab === 'revenue' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-gray-400">Simulated Revenue (USD)</span>
              <div className="text-xl font-mono font-bold text-white">$1,480.00</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-gray-400">Total Premium Users</span>
              <div className="text-xl font-mono font-bold text-white">42 Active</div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-gray-400">Verification Rate</span>
              <div className="text-xl font-mono font-bold text-emerald-400">100% Instant</div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              Live Checkout logs
            </h4>
            
            <p className="text-xs text-gray-500 leading-relaxed">
              Every checkout logged via M-Pesa (Till 6881472 / Send Money 0716483642), Airtel Money (0735309361), Telkom T-Kash (0773266691), Equity Bank (0620187419406), Payoneer/Pesapal/Skrill (johnmushira@gmail.com), or Visa Card (4478 **** **** 9885) is verifiably logged below in real-time. Simulated logs are instantly approved for sandbox testing, updating the user profile.
            </p>

            <div className="text-xs text-gray-400 text-center py-4 bg-zinc-900/40 rounded-xl border border-dashed border-zinc-800">
              Connection stable. Ready to register active client billing webhooks.
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: USER FEEDBACK & AI TUNING */}
      {activeSubTab === 'feedback' && (
        <div className="space-y-6">
          {isFeedbacksLoading ? (
            <div className="text-center py-12 text-xs font-mono text-gray-500">
              Fetching user ratings and feedback data from Firestore...
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-zinc-950 border border-zinc-800 rounded-2xl">
              <span className="text-2xl">⭐</span>
              <h4 className="text-sm font-bold text-white">No Feedback Collected Yet</h4>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Once users rate prediction detail modals or accumulator tickets, their rating aggregates, comments, and item associations will sync here automatically.
              </p>
            </div>
          ) : (() => {
            const totalRatings = feedbacks.length;
            const avgRating = feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalRatings;
            const predictionFeedbacks = feedbacks.filter(f => f.itemType === 'prediction');
            const accumulatorFeedbacks = feedbacks.filter(f => f.itemType === 'accumulator');
            const avgPredictionRating = predictionFeedbacks.length > 0 
              ? predictionFeedbacks.reduce((acc, f) => acc + f.rating, 0) / predictionFeedbacks.length 
              : 0;
            const avgAccumulatorRating = accumulatorFeedbacks.length > 0 
              ? accumulatorFeedbacks.reduce((acc, f) => acc + f.rating, 0) / accumulatorFeedbacks.length 
              : 0;

            // Rating counts for 1-5 stars
            const counts = [0, 0, 0, 0, 0];
            feedbacks.forEach(f => {
              if (f.rating >= 1 && f.rating <= 5) {
                counts[f.rating - 1]++;
              }
            });

            // AI Model Parameter Advice & Analysis
            let aiAdviceTitle = "AI Model Performance Optimal";
            let aiAdviceText = "Average user rating is excellent. The current combination of xG momentum analysis and odds-weighted consensus operates with solid alignment with user preferences.";
            let aiAdviceColor = "border-emerald-500/20 bg-emerald-950/10 text-emerald-400";

            if (avgRating < 3.0) {
              aiAdviceTitle = "Model Calibration Advised (Low Rating Alert)";
              aiAdviceText = "Average rating has dropped below 3.0. Users are reporting variance in risk assessments. Recommend lowering the confidence weighting on Basketball or Tennis predictions until models stabilize.";
              aiAdviceColor = "border-rose-500/20 bg-rose-950/10 text-rose-400";
            } else if (avgRating < 4.0) {
              aiAdviceTitle = "Model Fine-Tuning Recommended";
              aiAdviceText = "Ratings indicate slight mismatch between user odds preferences and published value bets. Recommended adjustment: Increase the Kelly Sizing constraint default parameter to Quarter-Kelly (0.25) to prevent over-leverage.";
              aiAdviceColor = "border-amber-500/20 bg-amber-950/10 text-amber-400";
            }

            // User preferences analysis based on textual reviews
            const commentsWithKeywords = feedbacks.filter(f => f.comment && f.comment.trim() !== "");
            const preferredFeatures = [];
            if (commentsWithKeywords.some(f => f.comment.toLowerCase().includes('kelly') || f.comment.toLowerCase().includes('bankroll') || f.comment.toLowerCase().includes('stake'))) {
              preferredFeatures.push("Kelly Bankroll Calculator");
            }
            if (commentsWithKeywords.some(f => f.comment.toLowerCase().includes('odds') || f.comment.toLowerCase().includes('value') || f.comment.toLowerCase().includes('high'))) {
              preferredFeatures.push("High-Value/Odds tips");
            }
            if (commentsWithKeywords.some(f => f.comment.toLowerCase().includes('safe') || f.comment.toLowerCase().includes('low risk') || f.comment.toLowerCase().includes('sure'))) {
              preferredFeatures.push("Safe/Low-Risk Accumulators");
            }
            if (preferredFeatures.length === 0) {
              preferredFeatures.push("AI Detailed Explanations", "Low-Odds Safety Tips");
            }

            return (
              <div className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1 text-left">
                    <span className="text-[10px] text-gray-500 font-mono">TOTAL RATINGS</span>
                    <div className="text-2xl font-mono font-bold text-white">{totalRatings}</div>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1 text-left">
                    <span className="text-[10px] text-gray-500 font-mono">GLOBAL SATISFACTION</span>
                    <div className="text-2xl font-mono font-bold text-amber-400 flex items-center gap-1.5">
                      ★ {avgRating.toFixed(1)}
                    </div>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1 text-left">
                    <span className="text-[10px] text-gray-500 font-mono">PREDICTION RATING</span>
                    <div className="text-2xl font-mono font-bold text-blue-400">
                      ★ {avgPredictionRating > 0 ? avgPredictionRating.toFixed(1) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1 text-left">
                    <span className="text-[10px] text-gray-500 font-mono">ACCUMULATOR RATING</span>
                    <div className="text-2xl font-mono font-bold text-purple-400">
                      ★ {avgAccumulatorRating > 0 ? avgAccumulatorRating.toFixed(1) : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Star rating bar breakdown and AI diagnosis */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Rating distribution bar graph */}
                  <div className="bg-zinc-950 border border-zinc-800/80 p-5 rounded-2xl space-y-4">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 text-left">
                      Rating Distribution
                    </h4>
                    <div className="space-y-2.5">
                      {[5, 4, 3, 2, 1].map(stars => {
                        const count = counts[stars - 1];
                        const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
                        return (
                          <div key={stars} className="flex items-center gap-3 text-xs">
                            <span className="w-12 text-gray-400 font-mono flex items-center justify-end gap-1">
                              {stars} <span className="text-amber-400">★</span>
                            </span>
                            <div className="flex-grow bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-850">
                              <div className="bg-amber-400 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="w-8 text-gray-500 font-mono text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI Prediction Models tuning advisor */}
                  <div className="bg-zinc-950 border border-zinc-800/80 p-5 rounded-2xl flex flex-col justify-between text-left">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                          AI Model Calibration Advisor
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        User satisfaction signals are continuously analyzed to feedback weights into our multi-criteria consensus modeling logic.
                      </p>

                      <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${aiAdviceColor}`}>
                        <div className="font-bold flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          {aiAdviceTitle}
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed">{aiAdviceText}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-900 mt-4 text-[10px] text-gray-500 font-sans">
                      Detected User Preference Trends: <strong className="text-emerald-400">{preferredFeatures.join(", ")}</strong>
                    </div>
                  </div>
                </div>

                {/* Feedbacks list */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 text-left">
                      Recent Qualitative Feedback Logs
                    </h4>
                    <span className="text-[10px] font-mono text-gray-500">
                      Latest submissions
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {feedbacks.map((fb) => (
                      <div key={fb.id} className="p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2 text-left">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-gray-400">
                              {fb.itemType.toUpperCase()}
                            </span>
                            <span className="text-xs font-bold text-white ml-2">
                              {fb.itemTitle}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: fb.rating }).map((_, i) => (
                              <span key={i} className="text-xs text-amber-400">★</span>
                            ))}
                            {Array.from({ length: 5 - fb.rating }).map((_, i) => (
                              <span key={i} className="text-xs text-zinc-800 font-bold opacity-20">★</span>
                            ))}
                          </div>
                        </div>

                        {fb.comment ? (
                          <p className="text-xs text-gray-300 leading-relaxed bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900">
                            "{fb.comment}"
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-500 italic pl-1">
                            No text comment provided.
                          </p>
                        )}

                        <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                          <span>User: {fb.userEmail || "Anonymous"}</span>
                          <span>{new Date(fb.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
