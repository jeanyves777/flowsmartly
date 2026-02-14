import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl">FlowSmartly</span>
          </Link>

          {children}
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-brand-500 via-brand-600 to-accent-purple relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="relative flex flex-col justify-center px-12 text-white">
          <h2 className="text-4xl font-bold mb-4">
            Create, Share, and Earn with AI
          </h2>
          <p className="text-lg text-white/80 mb-8">
            Join thousands of creators using FlowSmartly to grow their audience
            and monetize their content.
          </p>
          <div className="flex items-center gap-8 text-sm">
            <div>
              <div className="text-3xl font-bold">50K+</div>
              <div className="text-white/70">Active Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold">$1M+</div>
              <div className="text-white/70">Creator Earnings</div>
            </div>
            <div>
              <div className="text-3xl font-bold">10M+</div>
              <div className="text-white/70">Posts Created</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
