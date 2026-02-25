import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { FeedbackWidget } from "./FeedbackWidget";

const FEEDBACK_LOGIN_AT_KEY = "feedback_login_at";
const FEEDBACK_DEMO_SESSION_ID_KEY = "feedback_demo_session_id";
const FEEDBACK_DISMISSED_PREFIX = "feedback_dismissed_";
const FEEDBACK_DISMISSED_DEMO_PREFIX = "feedback_dismissed_demo_";
const DELAY_MS = 3 * 60 * 1000; // 3 minutes

function getDemoSessionId(): string {
  let id = sessionStorage.getItem(FEEDBACK_DEMO_SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(FEEDBACK_DEMO_SESSION_ID_KEY, id);
  }
  return id;
}

function isDemoUser(): boolean {
  try {
    const raw = localStorage.getItem("current_user");
    if (!raw) return false;
    const user = JSON.parse(raw);
    const t = (user?.subscriptionType || "").toLowerCase().trim();
    return t === "demo" || t.startsWith("demo_");
  } catch {
    return false;
  }
}

function getDismissedKey(): string {
  if (isDemoUser()) {
    return FEEDBACK_DISMISSED_DEMO_PREFIX + getDemoSessionId();
  }
  const raw = localStorage.getItem("current_user");
  try {
    const user = raw ? JSON.parse(raw) : null;
    const id = user?.id ?? null;
    if (id != null) return FEEDBACK_DISMISSED_PREFIX + id;
  } catch {}
  return FEEDBACK_DISMISSED_PREFIX + "unknown";
}

function isDismissed(): boolean {
  const key = getDismissedKey();
  if (key.startsWith(FEEDBACK_DISMISSED_DEMO_PREFIX)) {
    return sessionStorage.getItem(key) === "1";
  }
  return localStorage.getItem(key) === "1";
}

function setDismissed(): void {
  const key = getDismissedKey();
  if (key.startsWith(FEEDBACK_DISMISSED_DEMO_PREFIX)) {
    sessionStorage.setItem(key, "1");
  } else {
    localStorage.setItem(key, "1");
  }
}

export function FeedbackTrigger() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loginAt = sessionStorage.getItem(FEEDBACK_LOGIN_AT_KEY);
    if (!loginAt || isDismissed()) return;

    const loginTime = parseInt(loginAt, 10);
    if (isNaN(loginTime)) return;

    const elapsed = Date.now() - loginTime;
    const remaining = Math.max(0, DELAY_MS - elapsed);

    const scheduleShow = () => {
      if (document.visibilityState !== "visible") return;
      if (isDismissed()) return;
      setShowModal(true);
    };

    if (remaining === 0) {
      scheduleShow();
      return;
    }

    timerRef.current = setTimeout(scheduleShow, remaining);

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (timerRef.current != null) return;
      const now = Date.now();
      const elapsed = now - loginTime;
      if (elapsed >= DELAY_MS && !isDismissed()) setShowModal(true);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed();
    setShowModal(false);
  };

  const isDemo = isDemoUser();
  const demoSessionId = isDemo ? getDemoSessionId() : null;
  const userId = user?.id ?? null;

  return (
    <FeedbackWidget
      visible={showModal}
      onDismiss={handleDismiss}
      userId={userId}
      isDemo={isDemo}
      demoSessionId={demoSessionId}
    />
  );
}
