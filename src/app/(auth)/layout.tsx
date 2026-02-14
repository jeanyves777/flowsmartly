import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AuthIllustration } from "@/components/illustrations/auth-illustration";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

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
          <Link href="/" className="flex items-center mb-8">
            <Image
              src="/logo.png"
              alt="FlowSmartly"
              width={160}
              height={40}
              className="h-9 w-auto"
              priority
            />
          </Link>

          {children}
        </div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-brand-500 via-brand-600 to-accent-purple relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1)_0%,transparent_60%)]" />
        <div className="relative flex flex-col items-center justify-center w-full px-12">
          <AuthIllustration />
        </div>
      </div>
    </div>
  );
}
