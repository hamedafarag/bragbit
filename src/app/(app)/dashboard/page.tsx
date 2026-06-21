import { Button } from "@/components/ui/button";
import { buildActivity, windowStart } from "@/features/dashboard/activity";
import { ActivityHeatmap } from "@/features/dashboard/components/activity-heatmap";
import { getActivityCounts } from "@/features/dashboard/queries";
import { DocumentCard } from "@/features/document/components/document-card";
import { DocumentDialog } from "@/features/document/components/document-dialog";
import { listArchivedDocuments, listDocuments } from "@/features/document/queries";

const ACTIVITY_WEEKS = 52;

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The authenticated home: the caller's documents in their active workspace, plus
// a win-activity heatmap. All queries run the DAL guard (session + membership)
// and scope to the user.
export default async function DashboardPage() {
  const today = todayYmd();
  const [documents, archived, activityCounts] = await Promise.all([
    listDocuments(),
    listArchivedDocuments(),
    getActivityCounts(windowStart(today, ACTIVITY_WEEKS)),
  ]);
  const activity = buildActivity(activityCounts, today, ACTIVITY_WEEKS);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">
            Your documents
          </h1>
          <p className="mt-1 max-w-[60ch] text-[13.5px] text-ink-soft">
            Each document is a review period — a year, a half, a promotion case — collecting the
            wins you log against it.
          </p>
        </div>
        {documents.length > 0 ? <DocumentDialog trigger={<Button>New document</Button>} /> : null}
      </header>

      {activity.totalWins > 0 ? <ActivityHeatmap data={activity} /> : null}

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-card/60 px-6 py-14 text-center shadow-card">
          <h2 className="font-serif text-[20px] font-semibold">Start your first document</h2>
          <p className="mx-auto mt-1.5 max-w-[44ch] text-[13.5px] text-ink-soft">
            Create a document for this review period — like “2026” or “H1 2026” — then log your wins
            against it as the year goes.
          </p>
          <div className="mt-5 flex justify-center">
            <DocumentDialog trigger={<Button>New document</Button>} />
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </ul>
      )}

      {archived.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer list-none font-mono text-[11px] tracking-[0.1em] text-ink-faint uppercase select-none hover:text-ink-soft">
            Archived · {archived.length}
            <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {archived.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} archived />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
