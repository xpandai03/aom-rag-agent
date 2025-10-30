"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  FileUp,
  MonitorIcon,
  CircleUserRound,
  ArrowUpIcon,
  Paperclip,
  Code2,
  Palette,
  Layers,
  Rocket,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface AutoResizeProps {
  minHeight: number;
  maxHeight?: number;
}

interface Citation {
  title: string;
  url: string;
  relevance: number;
  snippet: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

function useAutoResizeTextarea({ minHeight, maxHeight }: AutoResizeProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`; // reset first
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Infinity)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

export default function RuixenMoonChat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 48,
    maxHeight: 150,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Handle message submission with streaming
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage("");
    adjustHeight(true);

    // Add user message to the conversation
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setStreamingContent("");

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // Call the chat API with streaming
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to get response");
      }

      // Extract citations from headers
      const citationsHeader = response.headers.get("X-Citations");
      let citations: Citation[] = [];
      if (citationsHeader) {
        try {
          citations = JSON.parse(decodeURIComponent(citationsHeader));
        } catch (e) {
          console.warn("Failed to parse citations:", e);
        }
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;
          setStreamingContent(accumulatedContent);
        }
      }

      // Add assistant message with citations
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: accumulatedContent,
          citations: citations.length > 0 ? citations : undefined,
        },
      ]);
      setStreamingContent("");
    } catch (error: any) {
      console.error("Error:", error);

      if (error.name === "AbortError") {
        console.log("Request was cancelled");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error.message || "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Handle Enter key submission (Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Handle quick action clicks
  const handleQuickAction = (actionLabel: string) => {
    setMessage(actionLabel);
    adjustHeight();
  };

  // Show chat view if there are messages
  const showChatView = messages.length > 0 || isLoading;

  return (
    <div
      className={cn(
        "relative w-full flex flex-col",
        showChatView ? "h-full min-h-screen" : "h-screen"
      )}
    >
      {!showChatView ? (
        // Hero View - Initial Landing
        <>
          {/* Centered AI Title */}
          <div className="flex-1 w-full flex flex-col items-center justify-center px-4">
            <div className="text-center max-w-2xl">
              <div className="flex justify-center mb-4">
                <img
                  src="/AOM-logo.png"
                  alt="Art of Manliness"
                  className="h-32 w-auto md:h-40 object-contain"
                />
              </div>
              <div className="w-24 h-0.5 bg-accent-red mx-auto mb-4"></div>
              <p className="text-lg text-brown-text font-body">
                Search through Brett McKay's archive — just start typing below.
              </p>
            </div>
          </div>

          {/* Input Box Section */}
          <div className="w-full max-w-3xl mx-auto mb-[20vh] px-4">
            <form onSubmit={handleSubmit}>
              <div className="relative bg-soft-white rounded-xl border border-border-beige editorial-shadow">
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    adjustHeight();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your request..."
                  className={cn(
                    "w-full px-4 py-3 resize-none border-none",
                    "bg-transparent text-brown-text text-sm font-body",
                    "focus-visible:ring-1 focus-visible:ring-accent-red focus-visible:ring-offset-0",
                    "placeholder:text-brown-text/50 min-h-[48px]"
                  )}
                  style={{ overflow: "hidden" }}
                />

                {/* Footer Buttons */}
                <div className="flex items-center justify-between p-3 border-t border-accent-red">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-brown-text hover:bg-light-beige"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      variant="ghost"
                      disabled={!message.trim() || isLoading}
                      className="aom-send-button"
                    >
                      <ArrowUpIcon className="w-4 h-4 text-white" />
                      <span className="sr-only">Send</span>
                    </Button>
                  </div>
                </div>
              </div>
            </form>

            {/* Quick Actions */}
            <div className="flex items-center justify-center flex-wrap gap-3 mt-6">
              <QuickAction
                icon={<Code2 className="w-4 h-4" />}
                label="What articles discuss discipline?"
                onClick={() =>
                  handleQuickAction("What articles discuss discipline?")
                }
              />
              <QuickAction
                icon={<Rocket className="w-4 h-4" />}
                label="Show podcast episodes on stoicism"
                onClick={() =>
                  handleQuickAction("Show podcast episodes on stoicism")
                }
              />
              <QuickAction
                icon={<Layers className="w-4 h-4" />}
                label="Find content about productivity"
                onClick={() =>
                  handleQuickAction("Find content about productivity")
                }
              />
              <QuickAction
                icon={<Palette className="w-4 h-4" />}
                label="Articles about fitness routines"
                onClick={() =>
                  handleQuickAction("Articles about fitness routines")
                }
              />
            </div>
          </div>
        </>
      ) : (
        // Chat View - Conversation Interface
        <div className="flex flex-col h-screen max-w-4xl mx-auto w-full">
          {/* Header */}
          <div className="bg-cream border-b-2 border-border-beige px-6 py-5 editorial-shadow">
            <div className="flex justify-center">
              <img
                src="/AOM-logo.png"
                alt="Art of Manliness"
                className="h-24 w-auto md:h-28 object-contain"
              />
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto px-6 py-8 pb-4 space-y-6">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-accent-red/10 flex items-center justify-center flex-shrink-0">
                    <CircleUserRound className="w-5 h-5 text-accent-red" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[70%] rounded-xl px-5 py-4 editorial-shadow",
                    msg.role === "user"
                      ? "bg-soft-white border border-border-beige"
                      : "bg-muted-beige border-l-4 border-accent-red"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="font-display font-semibold text-accent-red mb-2 text-sm">
                      Brett McKay Archive AI
                    </div>
                  )}
                  <div
                    className={cn(
                      "text-sm leading-relaxed whitespace-pre-wrap font-body",
                      msg.role === "user" ? "text-brown-text" : "text-foreground"
                    )}
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent-red hover:text-dark-red underline">$1</a>')
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />

                  {/* Citations */}
                  {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border-beige">
                      <p className="text-xs text-brown-text font-semibold mb-2 font-body uppercase tracking-wide">Sources:</p>
                      <div className="space-y-2">
                        {msg.citations.map((citation, idx) => (
                          <a
                            key={idx}
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-accent-red hover:text-dark-red hover:underline flex items-center gap-1 font-body"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{citation.title}</span>
                            <span className="text-brown-text/60">
                              ({(citation.relevance * 100).toFixed(0)}% match)
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-brown-text/10 flex items-center justify-center flex-shrink-0">
                    <CircleUserRound className="w-5 h-5 text-brown-text" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming message */}
            {isLoading && streamingContent && (
              <div className="flex gap-4 justify-start animate-in fade-in duration-300">
                <div className="w-8 h-8 rounded-full bg-accent-red/10 flex items-center justify-center flex-shrink-0">
                  <CircleUserRound className="w-5 h-5 text-accent-red" />
                </div>
                <div className="bg-muted-beige border-l-4 border-accent-red rounded-xl px-5 py-4 max-w-[70%] editorial-shadow">
                  <div className="font-display font-semibold text-accent-red mb-2 text-sm">
                    Brett McKay Archive AI
                  </div>
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap font-body text-foreground"
                    dangerouslySetInnerHTML={{
                      __html: streamingContent
                        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent-red hover:text-dark-red underline">$1</a>')
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="flex gap-4 justify-start animate-in fade-in duration-300">
                <div className="w-8 h-8 rounded-full bg-accent-red/10 flex items-center justify-center flex-shrink-0">
                  <CircleUserRound className="w-5 h-5 text-accent-red" />
                </div>
                <div className="bg-muted-beige border-l-4 border-accent-red rounded-xl px-5 py-4 editorial-shadow">
                  <Loader2 className="w-5 h-5 animate-spin text-accent-red" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box at Bottom */}
          <div className="bg-cream border-t-2 border-border-beige px-6 py-4">
            <form onSubmit={handleSubmit}>
              <div className="relative bg-soft-white rounded-xl border border-border-beige editorial-shadow">
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    adjustHeight();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your follow-up question..."
                  className={cn(
                    "w-full px-4 py-3 resize-none border-none",
                    "bg-transparent text-brown-text text-sm font-body",
                    "focus-visible:ring-1 focus-visible:ring-accent-red focus-visible:ring-offset-0",
                    "placeholder:text-brown-text/50 min-h-[48px]"
                  )}
                  style={{ overflow: "hidden" }}
                  disabled={isLoading}
                />

                {/* Footer Buttons */}
                <div className="flex items-center justify-between p-3 border-t border-accent-red">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-brown-text hover:bg-light-beige"
                    disabled={isLoading}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      variant="ghost"
                      disabled={!message.trim() || isLoading}
                      className="aom-send-button"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <ArrowUpIcon className="w-4 h-4 text-white" />
                      )}
                      <span className="sr-only">Send</span>
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function QuickAction({ icon, label, onClick }: QuickActionProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border-border-beige bg-soft-white text-brown-text hover:bg-light-beige hover:border-accent-red transition-all font-body"
    >
      <span className="text-accent-red">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
    </Button>
  );
}
