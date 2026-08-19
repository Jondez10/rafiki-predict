export type SportType = 'football' | 'basketball' | 'tennis';

export interface SportMatch {
  id: string;
  sport: SportType;
  homeTeam: string;
  awayTeam: string;
  league: string;
  startTime: string; // ISO string
  status: 'upcoming' | 'live' | 'completed';
  homeScore?: number;
  awayScore?: number;
  // Advanced analysis stats
  form?: { home: string[]; away: string[] }; // e.g. ["W", "D", "W"]
  h2h?: string[]; // e.g. ["Real Madrid 2-1 Sevilla", "Sevilla 0-1 Real Madrid"]
  injuries?: { home: string[]; away: string[] };
  additionalStats?: Record<string, string | number>; // xG, ATP Rank, Offensive rating, etc.
  groundingSources?: { title: string; url: string }[]; // SofaScore, FlashScore, AiScore grounding links!
}

export interface Prediction {
  id: string;
  matchId: string;
  match: SportMatch;
  pick: string; // e.g. "Real Madrid to Win"
  market: string; // e.g. "Match Winner"
  odds: number; // e.g. 1.55
  confidence: number; // 0-100%, must be > 75%
  riskLevel: 'Low' | 'Medium' | 'High';
  expectedValue: number; // e.g. 1.15
  probability: number; // e.g. 72%
  suggestedBetType: string; // e.g. "Single" or "Accumulator Leg"
  aiExplanation: string; // Detailed reason
  analysisCriteria: {
    formAnalysis: string;
    injuryImpact: string;
    tacticalMatchup: string;
    oddsMovement: string;
    otherFactors: string; // Weather, motivation, surface, referee, back-to-back, etc.
  };
  result?: 'win' | 'loss' | 'pending';
}

export interface Accumulator {
  id: string;
  type: 'safe' | 'balanced' | 'high_value';
  title: string; // e.g. "Safe Daily Acca", "Balanced Double", "Weekend High Value Gold"
  date: string; // YYYY-MM-DD
  predictions: Prediction[];
  totalOdds: number;
  combinedConfidence: number;
  status: 'pending' | 'win' | 'loss';
}

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  createdAt: string;
  role: 'user' | 'admin';
  subscriptionStatus: 'none' | 'pending_approval' | 'premium' | 'rejected' | 'expired' | 'trial';
  paymentStatus?: 'none' | 'pending_approval' | 'approved' | 'rejected';
  phone?: string;
  subscriptionPlan?: 'daily' | 'weekly' | '15days' | 'monthly' | '2months' | '3months' | '6months' | 'yearly' | string;
  trialStartedAt?: string;
  premiumExpiresAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentAmount?: number;
  paymentSubmittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalNotes?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface PaymentLog {
  id: string;
  uid: string;
  email: string;
  username?: string;
  phone?: string;
  amount: number;
  currency: string;
  method: string;
  reference: string;
  plan: 'daily' | 'weekly' | '15days' | 'monthly' | '2months' | '3months' | '6months' | 'yearly' | string;
  status: 'pending' | 'pending_approval' | 'approved' | 'rejected';
  timestamp: string;
  receiptUrl?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalNotes?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface PerformanceStats {
  monthlyAccuracy: number;
  weeklyAccuracy: number;
  roi: number; // e.g. 18.5 for 18.5%
  winRate: number; // 0-100
  totalWon: number;
  totalLost: number;
  totalActive: number;
  streak?: string;
  historicalChartData: {
    date: string;
    winRate: number;
    roi: number;
  }[];
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: string;
  sport?: SportType;
  publishedAt: string;
  readTime: string;
  imageUrl?: string;
}

export interface NotificationLog {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'success' | 'system' | 'streak';
  timestamp: string;
  read?: boolean;
}

export interface Feedback {
  id: string;
  itemId: string;
  itemType: 'prediction' | 'accumulator';
  itemTitle: string;
  rating: number; // 1-5
  comment?: string;
  userId?: string;
  userEmail?: string;
  timestamp: string;
}

export interface SavedPrediction {
  id: string;
  predictionId: string;
  userId: string;
  savedAt: string;
  prediction: Prediction;
}
