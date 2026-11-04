import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GLOSSARY } from "@/lib/glossary";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wraps known legal terms in the text with glossary tooltips. The original
 *  term always stays visible; the tooltip only adds a plain-language note. */
export function GlossaryText({ text }: { text: string }) {
  const matches = React.useMemo(() => {
    const found: { term: string; short: string; start: number }[] = [];
    for (const entry of GLOSSARY) {
      const re = new RegExp(`\\b${escapeRegExp(entry.term)}\\b`, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        found.push({ term: entry.term, short: entry.short, start: m.index });
        if (m.index === re.lastIndex) re.lastIndex += 1;
      }
    }
    return found.sort((a, b) => a.start - b.start);
  }, [text]);

  if (!matches.length) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, i) => {
    if (match.start < cursor) return; // overlaps a longer earlier match
    if (match.start > cursor) parts.push(text.slice(cursor, match.start));
    parts.push(
      <TooltipProvider key={`${match.term}-${i}`} delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="cursor-help border-b border-dotted border-primary/60 font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              {text.slice(match.start, match.start + match.term.length)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-72 text-xs leading-relaxed">
            {match.term} — {match.short}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    cursor = match.start + match.term.length;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  return <>{parts}</>;
}
