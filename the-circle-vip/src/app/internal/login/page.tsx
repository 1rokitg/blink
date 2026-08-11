import { InternalLoginForm } from "@/components/internal/login-form";
import { isInternalAuthConfigured } from "@/lib/internal-auth";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function InternalLoginPage() {
  return (
    <div className="monetise flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#262626] bg-[#141414] p-8">
        <h1 className="text-xl font-semibold tracking-tight text-[#fafafa]">
          Sign in
        </h1>
        <div className="mt-8">
          {isInternalAuthConfigured() ? (
            <InternalLoginForm />
          ) : (
            <p className="text-sm text-[#71717a]">Sign-in is unavailable.</p>
          )}
        </div>
      </div>
    </div>
  );
}
