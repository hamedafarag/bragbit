import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Renders user-authored Markdown safely. react-markdown ignores embedded raw HTML
 * by default (we don't add rehype-raw) and strips dangerous URL protocols, so
 * this is XSS-safe without a separate sanitizer. It works in Server Components
 * (zero client JS — used by the brag cards and goals) and is lazy-loaded for the
 * editor's live preview. Visual styling lives in the `.markdown` block in
 * globals.css. GFM adds tables, strikethrough, task lists, and autolinks.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
