import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "ReplyForge ⚡",
  description: "Réponses X cash & honnêtes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-gray-950`}
    >
      <body className="min-h-full bg-gray-950 text-gray-100">
        <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
          <header className="mx-auto mb-8 max-w-5xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-500">
              ReplyForge
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
              ReplyForge <span className="text-amber-500">⚡</span>
            </h1>
            <p className="mt-3 text-base font-medium text-gray-400 sm:text-lg">
              Réponses X cash & honnêtes
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
