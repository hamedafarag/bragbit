"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { updateReminderSettings } from "../actions";
import { reminderSchema, WEEKDAYS } from "../schema";

const selectClass =
  "h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export type ReminderFormValues = {
  enabled: boolean;
  day: number | null;
  timezone: string | null;
};

function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Weekly-reminder preferences. Defaults the timezone to the visitor's browser zone
 * (and the day to Monday) when nothing's saved yet. The zone list comes from the
 * runtime's IANA database; if that API is unavailable the saved/detected value is
 * still kept. Saving persists through the `updateReminderSettings` action.
 */
export function ReminderSettingsForm({ initial }: { initial: ReminderFormValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [day, setDay] = useState<number>(initial.day ?? 1);
  const [timezone, setTimezone] = useState<string>(initial.timezone ?? "");

  // Default the zone to the browser's once mounted. It isn't knowable during SSR,
  // so this must run client-side (and only when nothing's been saved yet) — a
  // legitimate external-system sync, hence the one-off rule exception.
  useEffect(() => {
    if (timezone) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe one-time default
    setTimezone(detectTimeZone());
  }, [timezone]);

  const zones = useMemo(() => {
    const all =
      typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    // Ensure the current value is selectable even if not in the list.
    return timezone && !all.includes(timezone) ? [timezone, ...all] : all;
  }, [timezone]);

  function onSave() {
    const parsed = reminderSchema.safeParse({ enabled, day, timezone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    start(async () => {
      const result = await updateReminderSettings(parsed.data);
      if (result.ok) {
        toast.success("Reminder settings saved.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4 rounded border-input accent-primary"
        />
        Email me a weekly reminder to log my wins
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reminder-day">Day</Label>
          <select
            id="reminder-day"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            disabled={!enabled}
            className={`${selectClass} disabled:opacity-50`}
          >
            {WEEKDAYS.map((label, value) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reminder-tz">Time zone</Label>
          {zones.length > 0 ? (
            <select
              id="reminder-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={!enabled}
              className={`${selectClass} disabled:opacity-50`}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="reminder-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={!enabled}
              className={`${selectClass} disabled:opacity-50`}
            />
          )}
        </div>
      </div>

      <p className="font-mono text-[10.5px] text-ink-faint">
        {enabled
          ? `We'll email you on ${WEEKDAYS[day]} mornings (${timezone || "your time zone"}).`
          : "Reminders are off. Turn them on to get a weekly nudge."}
      </p>

      <Button type="button" onClick={onSave} disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save reminder settings"}
      </Button>
    </div>
  );
}
