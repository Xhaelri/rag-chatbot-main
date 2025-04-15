"use client";

import { useChat } from "@ai-sdk/react";
import { ArrowUp, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

const api = "/api/chat";

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api,
    });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Handle mobile detection
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        isMobile ? 150 : 200
      )}px`;
    }
  }, [input, isMobile]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 font-inter">
      {/* Header */}
      <header className="p-4 border-b bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-center">
          <h1 className="text-xl font-semibold font-aboreto">
            Craftsman Assistant
          </h1>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16">
              <Sparkles className="h-8 w-8 mb-4 text-indigo-500" />
              <div className="text-lg font-medium">
                How can I help you with Craftsman today?
              </div>
              <div className="mt-2 text-sm text-center max-w-md">
                Ask me questions about Craftsman services, how the platform
                works, or getting help with tasks.
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-3 max-w-[85%] shadow-sm ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <div
                          key={`${message.id}-${i}`}
                          className={`prose prose-sm ${
                            message.role === "user"
                              ? "prose-invert max-w-none"
                              : "max-w-none dark:prose-invert"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <div className="flex gap-2 items-start">
                              <div className="h-8 w-8 p-1.5 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                                <Sparkles className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <ReactMarkdown
                                  components={{
                                    code({
                                      node,
                                      inline,
                                      className,
                                      children,
                                      ...props
                                    }: {
                                      node: any;
                                      inline?: boolean;
                                      className?: string;
                                      children: React.ReactNode;
                                      [key: string]: any;
                                    }) {
                                      const match = /language-(\w+)/.exec(
                                        className || ""
                                      );
                                      return !inline && match ? (
                                        <SyntaxHighlighter
                                          style={atomDark}
                                          language={match[1]}
                                          PreTag="div"
                                          {...props}
                                        >
                                          {String(children).replace(/\n$/, "")}
                                        </SyntaxHighlighter>
                                      ) : (
                                        <code className={className} {...props}>
                                          {children}
                                        </code>
                                      );
                                    },
                                  }}
                                >
                                  {part.text}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ) : (
                            part.text
                          )}
                        </div>
                      );
                  }
                })}
                <div className="text-xs mt-1 opacity-70 text-right">
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-300 animate-spin" />
                  </div>
                  <div className="text-sm text-slate-500">Thinking...</div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 pb-6 bg-white dark:bg-slate-800 border-t">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2 border p-2 rounded-xl bg-white dark:bg-slate-700 shadow-sm"
        >
          <Textarea
            ref={textareaRef}
            className="flex-1 border-none resize-none min-h-[40px] max-h-[200px] focus:outline-none focus-visible:ring-0 focus-visible:border-none shadow-none bg-transparent"
            value={input}
            placeholder="Ask me about Craftsman..."
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              overflowY: "auto",
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-700 cursor-pointer shrink-0"
            disabled={!input || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </form>
        <div className="max-w-3xl mx-auto text-xs text-slate-500 mt-2 text-center">
          Responses are generated based on Craftsman information. Always verify
          important details.
        </div>
      </footer>
    </div>
  );
}
