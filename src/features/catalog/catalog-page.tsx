import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePreferences } from "@/app/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type Category, categories, findTool, matchesTool, type Tool, tools } from "./registry";

function ToolCard({ tool, index }: { tool: Tool; index: number }) {
  const { favorites, toggleFavorite } = usePreferences();
  const favorite = favorites.includes(tool.id);
  return (
    <Card
      className="group enter gap-0 overflow-hidden rounded-xl py-0 shadow-none transition-colors hover:border-primary/30"
      style={{ animationDelay: `${index * 25}ms` }}
    >
      <Link
        to={`/tools/${tool.id}`}
        className="flex flex-1 flex-col p-5 pb-4 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className={cn("flex size-11 items-center justify-center rounded-xl", tool.color)}>
            <tool.icon className="size-5" strokeWidth={1.7} />
          </div>
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground">
            {tool.id === "clipboard" ? "SHARE ACROSS DEVICES" : "RUNS IN YOUR BROWSER"}
          </span>
        </div>
        <h3 className="mb-2 text-base font-semibold tracking-tight">{tool.name}</h3>
        <p className="min-h-12 text-[13px] leading-6 text-muted-foreground">{tool.description}</p>
      </Link>
      <div className="mx-5 flex items-center justify-between border-t py-3">
        <Link
          to={`/tools/${tool.id}`}
          className="flex items-center gap-2 text-xs font-medium text-primary"
        >
          Open tool{" "}
          <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          aria-label={`${favorite ? "Remove" : "Add"} ${tool.name} ${favorite ? "from" : "to"} favorites`}
          aria-pressed={favorite}
          onClick={() => toggleFavorite(tool.id)}
        >
          <Star className={cn("size-3.5", favorite && "fill-amber-400 text-amber-500")} />
        </Button>
      </div>
    </Card>
  );
}

export default function CatalogPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All tools");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { favorites, recent } = usePreferences();
  const filtered = tools.filter(
    (tool) =>
      matchesTool(tool, query) &&
      (category === "All tools" || tool.category === category) &&
      (!favoritesOnly || favorites.includes(tool.id)),
  );
  return (
    <div className="enter">
      <section className="relative mb-9 overflow-hidden rounded-2xl border border-[#dce6ce] bg-[#edf3e4] px-6 py-8 dark:border-green-900 dark:bg-[#233325] sm:px-9 sm:py-10">
        <div className="relative z-10 max-w-xl">
          <Badge
            variant="outline"
            className="mb-5 gap-1.5 border-[#cbdabb] bg-white/40 text-[10px] tracking-[0.14em] dark:bg-black/10"
          >
            <span className="size-1.5 rounded-full bg-[#729449]" /> YOUR EVERYDAY WORKBENCH
          </Badge>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-[40px]">
            Small tools.
            <br />A little less busywork.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-[#6b7d5f] dark:text-[#b5c5ab]">
            For the little tasks between the big ideas.
            <br className="hidden sm:block" /> A useful collection, all in one quiet corner of the
            web.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#58734b] dark:text-[#b5c5ab]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> No account needed
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Made to get out of your way
            </span>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="absolute -right-7 top-5 hidden rotate-[-12deg] items-center gap-3 opacity-80 xl:flex"
        >
          <div className="mt-24 flex size-24 items-center justify-center rounded-3xl border border-white/80 bg-white/50 text-[#92a77b] shadow-sm">
            <span className="font-mono text-4xl">Aa</span>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex size-24 items-center justify-center rounded-3xl border border-white/80 bg-[#dce9ca] text-[#749757] shadow-sm">
              <span className="font-mono text-4xl">{`{ }`}</span>
            </div>
            <div className="flex size-24 items-center justify-center rounded-3xl border border-white/80 bg-white/40 text-[#92a77b] shadow-sm">
              <ArrowDownLeft className="size-10" strokeWidth={1.3} />
            </div>
          </div>
        </div>
      </section>
      {recent.length > 0 && (
        <div className="mb-7 flex flex-wrap items-center gap-2">
          <span className="mr-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" /> Pick up where you left off
          </span>
          {recent.map((id) => {
            const tool = findTool(id);
            return (
              tool && (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full bg-card text-xs"
                  asChild
                >
                  <Link to={`/tools/${id}`}>
                    {tool.name}
                    <ArrowUpRight className="size-3" />
                  </Link>
                </Button>
              )
            );
          })}
        </div>
      )}
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Your tools, within reach
            <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
              {tools.length}
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Find what you need. Make a little progress.
          </p>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search tools"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a tool…"
            className="h-10 bg-card pr-8 pl-9"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 size-8"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <fieldset className="mb-6 flex flex-wrap items-center gap-1.5" aria-label="Filter tools">
        {categories.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={category === item ? "secondary" : "ghost"}
            className={cn(
              "h-8 rounded-lg px-3 text-xs",
              category !== item && "text-muted-foreground",
            )}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </Button>
        ))}
        <span className="mx-2 h-4 border-l" />
        <Button
          variant={favoritesOnly ? "secondary" : "ghost"}
          size="sm"
          className="h-8 text-xs"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly(!favoritesOnly)}
        >
          <Star className="size-3.5" /> Favorites
          {favorites.length > 0 && (
            <span className="text-muted-foreground">{favorites.length}</span>
          )}
        </Button>
      </fieldset>
      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tool, index) => (
            <ToolCard key={tool.id} tool={tool} index={index} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed px-6 py-14 text-center">
          <Search className="mx-auto mb-3 size-6 text-muted-foreground" />
          <h3 className="font-medium">
            {favoritesOnly && !favorites.length ? "Keep your go-to tools close" : "No tools found"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {favoritesOnly && !favorites.length
              ? "Star a tool to find it here next time."
              : "Try a different search or browse all tools."}
          </p>
          <Button
            variant="outline"
            className="mt-5"
            onClick={() => {
              setQuery("");
              setCategory("All tools");
              setFavoritesOnly(false);
            }}
          >
            Browse all tools
          </Button>
        </div>
      )}
      <footer className="mt-9 flex flex-col justify-between gap-2 border-t pt-5 text-[11px] text-muted-foreground sm:flex-row">
        <span>A small collection for a smoother day.</span>
        <span>Tool inputs stay in your browser. Clipboard shares are temporary.</span>
      </footer>
    </div>
  );
}
