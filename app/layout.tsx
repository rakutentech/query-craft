import { Theme } from '@radix-ui/themes';
import { Providers } from '@/components/Providers';
import { Metadata } from 'next';
import Link from 'next/link';
import { inter } from "./fonts";
import "@radix-ui/themes/styles.css";
import "./globals.css";
import packageJson from "../package.json";
import {ChatProviderConfigProvider} from "@/app/context/ChatProviderConfigContext";

export const metadata: Metadata = {
  title: 'Query Craft',
  description: 'A powerful database query tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <Providers>
          <Theme>
            <nav className="bg-gray-800 text-white p-4">
              <div className="container mx-auto flex justify-between items-center">
                <span className="text-xl font-bold flex items-center space-x-2">
                  <Link href="/">QueryCraft</Link>
                  <span className="text-sm text-gray-500">V{packageJson.version}</span>
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
            <div className="main">
            <ChatProviderConfigProvider>
              {children}
            </ChatProviderConfigProvider>
          </div>
          </Theme>
        </Providers>
      </body>
    </html>
  );
}
