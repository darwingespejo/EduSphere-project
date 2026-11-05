"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/Toasts";
import { api } from "@/lib/api";
import type { User } from "@/lib/store";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export type GoogleSession = {
  user: User;
  access: string;
  refresh: string;
  isNew: boolean;
};

type GoogleAuthProps = {
  mode: "login" | "register";
  onSuccess: (session: GoogleSession) => void;
};

export default function GoogleAuth({ mode, onSuccess }: GoogleAuthProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const [busy, setBusy] = useState(false);
  const clientId = import.meta.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (!clientId) return;

    const render = () => {
      if (!ref.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response.credential) {
            toast.err("Google did not return a sign-in credential. Please try again.");
            return;
          }

          setBusy(true);
          void api.post<GoogleSession>("/api/v1/auth/google", {
            credential: response.credential,
          }).then((result) => {
            setBusy(false);
            if (!result.success) {
              toast.err(result.message);
              return;
            }
            onSuccessRef.current(result.data);
          });
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: mode === "login" ? "signin_with" : "signup_with",
        shape: "pill",
        logo_alignment: "left",
        width: 320,
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      if (window.google) {
        render();
      } else {
        existing.addEventListener("load", render, { once: true });
      }
      return () => existing.removeEventListener("load", render);
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => toast.err("Google sign-in could not load. Check your connection and try again.");
    document.head.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [clientId, mode]);

  if (!clientId) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-raised/70 px-3 py-2.5 text-center text-xs text-muted">
        Google sign-in is not configured yet.
      </div>
    );
  }

  return (
    <div className="relative flex justify-center" aria-busy={busy}>
      {busy && <div className="absolute inset-0 z-10 cursor-wait" aria-label="Signing in with Google" />}
      <div ref={ref} />
    </div>
  );
}
