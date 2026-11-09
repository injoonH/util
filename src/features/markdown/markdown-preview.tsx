import { ImageOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

export function MarkdownPreview({
  value,
  allowImages = false,
}: {
  value: string;
  allowImages?: boolean;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      skipHtml
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
            {children}
          </a>
        ),
        img: ({ src, alt, title }) =>
          allowImages && typeof src === "string" && src ? (
            <img
              src={src}
              alt={alt ?? ""}
              title={title}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="markdown-image-placeholder">
              <ImageOff className="size-4 shrink-0" />
              {alt || "Image"} —{" "}
              {allowImages ? "unsupported image URL" : "enable “Load images” to display"}
            </span>
          ),
      }}
    >
      {value}
    </ReactMarkdown>
  );
}
