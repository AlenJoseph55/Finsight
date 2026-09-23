"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  CornerDownRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { askCopilot, clearCopilotHistory } from "../lib/api";
import { ChatMessage } from "../lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatPanelProps {
  portfolioId?: number;
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
}

const STARTER_QUESTIONS = [
  "Why is my IT allocation high?",
  "Compare my top funds",
  "Explain my sector allocation",
  "What are the risks in my portfolio?",
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  portfolioId,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  isEmbedded = false,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openCitationId, setOpenCitationId] = useState<string | null>(null);
  const [sessionId] = useState<string>(() => `sess_${Date.now()}`);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const onClose = controlledOnClose || (() => setInternalIsOpen(false));

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen || isEmbedded) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isEmbedded, messages]);

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend ?? inputQuery).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsLoading(true);

    try {
      const resp = await askCopilot(text, portfolioId, sessionId);
      const assistantMsg: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        role: "assistant",
        content: resp.answer,
        citations: resp.citations,
        follow_up_suggestions: resp.follow_up_suggestions,
        latency_ms: resp.latency_ms,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: "assistant",
        content:
          err.message ||
          "I ran into an issue finding that answer. Please try asking in a slightly different way.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      await clearCopilotHistory(sessionId);
      setMessages([]);
    } catch {
      setMessages([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderContent = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Header (Matching Panel 8) */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Research Copilot</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              Personalized
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Ask anything about your investments
          </p>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-50 transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {!isEmbedded && (
            <>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:inline-flex p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">How can I help today?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                I can break down your stock allocations, compare funds, and point out overlap.
              </p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block text-left">
                Suggested questions:
              </span>
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 text-xs font-medium text-slate-700 hover:text-emerald-800 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <span>{q}</span>
                  <CornerDownRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === "user";

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1.5`}
              >
                {/* Message Bubble */}
                {isUser ? (
                  <div className="max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed bg-emerald-50 text-emerald-950 border border-emerald-200/60 font-medium whitespace-pre-wrap">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed bg-slate-50/90 text-slate-800 border border-slate-200/80 shadow-2xs">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0 leading-relaxed text-slate-800">{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-bold text-slate-950">{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em className="italic text-slate-800">{children}</em>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-4 my-2 space-y-1 text-slate-800">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-4 my-2 space-y-1.5 text-slate-800">{children}</ol>
                        ),
                        li: ({ children }) => (
                          <li className="leading-relaxed pl-0.5">{children}</li>
                        ),
                        h1: ({ children }) => (
                          <h1 className="text-sm font-bold text-slate-900 my-2">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xs sm:text-sm font-bold text-slate-900 my-2">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xs font-bold text-slate-900 my-1.5">{children}</h3>
                        ),
                        code: ({ children }) => (
                          <code className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-900 font-mono text-[11px]">
                            {children}
                          </code>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="pl-3 border-l-2 border-emerald-500 my-2 italic text-slate-600">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2.5 rounded-xl border border-slate-200/80 bg-white">
                            <table className="min-w-full text-[11px] divide-y divide-slate-200">{children}</table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="px-2.5 py-1.5 bg-slate-100 font-semibold text-slate-800 text-left">{children}</th>
                        ),
                        td: ({ children }) => (
                          <td className="px-2.5 py-1.5 border-t border-slate-100 text-slate-700">{children}</td>
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Citations / Statements Referenced (Plain English) */}
                {m.citations && m.citations.length > 0 && (
                  <div className="max-w-[85%] w-full pt-1">
                    <button
                      onClick={() =>
                        setOpenCitationId(openCitationId === m.id ? null : m.id)
                      }
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3 h-3 text-slate-400" />
                      <span>{m.citations.length} statement passages referenced</span>
                      {openCitationId === m.id ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>

                    {openCitationId === m.id && (
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-slate-200">
                        {m.citations.map((c, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed"
                          >
                            <span className="font-semibold text-slate-800 block mb-0.5">
                              Excerpt {i + 1}
                            </span>
                            &ldquo;{c.content_preview}&rdquo;
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Follow-up Question Chips (Matching Panel 8) */}
                {m.follow_up_suggestions && m.follow_up_suggestions.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {m.follow_up_suggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(sug)}
                        className="px-3 py-1 rounded-full bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-[11px] font-medium text-slate-600 hover:text-emerald-800 transition-colors cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Consulting your investments...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Box */}
      <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-slate-50 border border-slate-200/80 focus-within:border-emerald-500 focus-within:bg-white transition-all shadow-xs">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none py-1"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer shrink-0"
            title="Send"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          FinSight Assistant answers using your actual statements · 100% Private
        </p>
      </div>
    </div>
  );

  // If embedded as a view in dashboard
  if (isEmbedded) {
    return (
      <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs h-[650px] max-w-3xl">
        {renderContent()}
      </div>
    );
  }

  // Floating Drawer Mode
  if (!isOpen) {
    return (
      <button
        onClick={() => setInternalIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-lg hover:shadow-xl transition-all cursor-pointer group"
      >
        <Sparkles className="w-4 h-4 text-emerald-400" />
        <span>Ask AI</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 bottom-0 w-full ${
          isExpanded ? "max-w-2xl" : "max-w-md"
        } bg-white border-l border-slate-200 shadow-2xl z-10 animate-in slide-in-from-right duration-200`}
      >
        {renderContent()}
      </div>
    </div>
  );
};
