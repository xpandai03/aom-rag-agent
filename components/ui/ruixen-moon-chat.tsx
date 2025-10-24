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
        "relative w-full bg-cover bg-center flex flex-col",
        showChatView ? "h-full min-h-screen" : "h-screen"
      )}
      style={{
        backgroundImage:
          "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png')",
        backgroundAttachment: "fixed",
      }}
    >
      {!showChatView ? (
        // Hero View - Initial Landing
        <>
          {/* Centered AI Title */}
          <div className="flex-1 w-full flex flex-col items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-semibold text-white drop-shadow-sm">
                Private Knowledge GPT
              </h1>
              <p className="mt-2 text-neutral-200">
                Search through Brett McKay's archive — just start typing below.
              </p>
            </div>
          </div>

          {/* Input Box Section */}
          <div className="w-full max-w-3xl mx-auto mb-[20vh] px-4">
            <form onSubmit={handleSubmit}>
              <div className="relative bg-black/60 backdrop-blur-md rounded-xl border border-neutral-700">
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
                    "bg-transparent text-white text-sm",
                    "focus-visible:ring-0 focus-visible:ring-offset-0",
                    "placeholder:text-neutral-400 min-h-[48px]"
                  )}
                  style={{ overflow: "hidden" }}
                />

                {/* Footer Buttons */}
                <div className="flex items-center justify-between p-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-neutral-700"
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      disabled={!message.trim() || isLoading}
                      className={cn(
                        "flex items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                        message.trim() && !isLoading
                          ? "bg-white text-black hover:bg-neutral-200"
                          : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                      )}
                    >
                      <ArrowUpIcon className="w-4 h-4" />
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
        <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
          {/* Header */}
          <div className="bg-black/60 backdrop-blur-md border-b border-neutral-700 px-6 py-4">
            <h1 className="text-xl font-semibold text-white">
              Private Knowledge GPT
            </h1>
            <p className="text-sm text-neutral-300">
              Searching Brett McKay's archive
            </p>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-4",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <CircleUserRound className="w-5 h-5 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-3",
                    msg.role === "user"
                      ? "bg-white text-black"
                      : "bg-black/60 backdrop-blur-md text-white border border-neutral-700"
                  )}
                >
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: msg.content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />

                  {/* Citations */}
                  {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-neutral-600">
                      <p className="text-xs text-neutral-400 font-semibold mb-2">Sources:</p>
                      <div className="space-y-2">
                        {msg.citations.map((citation, idx) => (
                          <a
                            key={idx}
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{citation.title}</span>
                            <span className="text-neutral-500">
                              ({(citation.relevance * 100).toFixed(0)}% match)
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                    <CircleUserRound className="w-5 h-5 text-black" />
                  </div>
                )}
              </div>
            ))}

            {/* Streaming message */}
            {isLoading && streamingContent && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <CircleUserRound className="w-5 h-5 text-white" />
                </div>
                <div className="bg-black/60 backdrop-blur-md text-white border border-neutral-700 rounded-2xl px-4 py-3 max-w-[70%]">
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: streamingContent.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.*?)\*/g, "<em>$1</em>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !streamingContent && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <CircleUserRound className="w-5 h-5 text-white" />
                </div>
                <div className="bg-black/60 backdrop-blur-md text-white border border-neutral-700 rounded-2xl px-4 py-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box at Bottom */}
          <div className="bg-black/60 backdrop-blur-md border-t border-neutral-700 px-6 py-4">
            <form onSubmit={handleSubmit}>
              <div className="relative bg-black/60 backdrop-blur-md rounded-xl border border-neutral-700">
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
                    "bg-transparent text-white text-sm",
                    "focus-visible:ring-0 focus-visible:ring-offset-0",
                    "placeholder:text-neutral-400 min-h-[48px]"
                  )}
                  style={{ overflow: "hidden" }}
                  disabled={isLoading}
                />

                {/* Footer Buttons */}
                <div className="flex items-center justify-between p-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-neutral-700"
                    disabled={isLoading}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      disabled={!message.trim() || isLoading}
                      className={cn(
                        "flex items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                        message.trim() && !isLoading
                          ? "bg-white text-black hover:bg-neutral-200"
                          : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowUpIcon className="w-4 h-4" />
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
      className="flex items-center gap-2 rounded-full border-neutral-700 bg-black/50 text-neutral-300 hover:text-white hover:bg-neutral-700"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}
