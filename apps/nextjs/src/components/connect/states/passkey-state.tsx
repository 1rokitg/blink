import { Button } from "@acme/ui/button";
import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface PasskeyStateProps {
  onBack: () => void;
  onSubmit: () => void;
}

export function PasskeyState({ onBack, onSubmit }: PasskeyStateProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handlePasskeyAuth = async () => {
    setIsAuthenticating(true);

    try {
      // Simulate passkey authentication
      await new Promise((resolve) => setTimeout(resolve, 2000));
      onSubmit();
    } catch (error) {
      console.error("Passkey authentication failed:", error);
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          Passkey Authentication
        </h2>
        <p className="text-gray-400">Use your device's built-in security</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="relative flex items-center justify-center overflow-hidden rounded-[22px] p-0.5">
          <motion.div
            className="absolute left-[-50%] top-[-50%] h-[200%] w-[200%] bg-[conic-gradient(from_0deg,transparent_0%,#4DAFFE_10%,#4DAFFE_25%,transparent_35%)]"
            animate={{ rotate: isAuthenticating ? 360 : 0 }}
            transition={{
              duration: 1.25,
              repeat: isAuthenticating ? Number.POSITIVE_INFINITY : 0,
              ease: "linear",
              repeatType: "loop",
            }}
          />
          <div className="bg-gray-900 z-10 flex items-center justify-center rounded-[20px] p-1">
            <div className="flex items-center justify-center rounded-2xl bg-gray-300 p-1">
              <div className="flex size-16 items-center justify-center rounded-xl bg-gray-100">
                <svg
                  className="size-8 text-gray-800"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Passkey icon</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Button
          onClick={handlePasskeyAuth}
          disabled={isAuthenticating}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {isAuthenticating ? "Authenticating..." : "Authenticate with Passkey"}
        </Button>

        <Button
          variant="outline"
          className="w-full border-gray-600 hover:border-gray-500"
          onClick={onBack}
        >
          Back to sign in options
        </Button>
      </div>
    </div>
  );
}
