"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Clock, Users, Loader2 } from "lucide-react";

interface InvitationData {
  teamName: string;
  inviterName: string;
  role: string;
  expiresAt: string;
  status: string;
}

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; teamId?: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/teams/invitations/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setInvitation(data.data);
        } else {
          setError(data.error?.message || "Invitation not found");
        }
      })
      .catch(() => setError("Failed to load invitation"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    setActing(true);
    try {
      const res = await fetch(`/api/teams/invitations/${token}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: "You've joined the team!", teamId: data.data?.teamId });
      } else if (res.status === 401) {
        // Not logged in — redirect to login
        router.push(`/login?redirect=/teams/invite/${token}`);
      } else {
        setResult({ success: false, message: data.error?.message || "Failed to accept invitation" });
      }
    } catch {
      setResult({ success: false, message: "Something went wrong" });
    } finally {
      setActing(false);
    }
  }

  async function handleDecline() {
    setActing(true);
    try {
      const res = await fetch(`/api/teams/invitations/${token}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: "Invitation declined" });
      } else {
        setResult({ success: false, message: data.error?.message || "Failed to decline" });
      }
    } catch {
      setResult({ success: false, message: "Something went wrong" });
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invitation Not Found</h2>
          <p className="text-zinc-500">{error}</p>
          <a href="/login" className="mt-6 inline-block px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center">
          {result.success ? (
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          ) : (
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          )}
          <h2 className="text-xl font-semibold mb-2">{result.success ? "Success" : "Error"}</h2>
          <p className="text-zinc-500">{result.message}</p>
          {result.teamId && (
            <a href={`/teams/${result.teamId}`} className="mt-6 inline-block px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
              Go to Team
            </a>
          )}
        </div>
      </div>
    );
  }

  const isExpired = invitation && new Date(invitation.expiresAt) < new Date();
  const isNotPending = invitation && invitation.status !== "PENDING";

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8">
        <div className="text-center mb-6">
          <Users className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Team Invitation</h2>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-zinc-500">Team</span>
            <span className="font-medium">{invitation?.teamName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-zinc-500">Invited by</span>
            <span className="font-medium">{invitation?.inviterName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-zinc-500">Role</span>
            <span className="font-medium capitalize">{invitation?.role.toLowerCase()}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-zinc-500">Expires</span>
            <span className="font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {invitation ? new Date(invitation.expiresAt).toLocaleDateString() : ""}
            </span>
          </div>
        </div>

        {isExpired || isNotPending ? (
          <div className="text-center p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <p className="text-zinc-500">
              {isExpired ? "This invitation has expired." : "This invitation is no longer available."}
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              disabled={acting}
              className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={acting}
              className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {acting && <Loader2 className="h-4 w-4 animate-spin" />}
              Accept
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
