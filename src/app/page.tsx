import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicMotionProvider } from "@/components/marketing/motion";
import { HeroSection } from "@/components/home/hero-section";
import { ProofMarquee } from "@/components/marketing/sections/proof-marquee";
import { WatchItWork } from "@/components/marketing/sections/watch-it-work";
import { SurfacesSection } from "@/components/marketing/sections/surfaces-section";
import { WhyDifferent } from "@/components/marketing/sections/why-different";
import { UseCasesSection } from "@/components/marketing/sections/use-cases-section";
import { OutcomesSection } from "@/components/marketing/sections/outcomes-section";
import { PricingPreview } from "@/components/marketing/sections/pricing-preview";
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
          <SurfacesSection />
          <WhyDifferent />
          <UseCasesSection />
          <OutcomesSection />
          <PricingPreview />
          <FinalCta />
        </main>
        <PublicFooter />
      </div>
    </PublicMotionProvider>
  );
}
