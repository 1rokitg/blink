"use client";

import Header from "~/components/Header";
import Hero from "~/components/Hero";
import Features from "~/components/Features";
import About from "~/components/About";
import Footer from "~/components/Footer";
import { useReveal } from "~/lib/hooks/use-reveal";


export default function BlinkHome() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <div ref={ref} className="min-h-screen bg-ink-950">
      <Header />
      <main>
        <Hero />
        <Features />
        <About />
      </main>
      <Footer />
    </div>
  );
}