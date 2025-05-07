import { useRouter } from 'next/navigation';
import { Button } from './ui/button';

export function UnauthorizedAccess() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Access Denied
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          You don&apos;t have permission to access this resource. Please sign in with the correct credentials.
        </p>
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => router.push('/')}
          >
            Go to Home
          </Button>
          <Button
            variant="default"
            onClick={() => router.push('/api/auth/signin')}
          >
            Sign In
          </Button>
        </div>
      </div>
    </div>
  );
} 