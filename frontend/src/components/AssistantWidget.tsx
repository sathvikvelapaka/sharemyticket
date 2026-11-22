import React, { useState } from 'react';
import { Bot, X, Send, Sparkles, ShieldAlert, BookOpen } from 'lucide-react';
import { apiRequest } from '../services/api';

export const AssistantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; source?: string }>>([
    {
      sender: 'assistant',
      text: 'Hello! I am your TrustPass Policy & Transfer Assistant. Ask me anything about fair pricing (80% rule), authorized BookMyShow transfers, or how our request-approval model protects you from fraud.',
      source: 'TrustPass Security Knowledge Base',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const quickPrompts = [
    'How do I sell a ticket?',
    'How does ticket transfer work?',
    'Why was my listing rejected?',
    'How do I request a refund?',
  ];

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = textToSend.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const data = await apiRequest('/assistant/chat', {
        method: 'POST',
        body: { query: userMsg },
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: data.reply,
          source: data.source || 'TrustPass Platform Policy',
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Sorry, I encountered an issue retrieving the official policy. Please check back shortly.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-full shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Bot className="w-5 h-5" />
          <span className="font-semibold text-sm">TrustPass AI Support</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-96 flex flex-col h-[520px] overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold">TrustPass AI Assistant</h4>
                <p className="text-[11px] text-slate-400 flex items-center">
                  <Sparkles className="w-3 h-3 text-emerald-400 mr-1" />
                  Official Platform Guardrails
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 overflow-x-auto whitespace-nowrap flex space-x-1.5 scrollbar-thin">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                className="text-[11px] bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-600 px-2.5 py-1 rounded-full transition flex-shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200'
                  }`}
                >
                  {msg.text}
                </div>
                {msg.source && (
                  <span className="text-[10px] text-slate-400 mt-1 flex items-center">
                    <BookOpen className="w-2.5 h-2.5 mr-1" />
                    {msg.source}
                  </span>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center space-x-1 text-slate-400 text-xs pl-2">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce [animation-delay:0.2s]">●</span>
                <span className="animate-bounce [animation-delay:0.4s]">●</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about transfer, 80% price cap..."
              className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white p-2 rounded-xl transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
