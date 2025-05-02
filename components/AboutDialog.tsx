import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>About Query Craft</DialogTitle>
          <DialogDescription>
            Query Craft is a natural language interface for your databases. It allows you to:
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ul className="list-disc pl-6 space-y-2">
            <li>Write SQL queries using natural language</li>
            <li>Connect to multiple database types (MySQL, PostgreSQL, MariaDB)</li>
            <li>Save and share your queries</li>
            <li>View query history and results</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
} 