import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/lib/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SocietyOS Admin",
  description: "Society administration console — SocietyOS ERP & Gate Security",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
