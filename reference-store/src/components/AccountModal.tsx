"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Mail, Lock, User, Eye, EyeOff, AlertCircle,
  ArrowRight, LogOut, Package, MapPin, Settings, CheckCircle2, Shield, Heart, Bookmark, CreditCard
} from "lucide-react";
import { storeInfo } from "@/lib/data";

// Extract store slug from logoUrl: "/stores/store-xxx/..." -> "store-xxx"
const STORE_SLUG = storeInfo.logoUrl.match(/\/stores\/([^/]+)\//)?.[1] || "";
const API_BASE = "https://flowsmartly.com";
const TURNSTILE_SITE_KEY = "0x4AAAAAAC121vHcMbDFP4WY";

type Tab = "login" | "register";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface StoreUser {
  id: string;
  name: string;
  email: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    __storeCustomer?: { id: string; name: string; email: string } | null;
    __storeWishlist?: string[];
  }
}

// Sync local cart to server and return merged items
async function syncCartToServer(storeSlug: string) {
  try {
    const cartKey = `flowshop-cart-${storeSlug}`;
    const raw = localStorage.getItem(cartKey);
    const localItems = raw ? JSON.parse(raw) : [];
    const res = await fetch(`${API_BASE}/api/store/${storeSlug}/account/cart/sync`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: localItems }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.items?.length) {
        // Merge server items back to localStorage (preserve name/price from local)
        const serverMap: Record<string, number> = {};
        for (const si of data.items) {
          const key = `${si.productId}:${si.variantId ?? ""}`;
          serverMap[key] = si.quantity;
        }
        const merged = localItems.map((li: { productId: string; variantId?: string; quantity: number }) => {
          const key = `${li.productId}:${li.variantId ?? ""}`;
          return { ...li, quantity: serverMap[key] ?? li.quantity };
        });
        localStorage.setItem(cartKey, JSON.stringify(merged));
        window.dispatchEvent(new Event("storage"));
      }
    }
  } catch { /* silent */ }
}

// Load wishlist productIds into window.__storeWishlist
async function loadWishlist(storeSlug: string) {
  try {
    const res = await fetch(`${API_BASE}/api/store/${storeSlug}/account/wishlist`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      window.__storeWishlist = data.productIds || [];
      window.dispatchEvent(new CustomEvent("wishlist-updated"));
    }
  } catch { /* silent */ }
}

export default function AccountModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("login");
  const [user, setUser] = useState<StoreUser | null>(null);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>("");

  // Check real session on mount
  useEffect(() => {
    if (!STORE_SLUG) { setCheckingAuth(false); return; }
    fetch(`${API_BASE}/api/store/${STORE_SLUG}/account/profile`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.customer) {
          const c = { id: data.customer.id, name: data.customer.name, email: data.customer.email };
          setUser(c);
          window.__storeCustomer = c;
          syncCartToServer(STORE_SLUG);
          loadWishlist(STORE_SLUG);
        } else {
          setUser(null);
          window.__storeCustomer = null;
        }
      })
      .catch(() => { setUser(null); window.__storeCustomer = null; })
      .finally(() => setCheckingAuth(false));
  }, []);

  // Load Turnstile CDN script once
  useEffect(() => {
    if (document.getElementById("cf-turnstile-script")) return;
    const script = document.createElement("script");
    script.id = "cf-turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const renderTurnstile = useCallback(() => {
    if (!turnstileRef.current || !window.turnstile) return;
    if (widgetIdRef.current) {
      try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
      widgetIdRef.current = "";
    }
    setTurnstileToken("");
    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "auto",
      callback: (token: string) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setTurnstileToken(""),
    });
  }, []);

  // Render Turnstile when modal opens
  useEffect(() => {
    if (!isOpen || user || checkingAuth) return;
    const tryRender = () => {
      if (window.turnstile) { renderTurnstile(); }
      else { setTimeout(tryRender, 300); }
    };
    tryRender();
  }, [isOpen, user, checkingAuth, renderTurnstile]);

  // Re-render when tab changes
  useEffect(() => {
    if (!isOpen || user) return;
    const t = setTimeout(() => {
      if (window.turnstile) renderTurnstile();
    }, 100);
    return () => clearTimeout(t);
  }, [tab, isOpen, user, renderTurnstile]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handler);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [isOpen, onClose]);

  const resetTurnstile = () => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
    setTurnstileToken("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) { setError("Please complete the robot check."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/store/${STORE_SLUG}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginData.email, password: loginData.password, turnstileToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      const c = { id: data.customer.id, name: data.customer.name, email: data.customer.email };
      setUser(c);
      window.__storeCustomer = c;
      await syncCartToServer(STORE_SLUG);
      await loadWishlist(STORE_SLUG);
      setSuccess("Welcome back!");
      setTimeout(() => { setSuccess(""); onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      resetTurnstile();
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) { setError("Please complete the robot check."); return; }
    if (registerData.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/store/${STORE_SLUG}/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: registerData.name, email: registerData.email, password: registerData.password, turnstileToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      const c = { id: data.customer.id, name: data.customer.name, email: data.customer.email };
      setUser(c);
      window.__storeCustomer = c;
      await syncCartToServer(STORE_SLUG);
      await loadWishlist(STORE_SLUG);
      setSuccess("Account created! Welcome!");
      setTimeout(() => { setSuccess(""); onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      resetTurnstile();
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/store/${STORE_SLUG}/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    window.__storeCustomer = null;
    window.__storeWishlist = [];
    window.dispatchEvent(new CustomEvent("wishlist-updated"));
    onClose();
  };

  const isReady = !!turnstileToken;
  const googleUrl = `${API_BASE}/api/store-auth/google?storeSlug=${STORE_SLUG}&callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "/")}`;
  const inputClass = "w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <motion.div
            initial={{ opacity: 0, x: "100%" }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 z-50 flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <img src={storeInfo.logoUrl} alt={storeInfo.name} className="h-8 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {user ? "My Account" : tab === "login" ? "Sign In" : "Create Account"}
                </h2>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {checkingAuth ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : user ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User size={22} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { href: `${API_BASE}/store/${STORE_SLUG}/account/orders`, icon: Package, label: "My Orders" },
                      { href: `${API_BASE}/store/${STORE_SLUG}/account/wishlist`, icon: Heart, label: "Wishlist" },
                      { href: `${API_BASE}/store/${STORE_SLUG}/account/saved`, icon: Bookmark, label: "Saved for Later" },
                      { href: `${API_BASE}/store/${STORE_SLUG}/account/payment-methods`, icon: CreditCard, label: "Payment Methods" },
                      { href: `${API_BASE}/store/${STORE_SLUG}/account/addresses`, icon: MapPin, label: "Addresses" },
                      { href: `${API_BASE}/store/${STORE_SLUG}/account/settings`, icon: Settings, label: "Account Settings" },
                    ].map(({ href, icon: Icon, label }) => (
                      <a key={href} href={href} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary/40 hover:bg-primary/5 transition-colors group">
                        <div className="flex items-center gap-3">
                          <Icon size={18} className="text-gray-400 group-hover:text-primary transition-colors" />
                          <span className="text-gray-700 dark:text-gray-200 group-hover:text-primary font-medium transition-colors">{label}</span>
                        </div>
                        <ArrowRight size={15} className="text-gray-300 group-hover:text-primary transition-colors" />
                      </a>
                    ))}
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-red-100 dark:border-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm">
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Tab switcher */}
                  <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800/50">
                    {(["login", "register"] as Tab[]).map((t) => (
                      <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); }}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                        {t === "login" ? "Sign In" : "Sign Up"}
                      </button>
                    ))}
                  </div>

                  {/* Google — disabled until Turnstile validates */}
                  <a
                    href={isReady ? googleUrl : undefined}
                    onClick={(e) => { if (!isReady) e.preventDefault(); }}
                    aria-disabled={!isReady}
                    className={`w-full flex items-center justify-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-medium text-sm transition-colors ${isReady ? "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" : "opacity-40 cursor-not-allowed text-gray-400"}`}
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </a>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                    <span className="text-xs text-gray-400">or</span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm border border-red-100 dark:border-red-800/40">
                      <AlertCircle size={15} className="flex-shrink-0" />{error}
                    </div>
                  )}
                  {success && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-600 dark:text-green-400 text-sm border border-green-100 dark:border-green-800/40">
                      <CheckCircle2 size={15} className="flex-shrink-0" />{success}
                    </div>
                  )}

                  {/* Login form */}
                  {tab === "login" && (
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="email" value={loginData.email} onChange={e => setLoginData(p => ({...p, email: e.target.value}))} className={inputClass} placeholder="you@example.com" required />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type={showPassword ? "text" : "password"} value={loginData.password} onChange={e => setLoginData(p => ({...p, password: e.target.value}))} className={`${inputClass} pr-10`} placeholder="????????" required />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div ref={turnstileRef} />
                        {!isReady && <p className="flex items-center gap-1.5 text-xs text-gray-400"><Shield size={12} />Complete verification to enable sign in</p>}
                      </div>
                      <button type="submit" disabled={loading || !isReady}
                        className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Sign In"}
                      </button>
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        {"Don't have an account? "}
                        <button type="button" onClick={() => setTab("register")} className="text-primary hover:underline font-medium">Sign Up</button>
                      </p>
                    </form>
                  )}

                  {/* Register form */}
                  {tab === "register" && (
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
                        <div className="relative">
                          <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="text" value={registerData.name} onChange={e => setRegisterData(p => ({...p, name: e.target.value}))} className={inputClass} placeholder="John Doe" required />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type="email" value={registerData.email} onChange={e => setRegisterData(p => ({...p, email: e.target.value}))} className={inputClass} placeholder="you@example.com" required />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input type={showPassword ? "text" : "password"} value={registerData.password} onChange={e => setRegisterData(p => ({...p, password: e.target.value}))} className={`${inputClass} pr-10`} placeholder="Min. 8 characters" required />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div ref={turnstileRef} />
                        {!isReady && <p className="flex items-center gap-1.5 text-xs text-gray-400"><Shield size={12} />Complete verification to enable sign up</p>}
                      </div>
                      <button type="submit" disabled={loading || !isReady}
                        className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create Account"}
                      </button>
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                        {"Already have an account? "}
                        <button type="button" onClick={() => setTab("login")} className="text-primary hover:underline font-medium">Sign In</button>
                      </p>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {!user && (
              <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
                <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                  {"By continuing, you agree to our "}
                  <a href="/terms" className="text-primary hover:underline">Terms</a>
                  {" & "}
                  <a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a>
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
