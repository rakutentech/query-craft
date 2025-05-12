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
                "overflow-y-auto p-4 flex-wrap border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700",
                className
            )}
            {...props}
        >
            {tags.length === 0 && (
                <li className="flex items-center justify-center w-full p-2 text-gray-500">
                    <span className="text-sm font-medium">No items found</span>
                </li>
            )}
            {tags.map((tag, index) => (
                <li
                    key={index}
                    className="flex items-center justify-between p-2 border rounded-md bg-gray-50"
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
