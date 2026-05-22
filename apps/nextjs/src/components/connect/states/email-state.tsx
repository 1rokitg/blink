"use client";

import { Button } from "@acme/ui/button";
import { useState } from "react";

interface EmailStateProps {
  onBack: () => void;
  onSubmit: (email: string) => void;
}

export function EmailState({ onBack, onSubmit }: EmailStateProps) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onSubmit(email.trim());
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          Sign in with Email
        </h2>
        <p className="text-gray-400">Enter your email address to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-gray-300">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@acme.com"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-gray-600 hover:border-gray-500"
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={!email.trim()}
          >
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
