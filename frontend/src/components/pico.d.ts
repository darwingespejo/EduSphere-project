declare module "@/components/pico/PicoAssistant.jsx" {
  import type { ComponentType } from "react";

  type PicoAssistantProps = {
    chips?: { label: string; say: string }[];
    context?: Record<string, string>;
    conversationKey?: string;
    endpoint?: string | null;
    fetchOptions?: { headers?: Record<string, string> };
    greeting?: string | false;
    persistentChat?: boolean;
    showAngles?: boolean;
    showReadout?: boolean;
    showTools?: boolean;
  };

  const PicoAssistant: ComponentType<PicoAssistantProps>;
  export default PicoAssistant;
}
