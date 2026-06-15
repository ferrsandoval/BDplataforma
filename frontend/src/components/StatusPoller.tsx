import { useEffect, useRef } from "react";
import { getProfile } from "../lib/api";
import type { EnrichedProfile } from "../lib/types";

interface Props {
  requestId: string;
  onUpdate: (profile: EnrichedProfile) => void;
  active: boolean;
}

const TERMINAL_STATUSES = new Set(["complete", "partial", "error"]);

export default function StatusPoller({ requestId, onUpdate, active }: Props) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;

    const poll = async () => {
      try {
        const profile = await getProfile(requestId);
        onUpdate(profile);
        if (TERMINAL_STATUSES.has(profile.status)) {
          clearInterval(timerRef.current!);
        }
      } catch {
        // network hiccup — keep polling
      }
    };

    poll();
    timerRef.current = setInterval(poll, 3000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [requestId, active, onUpdate]);

  return null;
}
