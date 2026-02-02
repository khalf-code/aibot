import { createRootRoute, Outlet, useLocation } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";
import { ThemeProvider, ShortcutsProvider } from "@/providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import { OnboardingGuard } from "@/components/OnboardingGuard";
import { UnlockGuard } from "@/features/security/components/unlock/UnlockGuard";
import { useGatewayStreamHandler } from "@/hooks";

export const Route = createRootRoute({
  component: RootLayout,
});

/** Paths where the AppShell should be hidden (fullscreen pages) */
const FULLSCREEN_PATHS = ["/onboarding", "/unlock"] as const;

function RootLayout() {
  const location = useLocation();
  const isFullscreen = FULLSCREEN_PATHS.some((path) =>
    location.pathname.startsWith(path)
  );

  // Enable gateway stream handler to process streaming events
  useGatewayStreamHandler({ enabled: true });

  return (
    <ThemeProvider>
      <ShortcutsProvider>
        <ErrorBoundary>
          <OnboardingGuard>
            <UnlockGuard>
              {isFullscreen ? (
                <Outlet />
              ) : (
                <AppShell>
                  <Outlet />
                </AppShell>
              )}
            </UnlockGuard>
          </OnboardingGuard>
        </ErrorBoundary>
        <Toaster
          position="bottom-right"
          expand={false}
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "font-sans",
            },
          }}
        />
        {import.meta.env.DEV && (
          <TanStackRouterDevtools position="bottom-right" />
        )}
      </ShortcutsProvider>
    </ThemeProvider>
  );
}
