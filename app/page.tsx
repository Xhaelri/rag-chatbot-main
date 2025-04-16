// Filename: app/chat/page.tsx (or your chat page component file)
"use client";

import { useChat, Message } from "@ai-sdk/react"; // Ensure Message type is imported
import { ArrowUp, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { CraftsmenGrid } from "@/components/ui/CraftsmenGrid"; // Assuming path is correct
import {
  extractCraftsmanData,
  messageContainsCraftsmanData,
} from "@/lib/extract-craftsman-data"; // Assuming path is correct

const api = "/api/chat"; // Your backend API endpoint

// Define the Craftsman type (ensure properties match your data structure)
interface Craftsman {
  id: string;
  name: string;
  craft: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  description?: string;
  status?: string;
}

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
      textareaRef.current.style.height = "auto"; // Reset height
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = isMobile ? 150 : 200;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input, isMobile]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Enter key press for submission on desktop
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile && !isLoading) {
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
          {/* Initial Placeholder Message */}
          {messages.length === 0 && !isLoading && (
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

          {/* Chat Messages */}
          {messages.map((message) => {
             // --- DEBUG LOG ---
             console.log("Processing Message:", message.id, "Role:", message.role);

             // Check if it's an assistant message containing craftsman data
             const containsDataCheckResults = message.parts.map(part => {
               if (part.type === 'text') {
                 const hasMarkers = messageContainsCraftsmanData(part.text);
                 // --- DEBUG LOG ---
                 console.log(` - Part text check (${message.id}): messageContainsCraftsmanData ->`, hasMarkers);
                 return hasMarkers;
               }
               return false;
             });

             const containsData = message.role === "assistant" && containsDataCheckResults.some(result => result);
             // --- DEBUG LOG ---
             console.log(`Message ${message.id}: containsData evaluation ->`, containsData);

             let craftsmenData: Craftsman[] = [];
             let introductoryText = "";

             if (containsData && message.parts[0]?.type === "text") {
               const messageText = message.parts[0].text;
               // --- DEBUG LOG ---
               console.log(`Message ${message.id}: Raw AI Response Text for extraction:\n---\n${messageText}\n---`);

               // 1. Extract data for the cards
               try {
                  craftsmenData = extractCraftsmanData(messageText);
                  // --- DEBUG LOG ---
                  console.log(`Message ${message.id}: Extracted craftsmenData ->`, JSON.stringify(craftsmenData, null, 2));
               } catch (error) {
                  // --- DEBUG LOG ---
                  console.error(`Message ${message.id}: Error during extractCraftsmanData ->`, error);
                  craftsmenData = []; // Ensure it's empty on error
               }


               // 2. Extract only the introductory text BEFORE the first marker
               const firstMarkerIndex = messageText.indexOf("--- المستند");
                if (firstMarkerIndex === 0) {
                    introductoryText = "";
                } else if (firstMarkerIndex > 0) {
                    introductoryText = messageText.substring(0, firstMarkerIndex).trim();
                } else {
                    introductoryText = ""; // Fallback
                }
                // --- DEBUG LOG ---
                console.log(`Message ${message.id}: introductoryText ->`, introductoryText);


             } else if (message.role === 'assistant') {
                 // --- DEBUG LOG ---
                 console.log(`Message ${message.id}: Not extracting data (containsData: ${containsData})`);
             }

            // RENDER THE MESSAGE BUBBLE
            return (
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
                  {/* Render message parts (text) */}
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
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
                            // Assistant message layout
                            <div className="flex gap-2 items-start">
                              <div className="h-8 w-8 p-1.5 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                                <Sparkles className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <ReactMarkdown
                                  components={{
                                    code({ // Code block syntax highlighting
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
                                  {/* Render ONLY intro text if data exists, else full text */}
                                  {containsData ? introductoryText : part.text}
                                </ReactMarkdown>
                              </div>
                            </div>
                          ) : (
                            // User message text (no icon needed)
                            part.text
                          )}
                        </div>
                      );
                    }
                    // Add handling for other part types if you expect them (e.g., images)
                    return null;
                  })}

                  {/* Render craftsmen cards ONLY if data exists */}
                  {containsData && craftsmenData.length > 0 && (
                    <div className="mt-4">
                      <CraftsmenGrid craftsmen={craftsmenData} />
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-xs mt-1 opacity-70 text-right">
                    {new Date(message.createdAt ?? Date.now()).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true // Use 24-hour format for clarity if preferred
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && messages.length > 0 && ( // Show only if there are previous messages
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-300 animate-spin" />
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Thinking...</div>
                </div>
              </div>
            </div>
          )}

          {/* Element to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 pb-6 bg-white dark:bg-slate-800 border-t">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2 border border-slate-300 dark:border-slate-600 p-2 rounded-xl bg-white dark:bg-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500"
        >
          <Textarea
            ref={textareaRef}
            className="flex-1 border-none resize-none min-h-[40px] focus:outline-none focus-visible:ring-0 focus-visible:border-none shadow-none bg-transparent dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            value={input}
            placeholder="Ask me about Craftsman..."
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              maxHeight: isMobile ? "150px" : "200px", // Consistent max height
              overflowY: "auto", // Ensure scroll appears if needed
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!input.trim() || isLoading} // Disable if input is empty or loading
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </form>
        <div className="max-w-3xl mx-auto text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
          Responses are generated based on Craftsman information. Always verify
          important details.
        </div>
      </footer>
    </div>
  );
}
