import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReVibe — Accomplishment reports",
  description:
    "Turn technicians’ chat screenshots into accomplishment reports.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Styled in globals.css (.toast*) to match the app. */}
        <Toaster
          position="bottom-right"
          closeButton
          visibleToasts={4}
          icons={{
            success: <CircleCheck size={18} />,
            error: <CircleAlert size={18} />,
            warning: <TriangleAlert size={18} />,
            info: <Info size={18} />,
            loading: (
              <LoaderCircle size={18} className="motion-safe:animate-spin" />
            ),
          }}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: "toast",
              icon: "toast-icon",
              content: "toast-content",
              title: "toast-title",
              description: "toast-description",
              closeButton: "toast-close",
              actionButton: "toast-action",
              success: "toast-success",
              error: "toast-error",
              warning: "toast-warning",
              info: "toast-info",
              loading: "toast-loading",
            },
          }}
        />
      </body>
    </html>
  );
}
