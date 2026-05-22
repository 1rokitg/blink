import { motion } from "motion/react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Processing..." }: LoadingStateProps) {
  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <motion.div
            className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">{message}</h2>
        <p className="text-gray-400">
          Please wait while we process your request...
        </p>
      </div>
    </div>
  );
}
