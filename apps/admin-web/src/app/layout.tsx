import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SocietyOS Admin",
  description: "Society administration console — SocietyOS ERP & Gate Security",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
