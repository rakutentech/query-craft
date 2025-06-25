import React from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

interface ChatInputProps {
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  handleSendMessage: () => void;
  handleStopStreaming: () => void;
  isLoading: boolean;
  isStreaming: boolean;
  selectedConnectionId: number | null;
  handleRecommendationKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  showRecommendations: boolean;
  dropdownActive: boolean;
  highlightedIndex: number;
  recommendations: string[];
  setShowRecommendations: (show: boolean) => void;
  setDropdownActive: (active: boolean) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputMessage,
  setInputMessage,
  handleSendMessage,
  handleStopStreaming,
  isLoading,
  isStreaming,
  selectedConnectionId,
  handleRecommendationKeyDown,
  showRecommendations,
  dropdownActive,
  highlightedIndex,
  recommendations,
  setShowRecommendations,
  setDropdownActive,
}) => (
  <div className="flex space-x-2 relative">
    <Textarea
      value={inputMessage}
      onChange={(e) => {
        setInputMessage(e.target.value);
        setShowRecommendations(true);
        setDropdownActive(false);
      }}
      placeholder="Type your query..."
      onFocus={() => setShowRecommendations(true)}
      onBlur={() => setDropdownActive(false)}
      onKeyDown={(e) => {
        handleRecommendationKeyDown(e);
        if (
          e.key === 'Enter' &&
          !e.shiftKey &&
          (!showRecommendations || !dropdownActive || highlightedIndex === -1)
        ) {
          e.preventDefault();
          handleSendMessage();
          setShowRecommendations(false);
          setDropdownActive(false);
        }
      }}
      className="flex-1 min-h-[30px] max-h-[100px] resize-y"
      disabled={!selectedConnectionId}
      aria-autocomplete="list"
      aria-controls={showRecommendations ? 'recommendations-list' : undefined}
      aria-activedescendant={highlightedIndex >= 0 ? `recommendation-item-${highlightedIndex}` : undefined}
      aria-expanded={showRecommendations}
      role="combobox"
    />
    <Button
      onClick={handleSendMessage}
      disabled={isLoading || isStreaming || !selectedConnectionId}
      className="bg-primary hover:bg-primary/80 text-primary-foreground"
    >
      Send
    </Button>
    {isStreaming && (
      <Button
        onClick={handleStopStreaming}
        variant="destructive"
        className="mt-2"
        size="icon"
        aria-label="Stop Streaming"
      >
        {/* You can use an icon here if desired */}
        Stop
      </Button>
    )}
  </div>
);
