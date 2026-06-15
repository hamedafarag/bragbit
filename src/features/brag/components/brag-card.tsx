import type { BragWithRelations } from "../queries";
import { BragActions } from "./brag-actions";
import { BragCardShell } from "./brag-card-shell";
import { BragDetail, type BragDetailData } from "./brag-detail";
import type { BragFormValues } from "./brag-editor";

/**
 * One brag in the owner's timeline: the visual shell (BragCardShell) composed with
 * the interactive owner bits — the title opens the full detail dialog (BragDetail)
 * and the top-right carries Edit/Delete (BragActions). The shell holds all the
 * server-rendered layout so the public share card can reuse it without pulling in
 * these client components.
 */
export function BragCard({ brag }: { brag: BragWithRelations }) {
  const collaborators = brag.collaborators ?? [];

  const initial: BragFormValues = {
    title: brag.title,
    date: brag.date,
    category: brag.category ?? "",
    status: brag.status ?? "",
    descriptionMd: brag.descriptionMd ?? "",
    impactMd: brag.impactMd ?? "",
    collaborators: collaborators.join(", "),
    attribution: brag.attribution ?? "",
    links: brag.links.map((l) => ({ url: l.url, label: l.label ?? "" })),
    tags: brag.tags,
    visibility: brag.visibility === "private" ? "private" : "shared",
    attachments: brag.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      url: `/api/files/${a.storageKey}`,
    })),
  };

  const detail: BragDetailData = {
    title: brag.title,
    date: brag.date,
    category: brag.category,
    status: brag.status,
    descriptionMd: brag.descriptionMd,
    impactMd: brag.impactMd,
    collaborators,
    attribution: brag.attribution,
    tags: brag.tags,
    links: brag.links.map((l) => ({ url: l.url, label: l.label })),
    attachments: initial.attachments,
  };

  return (
    <BragCardShell
      brag={brag}
      title={<BragDetail data={detail} />}
      actions={
        <BragActions
          bragId={brag.id}
          documentId={brag.documentId}
          title={brag.title}
          initial={initial}
        />
      }
    />
  );
}
