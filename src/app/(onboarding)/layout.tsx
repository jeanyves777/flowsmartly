import Image from "next/image";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Image
            src="/logo.png"
            alt="FlowSmartly"
            width={160}
            height={40}
            className="h-8 w-auto"
            priority
            unoptimized
          />
        </div>
      </header>
      <main className="pt-24 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
        {children}
      </main>
    </div>
  );
}
