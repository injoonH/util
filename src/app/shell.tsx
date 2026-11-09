import {
  ArrowUpLeft,
  ChevronRight,
  Command as CommandIcon,
  Grid2X2,
  HelpCircle,
  Menu,
  Monitor,
  Moon,
  Search,
  ShieldCheck,
  Star,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { findTool, tools } from "@/features/catalog/registry";
import { cn } from "@/lib/utils";
import { usePreferences } from "./providers";

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#224d40] font-mono text-xl font-semibold text-[#d8e9bc]">
        u
      </span>
      <span className="text-xl font-semibold tracking-[-0.045em]">
        utility<span className="text-[#9eaf8c]">.</span>
      </span>
    </Link>
  );
}

function Navigation({ close }: { close?: () => void }) {
  const { favorites } = usePreferences();
  const itemStyle = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-colors",
      isActive
        ? "bg-accent font-medium text-accent-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      <NavLink to="/" end onClick={close} className={itemStyle}>
        <Grid2X2 className="size-4" />
        All tools
        <span className="ml-auto text-xs opacity-60">{String(tools.length).padStart(2, "0")}</span>
      </NavLink>
      <p className="mt-6 mb-2 px-3 text-[10px] font-medium tracking-[0.13em] text-muted-foreground">
        THE TOOLBOX
      </p>
      {tools.map((tool) => (
        <NavLink key={tool.id} to={`/tools/${tool.id}`} onClick={close} className={itemStyle}>
          <tool.icon className="size-4" strokeWidth={1.6} />
          {tool.name}
          {favorites.includes(tool.id) && (
            <Star className="ml-auto size-2.5 fill-current text-[#9cad7b]" />
          )}
        </NavLink>
      ))}
      <div className="mt-8 px-3">
        <Separator />
        <p className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5" /> A little space to get things done.
        </p>
      </div>
    </nav>
  );
}

export default function Shell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const tool = findTool(location.pathname.split("/")[2]);
  const { theme, setTheme } = usePreferences();
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);
  useEffect(() => {
    document.title = tool ? `${tool.name} — Utility` : "Utility — a little less busywork";
  }, [tool]);
  return (
    <>
      <Button
        type="button"
        onClick={() => {
          const main = document.getElementById("main-content");
          main?.focus();
          main?.scrollIntoView();
        }}
        className="sr-only fixed z-50 rounded bg-primary p-3 text-primary-foreground focus:not-sr-only"
      >
        Skip to content
      </Button>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r bg-card/70 px-5 py-7 lg:flex">
        <div className="mb-10 px-3">
          <Brand />
        </div>
        <Navigation />
        <div className="mt-auto px-3 pt-6">
          <span className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
            A LITTLE LESS BUSYWORK
          </span>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-60">
        <header className="flex h-20 items-center justify-between gap-4 border-b bg-background/90 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation"
                  className="lg:hidden"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-5">
                <SheetHeader className="px-3 pt-4 pb-6">
                  <SheetTitle>Utility toolbox</SheetTitle>
                  <SheetDescription>Small tools for your everyday tasks.</SheetDescription>
                </SheetHeader>
                <Navigation close={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <Link to="/" className="whitespace-nowrap text-xs text-muted-foreground">
              Your workbench
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="truncate text-xs font-medium">{tool?.name ?? "All tools"}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 bg-card text-xs text-muted-foreground"
              onClick={() => setSearchOpen(true)}
              aria-label="Quick search"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Quick search</span>
              <kbd className="ml-4 hidden items-center gap-0.5 rounded border px-1 py-0.5 font-mono text-[9px] sm:inline-flex">
                <CommandIcon className="size-2.5" />K
              </kbd>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Change theme"
                  className="size-8 text-muted-foreground"
                >
                  {theme === "dark" ? (
                    <Moon className="size-4" />
                  ) : theme === "light" ? (
                    <Sun className="size-4" />
                  ) : (
                    <Monitor className="size-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(value) => {
                    if (value === "light" || value === "dark" || value === "system")
                      setTheme(value);
                  }}
                >
                  <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label="About Utility"
                >
                  <HelpCircle className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>A little less busywork.</DialogTitle>
                  <DialogDescription>
                    Utility is a collection of focused tools for everyday tasks.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 text-sm leading-7 text-muted-foreground">
                  <p>
                    Conversion and preview tools process your input in this browser. We only save
                    your theme, favorites, and recent tool names on this device.
                  </p>
                  <p>
                    Clipboard sharing uploads the text you choose to share. Recipients need its link
                    or code and, if enabled, its password. Access ends when it expires or you delete
                    it.
                  </p>
                  <p>
                    Use <kbd className="rounded border px-1 font-mono text-xs">Ctrl / ⌘ K</kbd> to
                    jump to a tool. Clipboard access may require permission; ordinary copy and paste
                    always work.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1392px] px-5 py-7 outline-none sm:px-8 sm:py-9"
        >
          <Outlet />
        </main>
      </div>
      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Find a tool"
        description="Search the utility toolbox and press Enter to open a tool."
      >
        <CommandInput placeholder="What would you like to do?" />
        <CommandList>
          <CommandEmpty>No matching tools. Try “encode” or “text”.</CommandEmpty>
          <CommandGroup heading="Your toolbox">
            {tools.map((entry) => (
              <CommandItem
                key={entry.id}
                value={`${entry.name} ${entry.keywords}`}
                onSelect={() => {
                  navigate(`/tools/${entry.id}`);
                  setSearchOpen(false);
                }}
              >
                <entry.icon className="mr-2 size-4" />
                <span>{entry.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{entry.category}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup>
            <CommandItem
              value="all tools home"
              onSelect={() => {
                navigate("/");
                setSearchOpen(false);
              }}
            >
              <ArrowUpLeft className="mr-2 size-4" />
              All tools
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
