import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import Image from "next/image";
import { SurveyForm } from "@/components/surveys/survey-form";
import type { SurveyQuestion } from "@/types/follow-up";

interface SurveyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: SurveyPageProps) {
  const { slug } = await params;
  const survey = await prisma.survey.findUnique({
    where: { slug },
    select: { title: true, description: true },
  });

  if (!survey) return { title: "Survey Not Found" };

  return {
    title: survey.title,
    description: survey.description || "Share your feedback",
  };
}

export default async function PublicSurveyPage({ params }: SurveyPageProps) {
  const { slug } = await params;

  const survey = await prisma.survey.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      questions: true,
      isActive: true,
      thankYouMessage: true,
    },
  });

  if (!survey) {
    notFound();
  }

  if (!survey.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center max-w-md mx-auto p-8">
          <h1 className="text-xl font-bold mb-2">Survey Closed</h1>
          <p className="text-muted-foreground">
            This survey is no longer accepting responses.
          </p>
        </div>
      </div>
    );
  }

  const questions: SurveyQuestion[] = JSON.parse(survey.questions || "[]");

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="FlowSmartly"
            width={120}
            height={30}
            className="h-6 w-auto"
          />
        </div>
      </div>

      {/* Survey */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card rounded-xl border shadow-sm p-6 md:p-8">
          <SurveyForm
            slug={slug}
            title={survey.title}
            description={survey.description}
            questions={questions}
            thankYouMessage={survey.thankYouMessage}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by{" "}
          <a
            href="https://flowsmartly.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-500 hover:underline"
          >
            FlowSmartly
          </a>
        </p>
      </div>
    </div>
  );
}
