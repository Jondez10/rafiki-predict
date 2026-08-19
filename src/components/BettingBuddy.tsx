import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Sparkles, MessageSquare, BookOpen, AlertCircle, HelpCircle } from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'buddy';
  text: string;
  timestamp: Date;
}

interface BettingBuddyProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'sw';
  translations: any;
}

const getLocaleDetails = () => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Nairobi";
    const userLang = navigator.language || "en-KE";
    return `${timezone} (${userLang})`;
  } catch (_) {
    return "Africa/Nairobi (en-KE)";
  }
};

export default function BettingBuddy({ isOpen, onClose, language, translations }: BettingBuddyProps) {
  const t = translations;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rafiki-buddy-chat-v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })));
      } else {
        // Load initial welcome message
        setMessages([
          {
            id: 'welcome',
            sender: 'buddy',
            text: t.buddyWelcome,
            timestamp: new Date()
          }
        ]);
      }
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  }, [t.buddyWelcome]);

  // Save chat history to localStorage when messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('rafiki-buddy-chat-v1', JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/betting-buddy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: textToSend,
          language,
          locale: getLocaleDetails()
        })
      });

      if (!response.ok) {
        throw new Error("API call failed");
      }

      const data = await response.json();
      
      const buddyMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'buddy',
        text: data.answer || t.buddyError,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, buddyMessage]);
    } catch (err) {
      console.error("Error sending message to Betting Buddy:", err);
      const errorMessage: Message = {
        id: `msg-err-${Date.now()}`,
        sender: 'buddy',
        text: t.buddyError,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestionKey: 'buddyRuleTip' | 'buddyTermTip' | 'buddyStrategyTip') => {
    const promptText = t[suggestionKey];
    if (promptText) {
      handleSend(promptText);
    }
  };

  const clearChat = () => {
    if (window.confirm(language === 'sw' ? 'Futa mazungumzo yote?' : 'Clear all conversation history?')) {
      const welcomeMsg = {
        id: 'welcome',
        sender: 'buddy',
        text: t.buddyWelcome,
        timestamp: new Date()
      };
      setMessages([welcomeMsg]);
      localStorage.removeItem('rafiki-buddy-chat-v1');
    }
  };

  // Safe client-side markdown formatter
  const formatMessageText = (text: string) => {
    const parseBold = (raw: string) => {
      const parts = raw.split(/\*\*([^*]+)\*\*/g);
      return parts.map((part, idx) => {
        if (idx % 2 === 1) {
          return <strong key={idx} className="font-semibold text-amber-300 font-mono">{part}</strong>;
        }
        return part;
      });
    };

    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;

      // Lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-gray-200 text-xs mb-1 leading-relaxed">
            {parseBold(trimmed.substring(2))}
          </li>
        );
      }

      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numberedMatch) {
        return (
          <li key={idx} className="ml-4 list-decimal text-gray-200 text-xs mb-1 leading-relaxed">
            {parseBold(numberedMatch[2])}
          </li>
        );
      }

      // Normal paragraph
      return (
        <p key={idx} className="text-xs text-gray-200 mb-1.5 leading-relaxed break-words">
          {parseBold(trimmed)}
        </p>
      );
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dark Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50 cursor-pointer"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gray-950 border-l border-gray-900 shadow-2xl flex flex-col z-50"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-900 bg-gray-950/80 backdrop-blur flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 rounded-lg">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-100 tracking-tight flex items-center gap-2">
                    {t.bettingBuddy}
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                  </h3>
                  <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{getLocaleDetails()}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {messages.length > 1 && (
                  <button 
                    onClick={clearChat}
                    className="text-[10px] font-mono text-gray-500 hover:text-red-400 px-2 py-1 rounded transition-colors"
                  >
                    {language === 'sw' ? 'Futa' : 'Clear'}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-400 hover:text-gray-100 bg-gray-900/60 hover:bg-gray-900 border border-gray-800/60 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl text-xs shadow-sm border ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-100 rounded-tr-none'
                        : 'bg-gray-900/80 border-gray-800/80 text-gray-200 rounded-tl-none'
                    }`}
                  >
                    {msg.sender === 'buddy' ? (
                      <div>
                        {formatMessageText(msg.text)}
                      </div>
                    ) : (
                      <p className="leading-relaxed break-words">{msg.text}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-gray-600 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {/* Suggestions Panel (Visible when only welcome msg exists) */}
              {messages.length === 1 && (
                <div className="pt-4 space-y-2.5">
                  <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-emerald-500" />
                    {language === 'sw' ? 'Mada Zilizopendekezwa' : 'Suggested Topics'}
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => handleSuggestionClick('buddyRuleTip')}
                      className="text-left px-3.5 py-2.5 bg-gray-900/40 hover:bg-gray-900 border border-gray-800 hover:border-emerald-500/30 rounded-xl text-xs text-gray-300 hover:text-gray-100 transition-all flex items-center gap-2 group cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span>{t.buddyRuleTip}</span>
                    </button>
                    <button
                      onClick={() => handleSuggestionClick('buddyTermTip')}
                      className="text-left px-3.5 py-2.5 bg-gray-900/40 hover:bg-gray-900 border border-gray-800 hover:border-emerald-500/30 rounded-xl text-xs text-gray-300 hover:text-gray-100 transition-all flex items-center gap-2 group cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>{t.buddyTermTip}</span>
                    </button>
                    <button
                      onClick={() => handleSuggestionClick('buddyStrategyTip')}
                      className="text-left px-3.5 py-2.5 bg-gray-900/40 hover:bg-gray-900 border border-gray-800 hover:border-emerald-500/30 rounded-xl text-xs text-gray-300 hover:text-gray-100 transition-all flex items-center gap-2 group cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                      <span>{t.buddyStrategyTip}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Thinking Indicator */}
              {loading && (
                <div className="flex flex-col max-w-[85%] mr-auto items-start">
                  <div className="px-4 py-3 bg-gray-900/80 border border-gray-800/80 rounded-2xl rounded-tl-none text-xs text-gray-400 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-[11px]">{t.buddyThinking}</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-4 border-t border-gray-900 bg-gray-950">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="relative flex items-center"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.askBuddyPlaceholder}
                  disabled={loading}
                  className="w-full bg-gray-900/60 border border-gray-800/60 focus:border-emerald-500/30 focus:outline-none rounded-xl pl-4 pr-12 py-3 text-xs text-gray-200 placeholder-gray-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="absolute right-2 p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-950/20 rounded-lg cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <p className="text-[9px] font-mono text-gray-600 text-center mt-2">
                Rafiki Betting Buddy utilizes the Google Gemini API • {language === 'sw' ? 'Majibu ni miongozo ya kujifunza tu' : 'Responses are educational guides only'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
