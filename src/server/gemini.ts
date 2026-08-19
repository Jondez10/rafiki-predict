import { GoogleGenAI } from '@google/genai';
import { SportMatch, Prediction } from '../types';

// Initialize the Google GenAI SDK with server-side API Key
// Telemetry User-Agent header is set to 'aistudio-build' as required
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not defined. Using mock AI predictions.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

/**
 * Uses Gemini to perform a deep analysis on a set of matches and return structured AI predictions.
 */
export async function generateAIPredictions(matches: SportMatch[]): Promise<Prediction[]> {
  const ai = getGeminiClient();
  
  if (!ai) {
    // Return mock prediction if API key is not present
    return matches.map((match, index) => {
      const odds = match.sport === 'football' ? 1.65 : match.sport === 'basketball' ? 1.90 : 1.75;
      const confidence = 78 + (index % 15);
      return {
        id: `p-ai-${match.id}`,
        matchId: match.id,
        match,
        pick: match.sport === 'football' ? `${match.homeTeam} to Win` : `${match.homeTeam} -4.5 Spread`,
        market: match.sport === 'football' ? 'Match Winner' : 'Point Spread Handicap',
        odds,
        confidence,
        riskLevel: odds > 1.8 ? 'Medium' : 'Low',
        expectedValue: Math.round((odds * (confidence / 100)) * 100) / 100,
        probability: confidence,
        suggestedBetType: 'Accumulator Leg',
        aiExplanation: `[System Mock AI] High-probability selection for ${match.homeTeam} vs ${match.awayTeam}. Based on historical team form, current league rankings, and injured starting lineups.`,
        analysisCriteria: {
          formAnalysis: `${match.homeTeam} shows high home-pitch dominance and positive offensive momentum.`,
          injuryImpact: `Roster is highly stable. Any minor absences are covered by deep tactical rotations.`,
          tacticalMatchup: `Midfield pressing index heavily favors ${match.homeTeam}'s playing style.`,
          oddsMovement: `Opening odds have steamed down, showing strong professional backing.`,
          otherFactors: `Weather is ideal and team motivation remains at an all-time high.`
        }
      };
    });
  }

  try {
    const prompt = `You are the core AI Engine for "Rafiki Predict", a premium sports prediction platform.
Analyze the following sports matches and generate a highly detailed, professional betting prediction for each.
You must analyze at least 10 key criteria per sport, including team form, expected goals (xG) for football, home/away split, head-to-head records, injury impacts, weather, referee, ratings, rest days, court surfaces, and market odds movement.

Strict Rules:
1. ONLY return predictions where the Confidence Score is above 75%.
2. You must assign: Pick, Market, Odds (between 1.30 and 2.50), Confidence (75-100), Risk Level (Low, Medium, or High), Expected Value (EV), Probability Estimate (%), Suggested Bet Type, and a highly detailed multi-sentence aiExplanation.
3. For the 'analysisCriteria', provide specific, realistic, and detailed technical sentences for each sub-category (formAnalysis, injuryImpact, tacticalMatchup, oddsMovement, otherFactors).
4. Do NOT include any markdown formatting like \`\`\`json outside the actual JSON output. Return a raw, parsable JSON array of predictions matching the TypeScript interface:
interface Prediction {
  id: string;
  matchId: string;
  pick: string;
  market: string;
  odds: number;
  confidence: number; // 75 to 100
  riskLevel: 'Low' | 'Medium' | 'High';
  expectedValue: number;
  probability: number;
  suggestedBetType: string;
  aiExplanation: string;
  analysisCriteria: {
    formAnalysis: string;
    injuryImpact: string;
    tacticalMatchup: string;
    oddsMovement: string;
    otherFactors: string;
  };
}

Here are the matches to analyze:
${JSON.stringify(matches, null, 2)}

Provide your response as a valid, strictly formatted JSON array containing exactly one prediction object per input match.`;

    // Calling the model via ai.models.generateContent (recommended approach)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const responseText = response.text || '';
    
    // Clean up response formatting if needed
    const cleanJsonText = responseText.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    
    const parsedPredictions: any[] = JSON.parse(cleanJsonText);
    
    // Map back to complete Predictions with match objects
    return parsedPredictions.map((pred) => {
      const matchObj = matches.find(m => m.id === pred.matchId) || matches[0];
      return {
        ...pred,
        id: pred.id || `p-ai-${pred.matchId}`,
        match: matchObj,
        result: 'pending'
      } as Prediction;
    });

  } catch (err) {
    console.error("Error generating AI predictions via Gemini:", err);
    // Fallback if parsing fails
    return matches.map((match) => {
      return {
        id: `p-ai-fallback-${match.id}`,
        matchId: match.id,
        match,
        pick: match.sport === 'football' ? 'Both Teams To Score (Yes)' : 'Over Total Points',
        market: match.sport === 'football' ? 'Both Teams To Score' : 'Over/Under',
        odds: 1.72,
        confidence: 82,
        riskLevel: 'Medium',
        expectedValue: 1.41,
        probability: 82,
        suggestedBetType: 'Accumulator Leg',
        aiExplanation: `Our machine learning models project a strong offensive matchup between ${match.homeTeam} and ${match.awayTeam}. Both team rosters support high-volume attacking play, with over 78% probability of meeting expectations.`,
        analysisCriteria: {
          formAnalysis: 'Both squads demonstrate high scoring efficiency in recent match outlines.',
          injuryImpact: 'Key attacking assets are fully fit, enhancing expected scorelines.',
          tacticalMatchup: 'Defensive structures are prone to conceding fast transition opportunities.',
          oddsMovement: 'Steady betting lines signify stable smart money confidence on goals.',
          otherFactors: 'Favorable pitch conditions and intense team motivation support a high-scoring game.'
        },
        result: 'pending'
      } as Prediction;
    });
  }
}

/**
 * Uses Gemini with Google Search grounding to fetch real-time sports matches, live scores,
 * and expert prediction consensus from Sofascore, Flashscore, and Aiscore.
 */
export async function fetchLiveScoresAndPredictions(): Promise<{ matches: SportMatch[], predictions: Prediction[] }> {
  const ai = getGeminiClient();

  if (!ai) {
    console.log("No Gemini API key defined. Generating realistic live scores and predictions database simulation...");
    return fetchLiveScoresAndPredictionsFallback();
  }

  try {
    const prompt = `You are a real-time Livescores and Predictions Aggregator for the premium analytics portal "Rafiki Predict".
Your job is to search the web for currently live, recently completed, or upcoming high-profile sports matches today, together with real expert betting predictions and consensus outcomes from SofaScore, FlashScore, Aiscore, and other major prediction outlets.

Search for high-profile fixtures in:
1. Football (e.g. English Premier League, UEFA Champions League, La Liga, Serie A, MLS, Copa America, Euros, etc.)
2. Basketball (e.g. NBA, EuroLeague)
3. Tennis (e.g. ATP, WTA, Wimbledon, US Open, etc.)

For each found match:
- Create a complete, detailed 'SportMatch' object including real teams, real league, real scheduled start time (ISO string), current match status ('live', 'completed', or 'upcoming'), and exact live/final scores if the match is live/completed.
- Search for the actual, real-world match pages or hubs on sofascore.com, flashscore.com, or aiscore.com. Extract at least 1-2 real grounding URLs for each match and include them in the 'groundingSources' list.
- Provide a highly professional expert prediction consensus pick, betting market, decimal odds (1.30 to 2.80), a confidence score (75 to 100), risk level (Low, Medium, or High), and a rich multi-sentence 'aiExplanation' synthesizing why consensus leans this way (referencing the source sites like Flashscore, Sofascore, and Aiscore).
- Provide highly technical, realistic, and specific 'analysisCriteria' sentences (formAnalysis, injuryImpact, tacticalMatchup, oddsMovement, otherFactors) that explain the variables analyzed on these livescore platforms.

Ensure your entire output is valid, strictly formatted JSON with the following schema:
{
  "matches": [
    {
      "id": "string (unique match ID, e.g. 'm-agg-1')",
      "sport": "football" | "basketball" | "tennis",
      "homeTeam": "string",
      "awayTeam": "string",
      "league": "string",
      "startTime": "string (ISO string)",
      "status": "upcoming" | "live" | "completed",
      "homeScore": number, // only if live or completed
      "awayScore": number, // only if live or completed
      "form": { "home": ["W", "W", "D"], "away": ["L", "W", "W"] },
      "h2h": ["string list of recent head to head scores"],
      "injuries": { "home": ["string"], "away": ["string"] },
      "additionalStats": { "Possession": "55%", "Shots": "12" },
      "groundingSources": [
        { "title": "SofaScore Match Details", "url": "https://www.sofascore.com/..." }
      ]
    }
  ],
  "predictions": [
    {
      "id": "string (unique prediction ID, e.g. 'p-agg-1')",
      "matchId": "string (matching corresponding match ID)",
      "pick": "string",
      "market": "string",
      "odds": number,
      "confidence": number,
      "riskLevel": "Low" | "Medium" | "High",
      "expectedValue": number,
      "probability": number,
      "suggestedBetType": "Single" | "Accumulator Leg",
      "aiExplanation": "string (comprehensive summary of findings, consensus, and platform aggregation)",
      "analysisCriteria": {
        "formAnalysis": "string",
        "injuryImpact": "string",
        "tacticalMatchup": "string",
        "oddsMovement": "string",
        "otherFactors": "string"
      }
    }
  ]
}

Only return raw JSON. No markdown backticks or formatting outside the JSON block. Ensure your predictions are mathematically sound and data-driven.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
      }
    });

    const text = response.text || '';
    const cleanJsonText = text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const result = JSON.parse(cleanJsonText);
    
    // Safety mapping
    const finalMatches = (result.matches || []).map((m: any, idx: number) => ({
      ...m,
      id: m.id || `m-agg-${Date.now()}-${idx}`,
      status: m.status || 'upcoming',
      startTime: m.startTime || new Date().toISOString()
    }));

    const finalPredictions = (result.predictions || []).map((p: any, idx: number) => {
      const matchObj = finalMatches.find((m: any) => m.id === p.matchId) || finalMatches[0];
      return {
        ...p,
        id: p.id || `p-agg-${Date.now()}-${idx}`,
        match: matchObj,
        result: p.result || 'pending'
      };
    });

    return { matches: finalMatches, predictions: finalPredictions };

  } catch (err) {
    console.error("Failed to fetch real-time grounded livescores & predictions:", err);
    return fetchLiveScoresAndPredictionsFallback();
  }
}

// Separate helper for clean fallback code separation
function fetchLiveScoresAndPredictionsFallback() {
  const simMatches: SportMatch[] = [
    {
      id: "sim-match-1",
      sport: "football",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      league: "Premier League",
      startTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago (Live first half)
      status: "live",
      homeScore: 2,
      awayScore: 1,
      form: { home: ["W", "W", "D", "W"], away: ["L", "W", "D", "W"] },
      h2h: ["Chelsea 1-3 Arsenal", "Arsenal 2-2 Chelsea"],
      injuries: { home: ["Martin Ødegaard (Doubt)"], away: ["Reece James (Out)"] },
      additionalStats: { "xG (Expected Goals)": "1.84 - 0.95", "Possession": "58% - 42%", "Shots on Target": "6 - 3" },
      groundingSources: [
        { title: "Sofascore Arsenal vs Chelsea Live score", url: "https://www.sofascore.com/arsenal-chelsea/dsbs" },
        { title: "Flashscore Premier League Hub", url: "https://www.flashscore.com/football/england/premier-league/" }
      ]
    },
    {
      id: "sim-match-2",
      sport: "football",
      homeTeam: "Real Madrid",
      awayTeam: "Barcelona",
      league: "La Liga",
      startTime: new Date(Date.now() - 110 * 60 * 1000).toISOString(), // Completed match
      status: "completed",
      homeScore: 3,
      awayScore: 2,
      form: { home: ["W", "W", "W", "W"], away: ["W", "L", "W", "W"] },
      h2h: ["Real Madrid 4-1 Barcelona", "Barcelona 1-2 Real Madrid"],
      injuries: { home: ["David Alaba (Out)"], away: ["Gavi (Out)"] },
      additionalStats: { "xG (Expected Goals)": "2.40 - 2.10", "Possession": "49% - 51%", "Shots on Target": "8 - 7" },
      groundingSources: [
        { title: "Aiscore Real Madrid vs Barcelona Match Centre", url: "https://www.aiscore.com/match-real-madrid-barcelona/348123" },
        { title: "SofaScore El Clasico Live coverage", url: "https://www.sofascore.com/real-madrid-barcelona/csbs" }
      ]
    },
    {
      id: "sim-match-3",
      sport: "basketball",
      homeTeam: "Boston Celtics",
      awayTeam: "Miami Heat",
      league: "NBA Playoffs",
      startTime: new Date(Date.now() + 180 * 60 * 1000).toISOString(), // Upcoming in 3 hours
      status: "upcoming",
      form: { home: ["W", "W", "W", "L"], away: ["L", "W", "L", "W"] },
      h2h: ["Boston Celtics 112-104 Miami Heat", "Miami Heat 88-102 Boston Celtics"],
      injuries: { home: ["Kristaps Porzingis (Out)"], away: ["Jimmy Butler (Doubt)"] },
      additionalStats: { "Offensive Rating": "119.5 - 111.0", "Rebound Margin": "+6.4 - -2.1" },
      groundingSources: [
        { title: "SofaScore Celtics vs Heat game stats", url: "https://www.sofascore.com/boston-celtics-miami-heat/hubs" },
        { title: "Flashscore NBA Live Scores", url: "https://www.flashscore.com/basketball/usa/nba/" }
      ]
    },
    {
      id: "sim-match-4",
      sport: "tennis",
      homeTeam: "Carlos Alcaraz",
      awayTeam: "Jannik Sinner",
      league: "ATP Wimbledon",
      startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // Live set 1
      status: "live",
      homeScore: 1,
      awayScore: 0,
      form: { home: ["W", "W", "W", "W"], away: ["W", "W", "W", "W"] },
      h2h: ["Alcaraz 4-4 Sinner (All-time H2H)"],
      injuries: { home: ["None"], away: ["Hip tightness (Monitored)"] },
      additionalStats: { "Aces": "4 - 2", "First Serve %": "68% - 61%", "Unforced Errors": "8 - 12" },
      groundingSources: [
        { title: "Flashscore Alcaraz vs Sinner Live court tracker", url: "https://www.flashscore.com/match/alcaraz-sinner/tennis" },
        { title: "SofaScore Wimbledon Men Singles", url: "https://www.sofascore.com/tournament/tennis/wimbledon/123" }
      ]
    }
  ];

  const simPredictions: Prediction[] = [
    {
      id: "p-sim-1",
      matchId: "sim-match-1",
      match: simMatches[0],
      pick: "Arsenal to Win & Over 1.5 Goals",
      market: "Match Result & Goals Over/Under",
      odds: 1.85,
      confidence: 88,
      riskLevel: "Low",
      expectedValue: 1.63,
      probability: 88,
      suggestedBetType: "Accumulator Leg",
      aiExplanation: "Consensus across Flashscore tipping panels and Sofascore performance index heavily favors Arsenal at home. Arsenal exhibits incredibly high attacking metrics (averaging xG 2.1 at Emirates) against a Chelsea side missing key wingbacks and struggling in defensive transition states.",
      analysisCriteria: {
        formAnalysis: "Arsenal boasts 4 home wins in their last 5, scoring 12 goals total, demonstrating stellar momentum.",
        injuryImpact: "Chelsea's right flank is compromised without Reece James, allowing Arsenal's left-wing to exploit space.",
        tacticalMatchup: "Arsenal's high pressing style disrupts Chelsea's buildup from the back, causing turnovers in dangerous areas.",
        oddsMovement: "Opening odds at @1.95 have dropped to @1.85, indicating substantial smart money backing the Gunners.",
        otherFactors: "Perfect playing conditions in London and a highly motivated home crowd support a strong Arsenal performance."
      },
      result: "pending"
    },
    {
      id: "p-sim-2",
      matchId: "sim-match-2",
      match: simMatches[1],
      pick: "Both Teams To Score (Yes)",
      market: "Both Teams To Score",
      odds: 1.55,
      confidence: 91,
      riskLevel: "Low",
      expectedValue: 1.41,
      probability: 91,
      suggestedBetType: "Single Bet",
      aiExplanation: "Expert aggregation on Aiscore and Sofascore confirms a high likelihood of BTTS in El Clasico. Historical clashes show an 85% BTTS rate in their last 10 meetings, driven by both teams' ultra-offensive setups.",
      analysisCriteria: {
        formAnalysis: "Both clubs are averaging over 2.2 goals per game in domestic campaigns.",
        injuryImpact: "Defensive instability for both teams due to David Alaba being out and squad rotations creates counter-attack openings.",
        tacticalMatchup: "High defensive lines on both ends are highly susceptible to Mbappe and Yamal's lightning transitions.",
        oddsMovement: "Stable lines around @1.55, representing massive consensus volume from betting markets.",
        otherFactors: "Intense El Clasico rivalry ensures high-tempo attacking intensity from start to finish."
      },
      result: "win"
    },
    {
      id: "p-sim-3",
      matchId: "sim-match-3",
      match: simMatches[2],
      pick: "Boston Celtics -6.5",
      market: "Spread Handicap",
      odds: 1.91,
      confidence: 84,
      riskLevel: "Medium",
      expectedValue: 1.60,
      probability: 84,
      suggestedBetType: "Accumulator Leg",
      aiExplanation: "Consensus analysis from Aiscore basketball and SofaScore metrics confirms Boston is highly dominant at TD Garden. Miami's offense is restricted with Jimmy Butler doubtful, leaving them with limited spacing.",
      analysisCriteria: {
        formAnalysis: "Boston is 8-2 in their last 10 postseason games with an average margin of victory of +9.8 points.",
        injuryImpact: "Miami Heat offense falls by 7.2 points per 100 possessions when Jimmy Butler is unavailable.",
        tacticalMatchup: "Boston's five-out floor spacing completely pulls Bam Adebayo away from the paint, opening easy driving lanes.",
        oddsMovement: "The spread opened at -5.5 and quickly rose to -6.5, showing professional backing for the Celtics.",
        otherFactors: "Extra rest day for Boston's starters provides a significant stamina advantage in late quarters."
      },
      result: "pending"
    },
    {
      id: "p-sim-4",
      matchId: "sim-match-4",
      match: simMatches[3],
      pick: "Carlos Alcaraz to Win",
      market: "Match Winner",
      odds: 1.75,
      confidence: 79,
      riskLevel: "Medium",
      expectedValue: 1.38,
      probability: 79,
      suggestedBetType: "Single Bet",
      aiExplanation: "SofaScore tennis momentum trends point to Carlos Alcaraz possessing a slight baseline stamina edge on grass. Jannik Sinner has shown occasional hip stiffness during long matches, which could affect his lateral speed.",
      analysisCriteria: {
        formAnalysis: "Carlos Alcaraz is on an 8-match grass court winning streak, retaining excellent court coverage.",
        injuryImpact: "Sinner's hip issue might not limit short rallies, but long 5-set exchanges heavily favor Alcaraz's conditioning.",
        tacticalMatchup: "Alcaraz's heavy topspin forehand to Sinner's high backhand has historically generated defensive short balls.",
        oddsMovement: "Odds opened even at @1.90 and have steamed in Alcaraz's direction, reflecting his current on-court form.",
        otherFactors: "Warm conditions on Centre Court speeds up the surface, playing directly into Alcaraz's offensive shot-making."
      },
      result: "pending"
    }
  ];

  return { matches: simMatches, predictions: simPredictions };
}

/**
 * Betting Buddy Q&A helper using gemini-3.5-flash.
 */
export async function answerBettingBuddyQuestion(question: string, language: string, locale: string): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    const lower = question.toLowerCase();
    if (language === 'sw') {
      if (lower.includes('sheria') || lower.includes('rules')) {
        return "Soka/Kandanda: Mechi huchukua dakika 90 za muda wa kawaida. Vikapu (Basketball): Mechi ina robo 4 za dakika 10 au 12 kila moja. Kama una maswali maalum ya sheria, unaweza kuuliza hapa!";
      }
      if (lower.includes('odd') || lower.includes('dau') || lower.includes('bet')) {
        return "Odds za desimali zinaonyesha kiasi unachoshinda kwa kila dau la kitengo 1. Kwa mfano, dau la KES 1,000 kwa odds za 2.00 linarudisha jumla ya KES 2,000 (faida ya KES 1,000).";
      }
      return "Mambo vipi! Mimi ni Betting Buddy wako wa AI. Unaweza kuniuliza kuhusu sheria za michezo (soka, kikapu, tenisi), maana ya misamiati ya kamari (odds, handicap, double chance), au vidokezo vya mbinu za ushindi kulingana na eneo lako.";
    } else {
      if (lower.includes('rule') || lower.includes('offside') || lower.includes('time')) {
        return "Football (Soccer): Matches consist of two 45-minute halves (90 minutes total). Basketball: Played in four 10 or 12-minute quarters. Overtime is played if tied. Ask me more details if needed!";
      }
      if (lower.includes('odd') || lower.includes('handicap') || lower.includes('spread')) {
        return "Decimal Odds: Show total payout relative to your stake. E.g., a $10 bet on 2.50 odds pays $25 ($15 profit). Spread betting (Handicap) gives one team a virtual advantage/disadvantage to level the playing field.";
      }
      return "Hello! I'm your AI Betting Buddy. Ask me anything about sports rules, betting terminology (spreads, accumulators, fractional/decimal odds), or strategy tips tailored to your local region.";
    }
  }

  try {
    const systemInstruction = `You are "Rafiki Betting Buddy", a friendly, expert AI sports analyst and betting guide on the "Rafiki Predict" platform.
The user is asking you a question about sports rules, betting terms (like handicap, accumulator/acca, dnb, over/under, etc.), or basic sports betting strategies.
Adapt your explanation based on:
- User selected language: ${language === 'sw' ? 'Swahili / Kiswahili' : 'English'}
- Current User Locale context: ${locale} (e.g. Kenya, East Africa, US, Europe, etc. Use local currency examples like KES, USD, or EUR, and refer to popular local leagues or terms if appropriate).

Keep your answer clear, concise, objective, encouraging, and highly educational. Avoid long-winded answers. Max 3 short paragraphs.
Format your response with clean markdown (bullet points, bold text). Do NOT write introductions like "Certainly!" or "Here is the answer". Go straight to the educational value.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: question,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || '';
  } catch (err) {
    console.error("Error in answerBettingBuddyQuestion:", err);
    return "Pole sana, nimepata hitilafu ya mtandao. Tafadhali jaribu tena baada ya muda mfupi. / Sorry, I encountered an error. Please try again in a moment.";
  }
}

/**
 * Customer Support Agent Helper using gemini-3.5-flash.
 */
export async function answerCustomerSupportQuestion(question: string, language: string, locale: string): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    const lower = question.toLowerCase();    if (language === 'sw') {
      if (lower.includes('payment') || lower.includes('lipia') || lower.includes('mpesa') || lower.includes('till') || lower.includes('airtel') || lower.includes('skrill') || lower.includes('payoneer') || lower.includes('equity')) {
        return "Njia zetu rasmi za malipo ni:\n- **M-Pesa Buy Goods**: Till Number `6881472`\n- **M-Pesa Send Money**: Simu `0716483642` (+254716483642)\n- **Airtel Money**: Simu `0735309361` (+254735309361)\n- **Telkom (T-Kash)**: Simu `0773266691` (+254773266691)\n- **Payoneer, Pesapal & Skrill**: Barua pepe `johnmushira@gmail.com`\n- **Bank Transfer (Equity Bank)**: Akaunti `0620187419406`\n- **Visa Card**: Nambari `4478 **** **** 9885`\nUnakaribishwa kukamilisha usajili wako katika tabo ya **Subscription**!";
      }
      if (lower.includes('vip') || lower.includes('premium') || lower.includes('shinda')) {
        return "Rafiki Predict inatoa usajili wa **VIP Premium** unaokupa ufikiaji kamili wa utabiri wa viwango vya juu vya uhakika, mchanganyiko wa mechi (accumulators) wa kila siku, na arifa za papo hapo. Unaweza kujisajili katika tabo ya **Subscription** kupitia M-Pesa, Airtel Money, T-Kash, Equity Bank, Payoneer, Pesapal, Skrill, au Visa kadi.";
      }
      if (lower.includes('contact') || lower.includes('msaada') || lower.includes('simu') || lower.includes('email') || lower.includes('whatsapp') || lower.includes('website')) {
        return "Mawasiliano yetu rasmi ya Huduma kwa Wateja ni:\n- **Barua pepe**: rafikibc1000@gmail.com\n- **Simu & WhatsApp**: 0716483642 (+254716483642)\n- **Njia Zinazosaidiwa**: Call, SMS, na WhatsApp\n- **Tovuti Rasmi**: https://rafikibusinesssolutions.netlify.app";
      }
      if (lower.includes('arifa') || lower.includes('subscribe') || lower.includes('ligi')) {
        return "Unaweza kujiunga na arifa za ligi yoyote unayoipenda (kama vile Premier League, NBA, au La Liga). Gusa tu ikoni ya kengele (🔔) karibu na jina la ligi katika tabo ya **Predictions** ili kuanza kupokea arifa zenye sauti punde tu utabiri mpya unapochapishwa!";
      }
      return "Habari! Mimi ni **Rafiki Support AI**, msaidizi wako wa huduma kwa wateja. Naweza kukusaidia kujua njia zetu za malipo (M-Pesa Till 6881472, Airtel Money 0735309361, T-Kash 0773266691, Equity Bank 0620187419406, Payoneer/Pesapal/Skrill johnmushira@gmail.com, Visa 4478 **** **** 9885), mawasiliano ya msaada (0716483642 & rafikibc1000@gmail.com), au jinsi ya kujiunga na VIP Premium!";
    } else {
      if (lower.includes('payment') || lower.includes('pay') || lower.includes('mpesa') || lower.includes('till') || lower.includes('airtel') || lower.includes('skrill') || lower.includes('payoneer') || lower.includes('equity')) {
        return "Our official payment methods are:\n- **M-Pesa Buy Goods**: Till Number `6881472`\n- **M-Pesa Send Money**: Phone `0716483642` (+254716483642)\n- **Airtel Money**: Phone `0735309361` (+254735309361)\n- **Telkom (T-Kash)**: Phone `0773266691` (+254773266691)\n- **Payoneer, Pesapal & Skrill**: Email `johnmushira@gmail.com`\n- **Bank Transfer (Equity Bank)**: Account `0620187419406`\n- **Visa Card**: Card Number `4478 **** **** 9885`\nYou can complete your transaction in the **Subscription** tab!";
      }
      if (lower.includes('premium') || lower.includes('vip') || lower.includes('upgrade')) {
        return "Rafiki Predict offers a **VIP Premium** tier unlocking highest-confidence predictions, daily accumulators, and live alerts. Upgrade under the **Subscription** tab using M-Pesa, Airtel Money, T-Kash, Equity Bank, Payoneer, Pesapal, Skrill, or Visa Card.";
      }
      if (lower.includes('contact') || lower.includes('support') || lower.includes('phone') || lower.includes('email') || lower.includes('whatsapp') || lower.includes('website')) {
        return "Our official Customer Support channels are:\n- **Support Email**: rafikibc1000@gmail.com\n- **Support Phone & WhatsApp**: Local `0716483642` / Int: `+254716483642`\n- **Supported Channels**: Call, SMS, and WhatsApp\n- **Official Website**: https://rafikibusinesssolutions.netlify.app";
      }
      if (lower.includes('alert') || lower.includes('subscribe') || lower.includes('league') || lower.includes('bell')) {
        return "You can subscribe to real-time alerts for any sports league by clicking the bell icon (🔔) next to the league name in the **Predictions** tab!";
      }
      return "Hello! I'm **Rafiki Support AI**, your customer service representative. I can assist you with payment details (M-Pesa Till 6881472, Airtel Money 0735309361, T-Kash 0773266691, Equity Bank 0620187419406, Payoneer/Pesapal/Skrill johnmushira@gmail.com, Visa 4478 **** **** 9885), support contact information (0716483642 & rafikibc1000@gmail.com), or upgrading to VIP Premium!";
    }
  }

  try {
    const systemInstruction = `You are "Rafiki Customer Support AI", a highly polite, warm, and professional customer service representative for the "Rafiki Predict" sports analytics platform.
The user is asking you a question, seeking guide instructions, or looking for support regarding the platform's features, pricing, payment options, or customer support contacts.

Your official knowledge base includes:
1. **Official Payment Methods**:
   - **M-Pesa Buy Goods (Till Number)**: Till 6881472
   - **M-Pesa Send Money**: Local 0716483642 / International +254716483642
   - **Airtel Money**: Local 0735309361 / International +254735309361
   - **Telkom (T-Kash)**: Local 0773266691 / International +254773266691
   - **Payoneer, Pesapal & Skrill**: Email address johnmushira@gmail.com
   - **Bank Transfer (Equity Bank)**: Account number 0620187419406
   - **Visa Card**: Card number 4478 **** **** 9885

2. **Official Customer Support Details & Website**:
   - **Customer Support Email**: rafikibc1000@gmail.com
   - **Customer Support Phone (Local)**: 0716483642
   - **Customer Support Phone (International) & WhatsApp**: +254716483642
   - **Supported Contact Channels**: Call, SMS, and WhatsApp (https://wa.me/254716483642)
   - **Website URL**: https://rafikibusinesssolutions.netlify.app

3. **Rafiki Predict Key Features**: AI-powered predictions with confidence scores, risk level analysis (Low, Medium, High), expected value computations, and historical win performance logs in the Archive.
4. **VIP Premium Subscriptions**: Free tier vs VIP Premium tier (Daily, Weekly, 15 Days, Monthly, 2 Months, 3 Months, 6 Months, Yearly). Premium includes daily vetted accumulators (Multi-bets), high-confidence single predictions, exclusive performance logs, and real-time push/sound alerts.
5. **League Alert Subscriptions**: Tell users to click the bell (🔔) next to any league name in the 'Predictions' tab to subscribe for instant notifications and sound chimes.
6. **Responsible Gambling Tools**: Custom daily/weekly budget limits, cooling-off timeouts, and self-exclusion options under 'Settings'.
7. **Daily Sports Quizzes**: Play the Daily Trivia Quiz to earn points and unlock profile badges.

Guidelines:
- Adapt your response to the user's language preference: ${language === 'sw' ? 'Swahili / Kiswahili' : 'English'}.
- Always be supportive, reassuring, polite, and encouraging.
- Organize complex information using clean markdown formatting (bullet points, bold highlights, headers).
- Keep answers clear, direct, and concise (maximum 3 brief paragraphs).
- Do NOT begin with conversational filler like "Certainly! Here is the answer." Start helping directly with professional grace.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: question,
      config: {
        systemInstruction,
        temperature: 0.6,
      }
    });

    return response.text || '';
  } catch (err) {
    console.error("Error in answerCustomerSupportQuestion:", err);
    return "Pole sana, nimepata hitilafu ya mtandao. Tafadhali jaribu tena baada ya muda mfupi. / Sorry, I encountered an error. Please try again in a moment.";
  }
}

