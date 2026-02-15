import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { HeroSection } from "@/components/home/hero-section";
import { FeaturesSection } from "@/components/home/features-section";
import { PlatformSection } from "@/components/home/platform-section";
import { StatsSection } from "@/components/home/stats-section";
import { SmsBlasterSection } from "@/components/home/sms-blaster-section";
import { PricingPreview } from "@/components/home/pricing-preview";
import { CTASection } from "@/components/home/cta-section";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PublicHeader />
      <HeroSection />
      <FeaturesSection />
      <PlatformSection />
      <SmsBlasterSection />
      <StatsSection />
      <PricingPreview />
      <CTASection />
      <PublicFooter />
    </div>
  );
}
