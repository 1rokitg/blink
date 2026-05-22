import { Button } from "@acme/ui/button";
import { CheckCircle } from "lucide-react";
import { motion } from "motion/react";

interface SuccessStateProps {
  onClose: () => void;
}

export function SuccessState({ onClose }: SuccessStateProps) {
  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="flex justify-center mb-4"
        >
          <CheckCircle className="w-16 h-16 text-green-500" />
        </motion.div>

        <h2 className="text-2xl font-bold text-white mb-2">Welcome back!</h2>
        <p className="text-gray-400 mb-6">
          You've successfully signed in to your account.
        </p>

        <Button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
