import type { BragFormValues } from "./components/brag-editor";
import type { BragCategory, BragStatus } from "./schema";

/**
 * An entry template — an action-verb scaffold that pre-fills the brag editor to
 * beat the blank page (ENH-UX-04 / PLAN §11). Each maps to a category in the
 * fixed taxonomy and seeds the Markdown description with the genre's prompts
 * (what you did + why it mattered + the measurable result). The user picks one,
 * the editor opens pre-filled, and they fill the blanks.
 */
export type BragTemplate = {
  id: string;
  label: string;
  category: BragCategory;
  status?: BragStatus;
  descriptionMd: string;
};

export const BRAG_TEMPLATES: readonly BragTemplate[] = [
  {
    id: "shipped",
    label: "Shipped a project",
    category: "shipped-work",
    status: "shipped",
    descriptionMd:
      "**What I shipped** — \n\n**Why it mattered** — \n\n**The measurable result** — ",
  },
  {
    id: "fixed",
    label: "Fixed a critical issue",
    category: "technical-contribution",
    status: "shipped",
    descriptionMd:
      "**The problem** — \n\n**What I did** — \n\n**The impact** (downtime, users, revenue…) — ",
  },
  {
    id: "led",
    label: "Led an initiative",
    category: "leadership",
    descriptionMd: "**What I led** — \n\n**Who and what I aligned** — \n\n**The outcome** — ",
  },
  {
    id: "mentored",
    label: "Mentored a teammate",
    category: "collaboration-mentoring",
    descriptionMd: "**Who I helped** — \n\n**What I did** — \n\n**The outcome for them** — ",
  },
  {
    id: "process",
    label: "Improved a process",
    category: "glue-process-work",
    descriptionMd:
      "**The friction** — \n\n**The change I made** — \n\n**Time or quality saved** — ",
  },
  {
    id: "recognition",
    label: "Earned recognition",
    category: "recognition-feedback",
    descriptionMd: "**The recognition** — \n\n**Who it came from** — \n\n**What I'd done** — ",
  },
];

/**
 * Build the brag editor's `initial` values from a template. Pure — today's date
 * is injected so it's unit-testable — and unspecified fields get the same empty
 * defaults a blank "Log a win" form uses; only category/status/description are
 * seeded. Mirrors the BragFormValues shape BragCard builds for edit mode.
 */
export function templateToInitial(template: BragTemplate, today: string): BragFormValues {
  return {
    title: "",
    date: today,
    category: template.category,
    status: template.status ?? "",
    descriptionMd: template.descriptionMd,
    impactMd: "",
    collaborators: "",
    attribution: "",
    links: [],
    tags: [],
    visibility: "shared",
    attachments: [],
  };
}
