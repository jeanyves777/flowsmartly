"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Lock, UserPlus, Check, Clock, LogIn, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ShareInfo {
  id: string;
  name: string;
  description: string | null;
  ownerName: string;
  teamId: string | null;
  hasAccess: boolean;
  isOwner: boolean;
  requiresAuth: boolean;
  requestStatus: string | null;
}

function SharedFollowUpClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [data, setData] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/follow-ups/public/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          const info = json.data as ShareInfo;
          // If user has access, redirect to the actual follow-up
          if (info.hasAccess) {
            router.push(`/tools/follow-ups/${info.id}`);
            return;
          }
          setData(info);
          if (info.requestStatus === "PENDING") setRequestSent(true);
        } else {
          setError(json.error?.message || "Follow-up not found");
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [slug, router]);

  const handleRequestAccess = async () => {
    if (!data?.teamId) return;
    setRequesting(true);
    try {
      const res = await fetch(`/api/teams/${data.teamId}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setRequestSent(true);
      } else {
        setError(json.error?.message || "Failed to send request");
      }
    } catch {
      setError("Failed to send request");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center">
          <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Not Available</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-5">
            <ClipboardList className="h-8 w-8 text-blue-600" />
          </div>

          <h1 className="text-xl font-bold mb-1">{data.name}</h1>
          {data.description && (
            <p className="text-sm text-gray-500 mb-2">{data.description}</p>
          )}
          <p className="text-sm text-gray-400 mb-6">
            Shared by {data.ownerName}
          </p>

          {data.requiresAuth ? (
            // Not logged in
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Sign in or create an account to access this follow-up list.
              </p>
              <Link href={`/auth/login?redirect=/follow-up/${slug}`}>
                <Button className="w-full">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In to Continue
                </Button>
              </Link>
              <p className="text-xs text-gray-400">
                Don&apos;t have an account?{" "}
                <Link
                  href={`/auth/register?redirect=/follow-up/${slug}`}
                  className="text-blue-600 hover:underline"
                >
                  Create one
                </Link>
              </p>
            </div>
          ) : requestSent ? (
            // Request already sent
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="font-semibold">Request Pending</h3>
              <p className="text-sm text-gray-500">
                Your request to join {data.ownerName}&apos;s team has been sent.
                You&apos;ll be notified when it&apos;s approved.
              </p>
            </motion.div>
          ) : data.teamId ? (
            // Can request access
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                You need to be a team member to access this follow-up list.
                Request to join the team below.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message (optional)"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 resize-none"
              />
              <Button
                className="w-full"
                onClick={handleRequestAccess}
                disabled={requesting}
              >
                {requesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Request Access
              </Button>
            </div>
          ) : (
            // Owner has no team — can't request
            <div className="space-y-3">
              <Lock className="h-8 w-8 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-500">
                Access to this follow-up is restricted. Contact {data.ownerName}{" "}
                to get access.
              </p>
            </div>
          )}
        </div>

        <div className="text-center mt-6 text-xs text-gray-400">
          Powered by{" "}
          <a
            href="https://flowsmartly.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            FlowSmartly
          </a>
        </div>
      </motion.div>
    </div>
  );
}

export default function SharedFollowUpPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <SharedFollowUpClient slug={slug} />;
}
