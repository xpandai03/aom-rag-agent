"use client";

import React from "react";
import RuixenMoonChat from "@/components/ui/ruixen-moon-chat";

/**
 * Main Landing Page
 *
 * This page renders the Hero Chat Section which handles:
 * 1. Initial landing view with title and input
 * 2. User's first message submission
 * 3. Transition to chat interface
 * 4. Ongoing conversation with the RAG backend
 *
 * The component manages its own state and API calls.
 * Future: Can integrate with context providers for session management.
 */
export default function Home() {
  return (
    <main className="min-h-screen w-full bg-black text-white">
      <RuixenMoonChat />
    </main>
  );
}
