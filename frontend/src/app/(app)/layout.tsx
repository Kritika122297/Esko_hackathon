import { AppHeader } from "@/components/layout/AppHeader";
import { BriefBar, RouteEnter } from "@/components/layout/BriefBar";
import { BusyToast } from "@/components/shared/Notice";
import { ChatPanel } from "@/components/chat/ChatPanel";

/** The working app: top bar, the open brief's bar with its four stages, and the page. */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="flex min-h-screen min-w-0 flex-col">
        <AppHeader />
        <BriefBar />
        <main id="main" className="mx-auto w-full max-w-page flex-1 px-4 pb-16 pt-6 md:px-6 md:pt-8 xl:px-8">
          <RouteEnter>{children}</RouteEnter>
        </main>
      </div>
      <ChatPanel />
      <BusyToast />
    </>
  );
}
