"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
  X,
  DollarSign,
  Globe,
  Sparkles,
  Target,
  User,
  FileText,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const SPECIALTY_OPTIONS = [
  "Social Media Management",
  "Content Creation",
  "SEO & SEM",
  "Email Marketing",
  "SMS Marketing",
  "Brand Strategy",
  "Paid Advertising",
  "Analytics & Reporting",
  "Influencer Marketing",
  "Video Marketing",
  "Community Management",
  "Graphic Design",
];

const INDUSTRY_OPTIONS = [
  "E-commerce",
  "SaaS",
  "Healthcare",
  "Real Estate",
  "Restaurant & Food",
  "Fitness & Wellness",
  "Education",
  "Fashion & Beauty",
  "Finance",
  "Travel & Tourism",
  "Entertainment",
  "Non-Profit",
  "Local Business",
  "B2B Services",
];

const WIZARD_STEPS = [
  { label: "Specialties", icon: Target, description: "What do you specialize in?" },
  { label: "Display Name", icon: User, description: "Your professional identity" },
  { label: "Bio", icon: FileText, description: "Tell clients about yourself" },
  { label: "Details", icon: Briefcase, description: "Industries & pricing" },
  { label: "Review", icon: CheckCircle, description: "Confirm & submit" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AgentApplyPage() {
  const router = useRouter();
  const [existingProfile, setExistingProfile] = useState<{
    status: string;
    rejectedReason?: string;
  } | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  // Wizard step
  const [currentStep, setCurrentStep] = useState(0);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([""]);
  const [minPrice, setMinPrice] = useState("100");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // AI assist state
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);
  const [isGeneratingNames, setIsGeneratingNames] = useState(false);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [suggestedIndustries, setSuggestedIndustries] = useState<
    { name: string; reason: string }[]
  >([]);
  const [isGeneratingIndustries, setIsGeneratingIndustries] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [isCheckingName, setIsCheckingName] = useState(false);

  // Track if AI was already auto-triggered for each step
  const autoTriggeredRef = useRef<Record<number, boolean>>({});

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const res = await fetch("/api/agent/profile");
        const data = await res.json();
        if (data.success && data.data?.profile) {
          setExistingProfile({
            status: data.data.profile.status,
            rejectedReason: data.data.profile.rejectedReason,
          });
        }
      } catch {}
      setIsCheckingProfile(false);
    };
    checkProfile();
  }, []);

  // Auto-trigger AI on step entry
  useEffect(() => {
    if (currentStep === 1 && specialties.length > 0 && !autoTriggeredRef.current[1]) {
      autoTriggeredRef.current[1] = true;
      generateDisplayNames();
    }
    if (currentStep === 3 && specialties.length > 0 && !autoTriggeredRef.current[3]) {
      autoTriggeredRef.current[3] = true;
      suggestIndustriesAI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const toggleIndustry = (i: string) => {
    setIndustries((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  };

  const addPortfolioUrl = () => {
    if (portfolioUrls.length < 5) {
      setPortfolioUrls([...portfolioUrls, ""]);
    }
  };

  const updatePortfolioUrl = (index: number, value: string) => {
    const updated = [...portfolioUrls];
    updated[index] = value;
    setPortfolioUrls(updated);
  };

  const removePortfolioUrl = (index: number) => {
    setPortfolioUrls(portfolioUrls.filter((_, i) => i !== index));
  };

  // --- AI Functions ---

  const generateDisplayNames = async () => {
    setIsGeneratingNames(true);
    try {
      const res = await fetch("/api/agent/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "display_names", specialties }),
      });
      const data = await res.json();
      if (data.success) {
        setSuggestedNames(data.data.names);
      }
    } catch {}
    setIsGeneratingNames(false);
  };

  const generateBio = async () => {
    setIsGeneratingBio(true);
    try {
      const res = await fetch("/api/agent/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bio",
          displayName,
          specialties,
          industries: industries.length > 0 ? industries : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBio(data.data.bio);
      }
    } catch {}
    setIsGeneratingBio(false);
  };

  const suggestIndustriesAI = async () => {
    setIsGeneratingIndustries(true);
    try {
      const res = await fetch("/api/agent/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "industries", specialties }),
      });
      const data = await res.json();
      if (data.success) {
        setSuggestedIndustries(data.data.industries);
      }
    } catch {}
    setIsGeneratingIndustries(false);
  };

  // Debounced name availability check
  const nameCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const checkNameAvailability = useCallback((name: string) => {
    if (nameCheckTimerRef.current) clearTimeout(nameCheckTimerRef.current);
    if (!name.trim()) {
      setNameAvailable(null);
      return;
    }
    setIsCheckingName(true);
    nameCheckTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/agent/ai-assist?value=${encodeURIComponent(name.trim())}`
        );
        const data = await res.json();
        if (data.success) setNameAvailable(data.data.available);
      } catch {}
      setIsCheckingName(false);
    }, 300);
  }, []);

  // --- Validation ---

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0:
        return specialties.length > 0;
      case 1:
        return displayName.trim().length > 0 && nameAvailable !== false;
      case 2:
        return true;
      case 3:
        return (
          industries.length > 0 &&
          !isNaN(parseFloat(minPrice)) &&
          parseFloat(minPrice) >= 100
        );
      case 4:
        return true;
      default:
        return false;
    }
  };

  const getStepError = (step: number): string => {
    switch (step) {
      case 0:
        return "Please select at least one specialty";
      case 1:
        if (!displayName.trim()) return "Display name is required";
        if (nameAvailable === false) return "This display name is already taken";
        return "";
      case 3:
        if (industries.length === 0) return "Please select at least one industry";
        if (isNaN(parseFloat(minPrice)) || parseFloat(minPrice) < 100)
          return "Minimum price must be at least $100/month";
        return "";
      default:
        return "";
    }
  };

  const handleNext = () => {
    if (!canProceed(currentStep)) {
      setError(getStepError(currentStep));
      return;
    }
    setError("");
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setError("");
    setCurrentStep(currentStep - 1);
  };

  const goToStep = (step: number) => {
    if (step < currentStep) {
      setError("");
      setCurrentStep(step);
    }
  };

  const handleSubmit = async () => {
    setError("");
    const priceInCents = Math.round(parseFloat(minPrice) * 100);
    if (isNaN(priceInCents) || priceInCents < 10000) {
      setError("Minimum price must be at least $100/month");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/agent/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim() || null,
          specialties,
          industries,
          portfolioUrls: portfolioUrls.filter((u) => u.trim()),
          minPricePerMonth: priceInCents,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setExistingProfile({ status: "PENDING" });
      } else {
        setError(data.error?.message || "Failed to submit application");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Loading ---
  if (isCheckingProfile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // --- Existing Profile Status ---
  if (existingProfile) {
    return (
      <div className="py-12">
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <Card>
            <CardContent className="p-8 text-center">
              {existingProfile.status === "PENDING" && (
                <>
                  <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <Clock className="h-8 w-8 text-amber-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Application Under Review</h2>
                  <p className="text-muted-foreground mb-6">
                    Your agent application has been submitted and is being reviewed by our team.
                    You will be notified once a decision has been made.
                  </p>
                  <Button variant="outline" onClick={() => router.push("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </>
              )}
              {existingProfile.status === "APPROVED" && (
                <>
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">You&apos;re an Approved Agent!</h2>
                  <p className="text-muted-foreground mb-6">
                    Your agent profile is active. Head to your client dashboard to manage your clients.
                  </p>
                  <Button onClick={() => router.push("/agent/clients")}>
                    Go to My Clients
                  </Button>
                </>
              )}
              {existingProfile.status === "REJECTED" && (
                <>
                  <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <X className="h-8 w-8 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Application Not Approved</h2>
                  <p className="text-muted-foreground mb-4">
                    Unfortunately, your agent application was not approved at this time.
                  </p>
                  {existingProfile.rejectedReason && (
                    <div className="bg-red-500/5 border border-red-200 rounded-lg p-4 mb-6 text-left">
                      <p className="text-sm font-medium text-red-600 mb-1">Reason:</p>
                      <p className="text-sm">{existingProfile.rejectedReason}</p>
                    </div>
                  )}
                  <Button variant="outline" onClick={() => router.push("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </>
              )}
              {existingProfile.status === "SUSPENDED" && (
                <>
                  <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <X className="h-8 w-8 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Agent Profile Suspended</h2>
                  <p className="text-muted-foreground mb-6">
                    Your agent profile has been suspended. Please contact support for more information.
                  </p>
                  <Button variant="outline" onClick={() => router.push("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // --- Wizard ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Become an Agent</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered setup to create your perfect agent profile
            </p>
          </div>
        </div>
      </motion.div>

      {/* Benefits */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Card className="border-violet-200 bg-violet-500/5">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-2">
                <DollarSign className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Recurring Revenue</p>
                  <p className="text-xs text-muted-foreground">Earn monthly from each client</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Marketplace Exposure</p>
                  <p className="text-xs text-muted-foreground">Get discovered by businesses</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">AI-Powered Tools</p>
                  <p className="text-xs text-muted-foreground">Manage clients with FlowSmartly</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Step Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              const StepIcon = step.icon;

              return (
                <div key={index} className="flex items-center">
                  <button
                    onClick={() => goToStep(index)}
                    className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-violet-500/10 text-violet-600"
                        : isCompleted
                        ? "text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                        : "text-muted-foreground cursor-default"
                    }`}
                    disabled={index > currentStep}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                        isActive
                          ? "bg-violet-500 text-white"
                          : isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>
                    <span className="hidden lg:inline text-sm font-medium">
                      {step.label}
                    </span>
                  </button>
                  {index < WIZARD_STEPS.length - 1 && (
                    <ChevronRight className="w-4 h-4 mx-0.5 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {currentStep === 0 && (
            <StepSpecialties
              specialties={specialties}
              toggleSpecialty={toggleSpecialty}
            />
          )}

          {currentStep === 1 && (
            <StepDisplayName
              displayName={displayName}
              setDisplayName={(name: string) => {
                setDisplayName(name);
                checkNameAvailability(name);
              }}
              suggestedNames={suggestedNames}
              isGeneratingNames={isGeneratingNames}
              generateDisplayNames={generateDisplayNames}
              nameAvailable={nameAvailable}
              isCheckingName={isCheckingName}
              onSelectSuggestion={(name: string) => {
                setDisplayName(name);
                setNameAvailable(true);
              }}
            />
          )}

          {currentStep === 2 && (
            <StepBio
              bio={bio}
              setBio={setBio}
              isGeneratingBio={isGeneratingBio}
              generateBio={generateBio}
            />
          )}

          {currentStep === 3 && (
            <StepDetails
              industries={industries}
              toggleIndustry={toggleIndustry}
              suggestedIndustries={suggestedIndustries}
              isGeneratingIndustries={isGeneratingIndustries}
              suggestIndustriesAI={suggestIndustriesAI}
              minPrice={minPrice}
              setMinPrice={setMinPrice}
              portfolioUrls={portfolioUrls}
              updatePortfolioUrl={updatePortfolioUrl}
              removePortfolioUrl={removePortfolioUrl}
              addPortfolioUrl={addPortfolioUrl}
            />
          )}

          {currentStep === 4 && (
            <StepReview
              displayName={displayName}
              bio={bio}
              specialties={specialties}
              industries={industries}
              minPrice={minPrice}
              portfolioUrls={portfolioUrls}
              goToStep={(step: number) => {
                setError("");
                setCurrentStep(step);
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground mr-2">
            Step {currentStep + 1} of {WIZARD_STEPS.length}
          </p>
          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              size="lg"
              className="bg-violet-600 hover:bg-violet-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        By applying, you agree to FlowSmartly&apos;s agent terms. Applications
        are typically reviewed within 1-2 business days.
      </p>
    </div>
  );
}

// --- Step Components ---

function AISuggestButton({
  onClick,
  loading,
  label = "AI Suggest",
}: {
  onClick: () => void;
  loading: boolean;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className="gap-2 border-violet-200 text-violet-600 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {loading ? "Generating..." : label}
    </Button>
  );
}

function StepSpecialties({
  specialties,
  toggleSpecialty,
}: {
  specialties: string[];
  toggleSpecialty: (s: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-violet-500" />
          What type of agent are you?
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select your specialties to help our AI customize your profile. Choose at least one.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {SPECIALTY_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSpecialty(s)}
              className={`px-3 py-2 rounded-full text-sm border transition-all ${
                specialties.includes(s)
                  ? "bg-violet-500 text-white border-violet-500 shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-violet-300 hover:text-violet-600"
              }`}
            >
              {specialties.includes(s) && <Check className="inline h-3 w-3 mr-1" />}
              {s}
            </button>
          ))}
        </div>
        {specialties.length > 0 && (
          <p className="mt-4 text-sm text-violet-600">
            <Sparkles className="inline h-4 w-4 mr-1" />
            {specialties.length} selected — AI will use these to suggest your name, bio, and industries
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StepDisplayName({
  displayName,
  setDisplayName,
  suggestedNames,
  isGeneratingNames,
  generateDisplayNames,
  nameAvailable,
  isCheckingName,
  onSelectSuggestion,
}: {
  displayName: string;
  setDisplayName: (name: string) => void;
  suggestedNames: string[];
  isGeneratingNames: boolean;
  generateDisplayNames: () => void;
  nameAvailable: boolean | null;
  isCheckingName: boolean;
  onSelectSuggestion: (name: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-violet-500" />
              Choose your display name
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              This is how clients will see you in the marketplace
            </p>
          </div>
          <AISuggestButton
            onClick={generateDisplayNames}
            loading={isGeneratingNames}
            label={suggestedNames.length > 0 ? "Refresh" : "AI Suggest"}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Suggestions */}
        {isGeneratingNames && suggestedNames.length === 0 && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-violet-500/5 border border-violet-200">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <span className="text-sm text-violet-600">AI is generating name suggestions...</span>
          </div>
        )}

        {suggestedNames.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Sparkles className="inline h-3 w-3 mr-1 text-violet-500" />
              AI Suggestions
            </p>
            <div className="grid gap-2">
              {suggestedNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSelectSuggestion(name)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between ${
                    displayName === name
                      ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      : "border-border hover:border-violet-300 hover:bg-violet-500/5"
                  }`}
                >
                  <span className="font-medium">{name}</span>
                  {displayName === name ? (
                    <Badge className="bg-violet-500 text-white text-xs">Selected</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                      Available
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or type your own</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="relative">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Sarah's Digital Marketing"
              maxLength={100}
              className="pr-10"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isCheckingName && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {!isCheckingName && nameAvailable === true && displayName.trim() && (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              )}
              {!isCheckingName && nameAvailable === false && displayName.trim() && (
                <X className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          {nameAvailable === false && displayName.trim() && (
            <p className="text-xs text-red-500">This display name is already taken</p>
          )}
          {nameAvailable === true && displayName.trim() && !suggestedNames.includes(displayName) && (
            <p className="text-xs text-emerald-600">This name is available!</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StepBio({
  bio,
  setBio,
  isGeneratingBio,
  generateBio,
}: {
  bio: string;
  setBio: (bio: string) => void;
  isGeneratingBio: boolean;
  generateBio: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-500" />
              Your professional bio
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Tell potential clients about your experience and expertise
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!bio && !isGeneratingBio && (
          <button
            type="button"
            onClick={generateBio}
            className="w-full p-6 rounded-lg border-2 border-dashed border-violet-200 hover:border-violet-400 hover:bg-violet-500/5 transition-all text-center group"
          >
            <Sparkles className="h-8 w-8 text-violet-400 mx-auto mb-2 group-hover:text-violet-500" />
            <p className="font-medium text-violet-600">Generate Bio with AI</p>
            <p className="text-xs text-muted-foreground mt-1">
              AI will craft a professional bio based on your specialties
            </p>
          </button>
        )}

        {isGeneratingBio && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-violet-500/5 border border-violet-200">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <span className="text-sm text-violet-600">AI is writing your bio...</span>
          </div>
        )}

        {(bio || isGeneratingBio) && (
          <>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell potential clients about your experience, approach, and what makes you stand out..."
              rows={6}
              maxLength={1000}
              disabled={isGeneratingBio}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-50"
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <AISuggestButton
                  onClick={generateBio}
                  loading={isGeneratingBio}
                  label="Regenerate"
                />
                {bio && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBio("")}
                    className="text-muted-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{bio.length}/1000</p>
            </div>
          </>
        )}

        {!bio && !isGeneratingBio && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setBio(" ")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Or write your own bio manually
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepDetails({
  industries,
  toggleIndustry,
  suggestedIndustries,
  isGeneratingIndustries,
  suggestIndustriesAI,
  minPrice,
  setMinPrice,
  portfolioUrls,
  updatePortfolioUrl,
  removePortfolioUrl,
  addPortfolioUrl,
}: {
  industries: string[];
  toggleIndustry: (i: string) => void;
  suggestedIndustries: { name: string; reason: string }[];
  isGeneratingIndustries: boolean;
  suggestIndustriesAI: () => void;
  minPrice: string;
  setMinPrice: (p: string) => void;
  portfolioUrls: string[];
  updatePortfolioUrl: (i: number, v: string) => void;
  removePortfolioUrl: (i: number) => void;
  addPortfolioUrl: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Industries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-violet-500" />
                Target Industries
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Select the industries you serve (at least one)
              </p>
            </div>
            <AISuggestButton
              onClick={suggestIndustriesAI}
              loading={isGeneratingIndustries}
              label={suggestedIndustries.length > 0 ? "Refresh" : "AI Suggest"}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Suggestions */}
          {isGeneratingIndustries && suggestedIndustries.length === 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-200">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              <span className="text-sm text-violet-600">AI is suggesting industries...</span>
            </div>
          )}

          {suggestedIndustries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Sparkles className="inline h-3 w-3 mr-1 text-violet-500" />
                AI Recommended
              </p>
              <div className="grid gap-2">
                {suggestedIndustries.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    onClick={() => {
                      if (!industries.includes(suggestion.name)) toggleIndustry(suggestion.name);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm ${
                      industries.includes(suggestion.name)
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-border hover:border-brand-300 hover:bg-brand-500/5"
                    }`}
                  >
                    <span className="font-medium">{suggestion.name}</span>
                    {industries.includes(suggestion.name) && (
                      <Check className="inline h-3 w-3 ml-2 text-brand-500" />
                    )}
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {suggestion.reason}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All Industries */}
          <div className="space-y-2">
            {suggestedIndustries.length > 0 && (
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                All Industries
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {INDUSTRY_OPTIONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleIndustry(i)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    industries.includes(i)
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-background text-muted-foreground border-border hover:border-brand-300"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Minimum Monthly Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="relative max-w-xs">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min="100"
                step="1"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Minimum $100/month. You can negotiate higher rates with individual clients.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portfolio / Website Links</CardTitle>
          <p className="text-sm text-muted-foreground">
            Optional — share links to your work
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {portfolioUrls.map((url, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => updatePortfolioUrl(index, e.target.value)}
                placeholder="https://yourwebsite.com"
                type="url"
              />
              {portfolioUrls.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePortfolioUrl(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {portfolioUrls.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={addPortfolioUrl}>
              <Plus className="h-4 w-4 mr-1" />
              Add Link
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepReview({
  displayName,
  bio,
  specialties,
  industries,
  minPrice,
  portfolioUrls,
  goToStep,
}: {
  displayName: string;
  bio: string;
  specialties: string[];
  industries: string[];
  minPrice: string;
  portfolioUrls: string[];
  goToStep: (step: number) => void;
}) {
  const filteredUrls = portfolioUrls.filter((u) => u.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-violet-500" />
          Review Your Application
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Make sure everything looks good before submitting
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Display Name */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Display Name
            </p>
            <p className="font-semibold text-lg">{displayName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>

        <div className="h-px bg-border" />

        {/* Bio */}
        <div className="flex items-start justify-between">
          <div className="flex-1 mr-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Bio
            </p>
            <p className="text-sm whitespace-pre-wrap">
              {bio.trim() || <span className="italic text-muted-foreground">No bio provided</span>}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => goToStep(2)} className="shrink-0">
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>

        <div className="h-px bg-border" />

        {/* Specialties */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Specialties
            </p>
            <div className="flex flex-wrap gap-1.5">
              {specialties.map((s) => (
                <Badge key={s} className="bg-violet-500/10 text-violet-600 border-violet-200">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => goToStep(0)} className="shrink-0">
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>

        <div className="h-px bg-border" />

        {/* Industries */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Industries
            </p>
            <div className="flex flex-wrap gap-1.5">
              {industries.map((i) => (
                <Badge key={i} className="bg-brand-500/10 text-brand-600 border-brand-200">
                  {i}
                </Badge>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => goToStep(3)} className="shrink-0">
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>

        <div className="h-px bg-border" />

        {/* Pricing */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Minimum Monthly Rate
            </p>
            <p className="font-semibold">${parseFloat(minPrice).toFixed(2)}/month</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => goToStep(3)} className="shrink-0">
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        </div>

        {filteredUrls.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Portfolio Links
                </p>
                <div className="space-y-1">
                  {filteredUrls.map((url, i) => (
                    <p key={i} className="text-sm text-brand-500 truncate max-w-md">
                      {url}
                    </p>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => goToStep(3)} className="shrink-0">
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
          </>
        )}

        {/* AI Badge */}
        <div className="mt-4 pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">
            <Sparkles className="inline h-3 w-3 mr-1 text-violet-500" />
            Powered by FlowSmartly AI
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
