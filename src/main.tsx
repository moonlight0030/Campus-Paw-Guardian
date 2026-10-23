import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
  ignoreErrors: [
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    'Network request failed',
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
  ],
  beforeSend(event, hint) {
    const error = hint.originalException;
    if (error && typeof error === 'object' && 'message' in error) {
      const msg = String(error.message);
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('Load failed')
      ) {
        return null;
      }
    }
    return event;
  },
});

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p>应用发生错误，请刷新页面重试</p>}>
    <AppWrapper>
      <App />
    </AppWrapper>
  </Sentry.ErrorBoundary>
);
