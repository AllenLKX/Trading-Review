import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/PwaRegistration";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import "./globals.css";

const themeInitializer = `(() => {
  try {
    const saved = window.localStorage.getItem("rationaltrade.theme.v1");
    const theme = saved === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    window.addEventListener("DOMContentLoaded", () => {
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#f3f6f8" : "#051425");
    }, { once: true });
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();`;

export const metadata: Metadata = {
  title: "RationalTrade",
  description: "交易决策记录与行为复盘工具",
  applicationName: "RationalTrade",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RationalTrade"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#051425"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>
        {children}
        <NetworkStatusBanner />
        <AnalyticsTracker />
        <PwaRegistration />
      </body>
    </html>
  );
}
