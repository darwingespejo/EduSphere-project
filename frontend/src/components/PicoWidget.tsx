import { lazy, Suspense } from "react";
import { useAuth } from "@/lib/store";
import "./PicoWidget.css";

const PicoAssistant = lazy(() => import("@/components/pico/PicoAssistant.jsx"));

export default function PicoWidget() {
  const { access, user } = useAuth();

  return (
    <div className="pico-path-assistant">
      <Suspense fallback={<div className="pico-widget-loading">Loading Pico…</div>}>
        <PicoAssistant
          endpoint="/api/pico/chat"
          context={{ page: "/path", userName: user?.name ?? "" }}
          conversationKey={user?.id ?? "guest"}
          fetchOptions={access ? { headers: { Authorization: `Bearer ${access}` } } : undefined}
          greeting={false}
          showAngles={false}
          persistentChat
        />
      </Suspense>
    </div>
  );
}
