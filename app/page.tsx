"use client";

import React from "react";
import RuixenMoonChat from "@/components/ui/ruixen-moon-chat";

/**
 * Main Landing Page - Art of Manliness Edition
 *
 * This page renders the Hero Chat Section which handles:
 * 1. Initial landing view with title and input
 * 2. User's first message submission
 * 3. Transition to chat interface
 * 4. Ongoing conversation with the RAG backend
 *
 * Design: Vintage editorial aesthetic inspired by Art of Manliness
 * Color Palette: Cream background, red accents, brown text
 */
export default function Home() {
  return (
    <main className="min-h-screen w-full vintage-gradient paper-texture">
      <RuixenMoonChat />
    </main>
  );
}
