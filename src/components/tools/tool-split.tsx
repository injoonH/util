import { type ReactNode, useId, useSyncExternalStore } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

const desktopQuery = "(min-width: 1280px)";

function subscribeToDesktop(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isDesktop() {
  return window.matchMedia(desktopQuery).matches;
}

function serverSnapshot() {
  return false;
}

/** A single editor tree: stacked on small screens and adjustable on desktop. */
export function ToolSplit({
  children,
  resizeLabel = "Resize input and output panels",
}: {
  children: [ReactNode, ReactNode];
  resizeLabel?: string;
}) {
  const id = useId();
  const desktop = useSyncExternalStore(subscribeToDesktop, isDesktop, serverSnapshot);

  if (!desktop) return <div className="grid min-w-0 grid-cols-1 gap-5">{children}</div>;

  return (
    <div className="min-w-0">
      <span id={`${id}-resize-help`} className="sr-only">
        Use the left and right arrow keys to resize these panels.
      </span>
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-w-0"
        style={{ overflow: "visible" }}
      >
        <ResizablePanel
          id={`${id}-input`}
          defaultSize="50%"
          minSize="30%"
          className="min-w-0 [&>[data-slot=card]]:h-full [&_[data-slot=card-content]]:flex-1"
        >
          {children[0]}
        </ResizablePanel>
        <ResizableHandle
          withHandle
          aria-label={resizeLabel}
          aria-describedby={`${id}-resize-help`}
          className="w-5 shrink-0 bg-transparent after:w-2 [&>div]:bg-background [&>div]:text-muted-foreground"
        />
        <ResizablePanel
          id={`${id}-output`}
          defaultSize="50%"
          minSize="30%"
          className="min-w-0 [&>[data-slot=card]]:h-full [&_[data-slot=card-content]]:flex-1"
        >
          {children[1]}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
