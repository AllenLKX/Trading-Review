import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";

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
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#051425"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
