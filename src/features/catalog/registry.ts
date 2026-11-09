import {
  Binary,
  Braces,
  Clipboard,
  Clock3,
  FileText,
  Fingerprint,
  Link2,
  Type,
} from "lucide-react";
import { lazy } from "react";

export const categories = [
  "All tools",
  "Sharing",
  "Text & data",
  "Encoding",
  "Generators",
  "Time",
] as const;
export type Category = (typeof categories)[number];

export const tools = [
  {
    id: "clipboard",
    name: "Instant clipboard",
    description: "A little bridge between your devices. Share text with a link or code.",
    category: "Sharing",
    icon: Clipboard,
    color: "bg-[#eaf0e0] text-[#57733d] dark:bg-lime-950 dark:text-lime-300",
    keywords: "share paste transfer copy devices password protected",
    component: lazy(() => import("@/features/clipboard/clipboard-tool")),
  },
  {
    id: "markdown",
    name: "Markdown preview",
    description: "Turn your thoughts into beautifully formatted Markdown, as you type.",
    category: "Text & data",
    icon: FileText,
    color: "bg-[#e8edf5] text-[#527096] dark:bg-blue-950 dark:text-blue-300",
    keywords: "md editor preview writing",
    component: lazy(() => import("@/features/markdown/markdown-tool")),
  },
  {
    id: "base64",
    name: "Base64 codec",
    description: "Encode or decode text in a moment. Unicode and URL-safe, too.",
    category: "Encoding",
    icon: Binary,
    color: "bg-[#f1e9f5] text-[#8a659b] dark:bg-purple-950 dark:text-purple-300",
    keywords: "encode decode base64url utf8",
    component: lazy(() => import("@/features/base64/base64-tool")),
  },
  {
    id: "json",
    name: "JSON formatter",
    description: "Make tangled JSON readable. Format, validate, and minify with confidence.",
    category: "Text & data",
    icon: Braces,
    color: "bg-[#f8eddd] text-[#a67e42] dark:bg-amber-950 dark:text-amber-300",
    keywords: "pretty print minify validate data",
    component: lazy(() => import("@/features/json/json-tool")),
  },
  {
    id: "url",
    name: "URL utilities",
    description: "Untangle a URL. Inspect its parts or encode and decode text.",
    category: "Encoding",
    icon: Link2,
    color: "bg-[#e0efed] text-[#4f8b83] dark:bg-teal-950 dark:text-teal-300",
    keywords: "uri query parameters percent encode decode",
    component: lazy(() => import("@/features/url/url-tool")),
  },
  {
    id: "text",
    name: "Text toolkit",
    description: "Clean up the small stuff. Change case, count words, and tidy lines.",
    category: "Text & data",
    icon: Type,
    color: "bg-[#f5e6e3] text-[#ac746a] dark:bg-rose-950 dark:text-rose-300",
    keywords: "uppercase lowercase title count words sort duplicates trim",
    component: lazy(() => import("@/features/text/text-tool")),
  },
  {
    id: "uuid",
    name: "UUID generator",
    description: "Fresh identifiers, whenever you need them. One at a time or in a batch.",
    category: "Generators",
    icon: Fingerprint,
    color: "bg-[#eae8f6] text-[#7a70a5] dark:bg-violet-950 dark:text-violet-300",
    keywords: "random identifier guid unique batch",
    component: lazy(() => import("@/features/uuid/uuid-tool")),
  },
  {
    id: "timestamp",
    name: "Timestamp converter",
    description: "Give a timestamp some context. Move between Unix time and dates.",
    category: "Time",
    icon: Clock3,
    color: "bg-[#e5edf0] text-[#608493] dark:bg-sky-950 dark:text-sky-300",
    keywords: "epoch unix seconds milliseconds timezone date utc",
    component: lazy(() => import("@/features/timestamp/timestamp-tool")),
  },
] as const;

export type Tool = (typeof tools)[number];
export type ToolId = Tool["id"];
export function findTool(id: string | undefined) {
  return tools.find((tool) => tool.id === id);
}
export function matchesTool(tool: Tool, query: string) {
  return `${tool.name} ${tool.description} ${tool.keywords}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}
