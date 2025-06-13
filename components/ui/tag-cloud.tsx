import * as React from "react"

import { cn } from "@/lib/utils"

export interface TablesProps
    extends React.HTMLAttributes<HTMLUListElement> {
    tags: string[]
}

const TagCloud = React.forwardRef<HTMLUListElement, TablesProps>(
    ({ className, tags, ...props }, ref) => {
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
                        <span className="text-sm font-medium">No items found</span>
                    </li>
                )}
                {tags.map((tag, index) => (
                    <li
                        key={index}
                        className="flex items-center justify-between p-2 border rounded-md bg-secondary text-secondary-foreground"
                    >
                        <span className="text-sm font-medium">{tag}</span>
                    </li>
                ))}
            </ul>
        )
    }
)
TagCloud.displayName = "Tags"
export { TagCloud }