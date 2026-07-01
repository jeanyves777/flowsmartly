import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicMotionProvider } from "@/components/marketing/motion";
import { HeroSection } from "@/components/home/hero-section";
import { ProofMarquee } from "@/components/marketing/sections/proof-marquee";
import { WatchItWork } from "@/components/marketing/sections/watch-it-work";
import { FinalCta } from "@/components/marketing/sections/final-cta";

export default function HomePage() {
  return (
    <PublicMotionProvider>
      <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
        <PublicHeader />
        <main>
          <HeroSection />
          <ProofMarquee />
          <WatchItWork />
          {/* P3 — surfaces + how it works · P4 — outcomes + pricing */}
          <FinalCta />
        </main>
        <PublicFooter />
      </div>
    </PublicMotionProvider>
  );
}
