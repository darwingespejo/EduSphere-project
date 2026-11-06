"use client";
import { useSearchParams } from "@/router/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Check, CreditCard, Info, Smartphone, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { toast } from "@/components/Toasts";
import { api } from "@/lib/api";

const PLANS = [
  {
    key: "pro",
    name: "Pro",
    price: "₱699 / 30 days",
    items: [
      { title: "Hidden-test insights", detail: "See additional test feedback after passing an exercise." },
      { title: "Course certificates", detail: "Earn verifiable certificates when you complete eligible courses." },
      { title: "Priority peer review", detail: "Get priority when matching with peer reviewers." },
    ],
  },
  {
    key: "team",
    name: "Team",
    price: "₱469 / seat · 30 days",
    items: [
      { title: "Instructor dashboards", detail: "Track cohort progress and learning activity." },
      { title: "Cohort leaderboards", detail: "Give your team a shared view of progress." },
      { title: "Live session scheduling", detail: "Schedule sessions for your cohort." },
    ],
    min: "3 seats · ₱1,407 total",
  },
];

function BillingInner() {
  const search = useSearchParams();
  const paymentReturned = search.get("paid") === "1";
  const paymentCancelled = search.get("cancelled") === "1";
  const [subscription, setSubscription] = useState<{ plan: string; status: string; expiresAt: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingError, setBillingError] = useState("");
  const [processingPlan, setProcessingPlan] = useState("");
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadSubscription = async () => {
      if (paymentReturned) {
        const verification = await api.post<{ verified: boolean }>("/api/v1/payments/verify", {});
        if (cancelled) return;
        if (!verification.success) setBillingError(verification.message);
      }

      const attempts = paymentReturned ? 10 : 1;
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (cancelled) return;
        const res = await api.get<{ subscription: { plan: string; status: string; expiresAt: string | null } | null }>("/api/v1/payments/subscription");
        if (cancelled) return;
        if (!res.success) {
          setBillingError(res.message);
          setLoading(false);
          return;
        }
        setSubscription(res.data.subscription);
        setLoading(false);
        if (res.data.subscription?.status === "active" || attempt === attempts - 1) return;
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }
    };
    void loadSubscription();
    return () => { cancelled = true; };
  }, [paymentReturned, verificationAttempt]);

  const checkout = async (plan: string) => {
    setProcessingPlan(plan);
    const res = await api.post<{ url: string }>("/api/v1/payments/checkout", { plan });
    if (!res.success) {
      toast.err(res.message);
      setProcessingPlan("");
      return;
    }

    let checkoutUrl: URL;
    try {
      checkoutUrl = new URL(res.data.url);
    } catch {
      toast.err("PayMongo returned an invalid checkout URL. No payment was made.");
      setProcessingPlan("");
      return;
    }
    if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.paymongo.com") {
      toast.err("PayMongo returned an unexpected checkout URL. No payment was made.");
      setProcessingPlan("");
      return;
    }
    window.location.assign(checkoutUrl.href);
  };

  const currentPlan = subscription?.status === "active"
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    : "Free";

  return (
    <div>
      <PageHeader title="Billing" sub="Pay securely with GCash, Maya, or card through PayMongo. Each purchase grants 30 days of access; renew manually when it expires." />

      <div className="card mb-6 overflow-hidden border-primary/25 bg-gradient-to-br from-primary/5 via-surface to-mint/5 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <WalletCards size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="display font-bold">Payment methods</h2>
            <p className="mt-1 text-sm text-muted">Choose an available option on PayMongo’s secure checkout.</p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Requested payment methods">
              <span className="inline-flex items-center gap-2 rounded-xl border border-mint/25 bg-mint/10 px-3 py-2 text-sm font-semibold text-text">
                <Smartphone size={16} className="text-mint" aria-hidden="true" /> GCash
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-text">
                <Smartphone size={16} className="text-primary" aria-hidden="true" /> Maya
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-line bg-raised/60 px-3 py-2 text-sm font-semibold text-text">
                <CreditCard size={16} className="text-muted" aria-hidden="true" /> Credit / debit card
              </span>
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Info size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              PayMongo only displays methods activated for your merchant account. If checkout says “No payment methods are available,” request activation in PayMongo Dashboard → Settings → Payment Methods, then start a new checkout.
            </p>
          </div>
        </div>
      </div>

      {paymentCancelled && (
        <div className="card p-4 mb-6 text-sm text-muted">Checkout was cancelled. No payment was completed.</div>
      )}

      {paymentReturned && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-4 mb-6 flex flex-wrap items-center gap-3 border-mint/40">
          {subscription?.status === "active"
            ? <Check size={17} className="text-mint" />
            : <Info size={17} className="text-primary" />}
          <p className="text-sm flex-1">
            {subscription?.status === "active"
              ? <>Your {currentPlan} plan is active until {subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : "further notice"}.</>
              : loading
                ? "Payment returned. Checking the transaction with PayMongo..."
                : billingError
                  ? <>We couldn’t verify the payment: {billingError}</>
                  : "We haven’t received PayMongo’s payment confirmation yet. Your plan will activate once payment is verified."}
          </p>
          {subscription?.status !== "active" && !loading && (
            <button
              type="button"
              className="btn btn-ghost text-xs"
              onClick={() => {
                setBillingError("");
                setLoading(true);
                setVerificationAttempt((attempt) => attempt + 1);
              }}
            >
              Check payment again
            </button>
          )}
        </motion.div>
      )}

      <div className="card p-5 mb-6 flex items-start gap-3">
        <Info size={16} className="text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted leading-relaxed">
          Current plan: <span className="inline-flex items-center gap-1.5 text-text font-semibold">
            {subscription?.status === "active" && <BadgeCheck size={16} className="text-mint" aria-label="Active subscription" />}
            {loading ? "Loading..." : currentPlan}
          </span>
          {subscription && subscription.status !== "active" && <> ({subscription.status.replaceAll("_", " ")})</>}.
          {billingError
            ? <> Billing status could not be loaded: {billingError}</>
            : <> Paid plan purchases are one-time payments in Philippine pesos and expire after 30 days. They do not auto-renew.</>}
        </p>
      </div>

      <p className="text-xs text-muted mb-4 max-w-2xl">
        PayMongo processes checkout; plans activate only after a verified paid webhook. Active Pro and Team plans unlock Gemini study chat and Pico on your learning path.
      </p>

      <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
        {PLANS.map((p, i) => (
          <motion.div key={p.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="eyebrow">{p.name}</p>
              {subscription?.status === "active" && subscription.plan === p.key && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint">
                  <BadgeCheck size={14} aria-hidden="true" /> Current plan
                </span>
              )}
            </div>
            <p className="display text-3xl font-extrabold mt-2">{p.price}</p>
            <ul className="space-y-2 mt-5 flex-1">
              {p.items.map((it) => (
                <li key={it.title} className="flex gap-2 text-sm">
                  <Check size={14} className="text-mint shrink-0 mt-0.5" />
                  <span><span className="text-text">{it.title}</span><span className="block text-xs text-muted mt-0.5">{it.detail}</span></span>
                </li>
              ))}
            </ul>
            {p.min && <p className="text-xs text-muted mt-3">Minimum purchase: {p.min}</p>}
            <button className="btn btn-primary mt-6" disabled={!!processingPlan} onClick={() => checkout(p.key)}>
              <CreditCard size={15} /> {processingPlan === p.key ? "Starting checkout..." : `Checkout ${p.name}`}
            </button>
            <p className="font-mono text-[10px] text-muted mt-2.5 text-center">Pay with GCash, Maya, or card · secured by PayMongo</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return <Suspense><BillingInner /></Suspense>;
}
