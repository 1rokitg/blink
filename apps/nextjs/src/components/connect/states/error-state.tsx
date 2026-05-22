import { Button } from "@acme/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
  onBack: () => void;
}

export function ErrorState({ error, onRetry, onBack }: ErrorStateProps) {
  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-400 mb-6">{error}</p>

        <div className="space-y-3">
          <Button
            onClick={onRetry}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Try Again
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
    </div>
  );
}
