import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { NotFoundIllustration } from "@/components/illustrations/not-found-illustration";
import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center px-4 pt-16">
        <div className="text-center max-w-lg">
          <NotFoundIllustration />
          <h1 className="text-2xl sm:text-3xl font-bold mt-6 mb-3">
            Page Not Found
          </h1>
          <p className="text-muted-foreground mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild>
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
