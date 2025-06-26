import React from 'react';
import { Card, CardHeader, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Database } from 'lucide-react';

interface DatabaseSidebarProps {
  uniqueTags: string[];
  selectedTag: string | null;
  handleTagSelect: (tag: string | null) => void;
  filteredConnections: any[];
  selectedConnectionId: number | null;
  handleConnectionSelect: (id: number) => void;
}

export const DatabaseSidebar: React.FC<DatabaseSidebarProps> = ({
  uniqueTags,
  selectedTag,
  handleTagSelect,
  filteredConnections,
  selectedConnectionId,
  handleConnectionSelect,
}) => (
  <Card className="mb-2 h-[calc(100vh-350px)] flex flex-col bg-card border border-border shadow-md">
    <CardHeader className="border-b border-border py-2">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Databases</h2>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="flex flex-col h-full">
        {uniqueTags.length > 0 && (
          <div className="mb-2 mt-2 px-2">
            <div className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground mb-2">Filter by Tags</div>
            <div className="flex flex-wrap gap-1 overflow-y-auto">
              <Button
                variant={!selectedTag ? "default" : "outline"}
                size="sm"
                className={`px-2 py-1 text-xs ${!selectedTag ? "bg-primary hover:bg-primary/80 text-primary-foreground" : "hover:border-primary/50 dark:hover:border-primary/70"}`}
                onClick={() => handleTagSelect(null)}
              >
                All
              </Button>
              {uniqueTags.map(tag => (
                <Button
                  key={tag}
                  variant={selectedTag === tag ? "default" : "outline"}
                  size="sm"
                  className={`px-2 py-1 text-xs ${selectedTag === tag ? "bg-primary hover:bg-primary/80 text-primary-foreground" : "hover:border-primary/50 dark:hover:border-primary/70"}`}
                  onClick={() => handleTagSelect(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="flex-grow overflow-y-auto">
          <ul className="divide-y divide-border">
            {filteredConnections.map((connection) => (
              <li 
                key={connection.id}
                className={`list-item px-2 py-1 cursor-pointer flex items-center ${selectedConnectionId === connection.id ? "selected font-medium text-foreground 2" : "text-foreground dark:text-foreground"}`}
                onClick={() => handleConnectionSelect(connection.id)}
              >
                <div className="flex items-center w-full">
                  <Database className={`h-4 w-4 mr-2 ${selectedConnectionId === connection.id ? "text-primary dark:text-primary" : "text-muted-foreground dark:text-muted-foreground"}`} />
                  <span className="text-xs font-medium truncate">{connection.projectName}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CardContent>
  </Card>
);
