'use client';

import { Theme } from '@radix-ui/themes';
import { Providers } from '@/components/Providers';
import Link from 'next/link';
import { inter } from "../app/fonts";
import Image from "next/image";
import { Home, Settings, HelpCircle, Sun, Moon } from 'lucide-react';
import "@radix-ui/themes/styles.css";
import "@/app/globals.css";
import packageJson from "../package.json";
import {ChatProviderConfigProvider} from "@/app/context/ChatProviderConfigContext";
import { Toaster } from "@/components/ui/toaster"
import { AboutDialog } from '@/components/AboutDialog';
import { useState, useEffect } from 'react';

export default function LayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showAbout, setShowAbout] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check for system preference or saved preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (systemPrefersDark) {
      setTheme('dark');
    }

    window.showAbout = () => setShowAbout(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`} data-theme={theme}>
        <Providers>
          <Theme appearance={theme} accentColor="blue" grayColor="slate" scaling="100%" radius="medium">
            <nav className="bg-gray-100 dark:bg-gray-800 text-black dark:text-white p-2">
              <div className="container mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Link href="/" className="hover:opacity-80 transition-opacity">
                    <Image width={100} height={50} src="/logo.png" alt="Query Craft" />
                  </Link>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-bold">V{packageJson.version}</span>
                </div>
                <div className="flex items-center space-x-1 mr-2">
                  <Link 
                    href="/" 
                    className="hover:text-blue-100 flex items-center px-3 py-2 rounded-md transition-colors hover:bg-gray-700"
                  >
                    <Home className="h-5 w-5 m-1" />
                  </Link>
                  <Link 
                    href="/settings" 
                    className="hover:text-blue-100 flex items-center px-3 py-2 rounded-md transition-colors hover:bg-gray-700"
                  >
                    <Settings className="h-5 w-5 m-1" />
                  </Link>
                  <button
                    onClick={() => setShowAbout(true)}
                    className="hover:text-blue-100 flex items-center px-3 py-2 rounded-md transition-colors hover:bg-gray-700"
                  >
                    <HelpCircle className="h-5 w-5 m-1" />
                  </button>
                  <button
                    onClick={toggleTheme}
                    className="hover:text-blue-100 flex items-center px-3 py-2 rounded-md transition-colors hover:bg-gray-700"
                    aria-label="Toggle theme"
                  >
                    {theme === 'light' ? <Moon className="h-5 w-5 m-1" /> : <Sun className="h-5 w-5 m-1" />}
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