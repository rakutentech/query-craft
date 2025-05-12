'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

export default function SignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <div className="mt-8 space-y-6">
          <Button
            onClick={() => signIn('github', { callbackUrl: '/' })}
            className="w-full"
            variant="outline"
          >
            <Github className="mr-2 h-4 w-4" />
            Sign in with GitHub
          </Button>
        </div>
      </div>
    </div>
  );
} 