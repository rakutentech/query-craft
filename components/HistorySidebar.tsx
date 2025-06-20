import React from 'react';
import { Card, CardHeader, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface HistorySidebarProps {
  currentConversation: any[];
  conversationId: number | null;
  editingTitleId: number | null;
  editingTitle: string;
  handleTitleEdit: (conv: any) => void;
  handleTitleSave: (id: number) => void;
  setEditingTitle: (title: string) => void;
  setEditingTitleId: (id: number | null) => void;
  handleConversationClick: (conv: any) => void;
  handleNewConversation: () => void;
  filterHistory: (text: string) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  currentConversation,
  conversationId,
  editingTitleId,
  editingTitle,
  handleTitleEdit,
  handleTitleSave,
  setEditingTitle,
  setEditingTitleId,
  handleConversationClick,
  handleNewConversation,
  filterHistory,
}) => (
  <Card className="h-[225px] flex flex-col bg-card border border-border shadow-md">
    <CardHeader className="border-b border-border py-2">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">History</h2>
        <Button
          onClick={handleNewConversation}
          variant="outline"
          size="sm"
          className="text-primary dark:text-primary border-primary dark:border-primary btn-hover-enhanced px-2 py-1 text-xs"
        >
          New Chat
        </Button>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="flex items-center justify-between p-2 border-b border-gray-100">
        <Input
          placeholder="Search..."
          className="h-7 text-xs border border-gray-300 rounded-md px-2 w-full"
          onChange={(e) => filterHistory(e.target.value)}
        />
      </div>
      <div className="h-[140px] overflow-auto">
        <ul className="divide-y divide-border">
          {currentConversation.map((conversation) => (
            <li
              key={conversation.id}
              className={`list-item px-2 py-1 cursor-pointer flex items-center ${conversation.id === conversationId ? "selected font-medium text-foreground dark:text-foreground" : "text-foreground dark:text-foreground"}`}
            >
              <div className="flex items-center justify-between w-full pr-1">
                {editingTitleId === conversation.id ? (
                  <div className="flex-1 mr-1">
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleSave(conversation.id);
                        else if (e.key === 'Escape') { setEditingTitleId(null); setEditingTitle(""); }
                      }}
                      className="h-6 text-xs px-1 bg-background dark:bg-background text-foreground dark:text-foreground"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div
                    className="flex-1 truncate"
                    onClick={() => handleConversationClick(conversation)}
                  >
                    <p className="text-xs font-medium truncate">{conversation.title}</p>
                  </div>
                )}
                <div className="flex items-center space-x-1 flex-shrink-0">
                  {editingTitleId === conversation.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTitleSave(conversation.id)}
                        className="h-6 w-6 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 btn-hover-enhanced"
                      >
                        ✓
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditingTitleId(null); setEditingTitle(""); }}
                        className="h-6 w-6 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-foreground btn-hover-enhanced"
                      >
                        ↺
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); handleTitleEdit(conversation); }}
                      className="h-6 w-6 text-muted-foreground dark:text-muted-foreground hover:text-primary dark:hover:text-primary btn-hover-enhanced"
                    >
                      ✎
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </CardContent>
  </Card>
);
