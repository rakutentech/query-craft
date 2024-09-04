import type { Metadata } from "next";
import Link from "next/link";
import { inter } from "./fonts";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Query Craft",
  description: "Use Natural Language to query database."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <Theme>
          <nav className="bg-gray-800 text-white p-4">
            <div className="container mx-auto flex justify-between items-center">
              <span className="text-xl font-bold">
                <Link href="/">QueryCraft</Link>
              </span>
              <div className="space-x-4">
                <Link href="/" className="hover:text-blue-300">
                  Home
                </Link>
                <Link href="/settings" className="hover:text-blue-300">
                  Settings
                </Link>
              </div>
            </div>
          </nav>
          <div className="main">{children}</div>
        </Theme>
      </body>
    </html>
  );
}
