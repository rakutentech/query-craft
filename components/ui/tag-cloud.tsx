import * as React from "react"

import { cn } from "@/lib/utils"

export interface TablesProps
    extends React.HTMLAttributes<HTMLUListElement> {
    tags: string[]
    onTagClick?: (tag: string) => void
    selectedTags?: string[]
}

const TagCloud = React.forwardRef<HTMLUListElement, TablesProps>(
    ({ className, tags, onTagClick, selectedTags = [], ...props }, ref) => {
        return (
            <ul
                ref={ref}
                className={cn(
                    "flex gap-2 flex-row items-start justify-start w-full max-h-96",
                    "overflow-y-auto p-4 flex-wrap border rounded-md",
                    "border-border bg-background",
                    className
                )}
                {...props}
            >
                {tags.length === 0 && (
                    <li className="flex items-center justify-center w-full p-2 text-muted-foreground">
                        <span className="text-sm font-medium">No tables found</span>
                    </li>
                )}
                {tags.map((tag, index) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                        <li
                            key={index}
                            className={cn(
                                "flex items-center justify-between p-2 border rounded-md cursor-pointer transition-colors",
                                "hover:bg-primary/10 hover:border-primary/20",
                                isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-secondary text-secondary-foreground"
                            )}
                            onClick={() => onTagClick?.(tag)}
                        >
                            <span className="text-sm font-medium">{tag}</span>
                        </li>
                    );
                })}
            </ul>
        )
    }
)
TagCloud.displayName = "Tags"
export { TagCloud }