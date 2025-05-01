'use client';

import { Theme } from '@radix-ui/themes';
import { Providers } from '@/components/Providers';
import Link from 'next/link';
import { inter } from "../app/fonts";
import Image from "next/image";
import { Home, Settings, HelpCircle } from 'lucide-react';
import "@radix-ui/themes/styles.css";
import "../app/globals.css";
import packageJson from "../package.json";
import {ChatProviderConfigProvider} from "@/app/context/ChatProviderConfigContext";
import { Toaster } from "@/components/ui/toaster"
import { AboutDialog } from '@/components/about-dialog';
import { useState, useEffect } from 'react';

export default function LayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    window.showAbout = () => setShowAbout(true);
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>
          <Theme>
            <nav className="bg-gray-100 text-black p-2">
              <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Link href="/" className="hover:opacity-80 transition-opacity">
                    <Image width={80} height={30} src="/logo.png" alt="Query Craft" />
                  </Link>
                  <span className="text-sm text-gray-500">V{packageJson.version}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Link 
                    href="/" 
                    className="hover:text-blue-300 flex items-center px-3 py-2 rounded-md transition-colors hover:bg-gray-700"
                  >
                    <Home className="h-5 w-5 mr-2" />
                  </Link>
                  <Link 
                    href="/settings" 
                    className="hover:text-blue-300 flex items-center px-3 py-2 rounded-md transition-colors hover:bg-gray-700"
                  >
                    <Settings className="h-5 w-5 mr-2" />
                  </Link>
                  <button
                    onClick={() => setShowAbout(true)}
                    className="hover:text-blue-300 flex items-center px-3 py-2 rounded-md transition-colors hover:bg-gray-700"
                  >
                    <HelpCircle className="h-5 w-5 mr-2" />
                  </button>
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
        <Toaster />
        <AboutDialog open={showAbout} onOpenChange={setShowAbout} />
      </body>
    </html>
  );
} 