import React from 'react';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";

interface HeaderProps {
  showLeftPanel: boolean;
  toggleLeftPanel: () => void;
  showAuth: boolean;
  session: any;
  signOut: () => void;
  signIn: (provider: string) => void;
}

export const ChatHeader: React.FC<HeaderProps> = ({
  showLeftPanel,
  toggleLeftPanel,
  showAuth,
  session,
  signOut,
  signIn,
}) => (
  <div className="flex justify-between items-center pb-2">
    <div className="flex items-center">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={toggleLeftPanel}
        className="mr-2 "
        aria-label={showLeftPanel ? "Hide sidebar" : "Show sidebar"}
      >
        {showLeftPanel ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
      <h1 className="text-2xl items-center font-bold p-2">
        Chat
      </h1>
    </div>
    <div className="flex items-center space-x-4">
      {showAuth && (
        session ? (
          <div className="flex items-center space-x-2">
            <Avatar className="w-8 h-8">
              {session.user?.image ? (
                <AvatarImage src={session.user.image} alt={session.user.name || 'User avatar'} />
              ) : (
                <AvatarFallback className="bg-primary/20">
                  {session.user?.name ? session.user.name[0] : <User className="w-5 h-5 text-primary" />}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="font-medium text-sm text-foreground">{session.user?.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
            >
              Sign Out
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => signIn('github')}
          >
            Sign In
          </Button>
        )
      )}
    </div>
  </div>
);
