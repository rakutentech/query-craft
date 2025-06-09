'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GripVertical } from 'lucide-react';

interface ResizableSplitterProps {
  onResize: (newSize: number) => void;
  initialPosition?: number; // percentage (0-100)
  minLeftWidth?: number; // percentage
  minRightWidth?: number; // percentage
  className?: string;
}

export default function ResizableSplitter({
  onResize,
  initialPosition = 50,
  minLeftWidth = 20,
  minRightWidth = 20,
  className = '',
}: ResizableSplitterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const splitterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleResize = useCallback(
    (clientX: number) => {
      if (!isDragging) return;

      // Find the container element if not already cached
      if (!containerRef.current) {
        containerRef.current = document.getElementById('resizable-container');
      }
      
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = clientX - containerRect.left;
      let newPosition = (mouseX / containerWidth) * 100;

      // Enforce min widths
      newPosition = Math.max(minLeftWidth, Math.min(newPosition, 100 - minRightWidth));
      
      onResize(newPosition);
    },
    [isDragging, minLeftWidth, minRightWidth, onResize]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleResize(e.clientX);
    },
    [handleResize]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleResize(e.touches[0].clientX);
      }
    },
    [handleResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={splitterRef}
      className={`w-2 cursor-col-resize bg-border dark:bg-border hover:bg-border/80 dark:hover:bg-border/80 transition-colors flex items-center justify-center active:bg-primary active:dark:bg-primary ${
        isDragging ? 'bg-primary dark:bg-primary' : ''
      } ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{ touchAction: 'none' }}
    >
      <div className="h-12 w-5 flex items-center justify-center rounded hover:bg-accent dark:hover:bg-accent">
        <GripVertical className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
      </div>
    </div>
  );
} 