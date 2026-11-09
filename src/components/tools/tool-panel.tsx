import type { ReactNode } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ToolPanel({
  title,
  description,
  actions,
  footer,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 gap-0 overflow-hidden py-0 shadow-none", className)}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
      {footer && (
        <CardFooter className="border-t bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
