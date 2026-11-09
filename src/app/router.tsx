import { ArrowLeft, LoaderCircle, Star } from "lucide-react";
import { Suspense, useEffect } from "react";
import { createBrowserRouter, Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CatalogPage from "@/features/catalog/catalog-page";
import { findTool } from "@/features/catalog/registry";
import { cn } from "@/lib/utils";
import { usePreferences } from "./providers";
import Shell from "./shell";

function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground">A SMALL DETOUR</p>
      <h1 className="mt-3 text-3xl font-semibold">This tool isn’t on the workbench.</h1>
      <Button asChild className="mt-6">
        <Link to="/">Back to all tools</Link>
      </Button>
    </div>
  );
}

function ToolPage() {
  const { toolId } = useParams();
  const tool = findTool(toolId);
  const { favorites, toggleFavorite, visit } = usePreferences();
  useEffect(() => {
    if (tool) visit(tool.id);
  }, [tool, visit]);
  if (!tool) return <NotFound />;
  const Content = tool.component;
  const favorite = favorites.includes(tool.id);
  return (
    <div className="enter" key={tool.id}>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All tools
      </Link>
      <div className="mb-8 flex items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className={cn("flex size-10 items-center justify-center rounded-xl", tool.color)}>
              <tool.icon className="size-5" />
            </div>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {tool.category}
            </Badge>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              {tool.id === "clipboard"
                ? "Across devices. Without an account."
                : "Processed in your browser"}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{tool.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {tool.description}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="mt-3 shrink-0 bg-card"
          aria-label={`${favorite ? "Remove from" : "Add to"} favorites`}
          aria-pressed={favorite}
          onClick={() => toggleFavorite(tool.id)}
        >
          <Star className={cn("size-4", favorite && "fill-amber-400 text-amber-500")} />
        </Button>
      </div>
      <Suspense
        fallback={
          <div
            className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircle className="size-4 animate-spin" />
            Getting your tool ready…
          </div>
        }
      >
        <Content />
      </Suspense>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    element: <Shell />,
    errorElement: (
      <div className="mx-auto max-w-lg p-10">
        <h1 className="text-xl font-semibold">Something didn’t load.</h1>
        <p className="my-4 text-muted-foreground">
          Please reload the page to try again. Temporary tool inputs may be lost.
        </p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    ),
    children: [
      { index: true, element: <CatalogPage /> },
      { path: "tools/:toolId", element: <ToolPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
