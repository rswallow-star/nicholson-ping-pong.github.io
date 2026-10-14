import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nicholson Dorm Ping-Pong League",
  description: "Official ELO-based ping-pong ranking and match confirmation system for Nicholson Dorm.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
