import { BragCardShell } from "@/features/brag/components/brag-card-shell";
import type { BragWithRelations } from "@/features/brag/queries";

/**
 * A read-only brag card for the public share page. Reuses BragCardShell for the
 * visuals but adds no interactivity: the title is plain text (no detail dialog,
 * so the public page ships no client JS for cards) and there are no Edit/Delete
 * actions. `token` flows to the shell so attachment chips link through the file
 * route's share-token path. Private brags are filtered out before reaching here.
 */
export function PublicBragCard({ brag, token }: { brag: BragWithRelations; token: string }) {
  return (
    <BragCardShell
      brag={brag}
      shareToken={token}
      title={
        <span className="font-serif text-[18px] leading-snug font-semibold tracking-[-0.01em] text-ink">
          {brag.title}
        </span>
      }
    />
  );
}
