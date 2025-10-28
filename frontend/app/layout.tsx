import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "./components/WalletProvider";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer";
import { NotificationProvider } from "./contexts/NotificationContext";
import ErrorBoundary from "./components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentRunner - Deploy Solana Agents",
  description: "Deploy and manage Solana agents with IPFS integration",
  keywords: ["Solana", "DeFi", "Agents", "Blockchain", "Trading", "Automation"],
  authors: [{ name: "AgentRunner Team" }],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" }
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900`}
      >
        <ErrorBoundary>
          <WalletContextProvider>
            <NotificationProvider>
              <Navigation />
              <main className="min-h-screen">
                {children}
              </main>
              <Footer />
            </NotificationProvider>
          </WalletContextProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
