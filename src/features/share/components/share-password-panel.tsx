"use client";

import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The optional share-password sub-panel of the ShareDialog: set or update the
 * password, or remove it. Split out of ShareDialog (ENH-CQ-03); the parent owns
 * the input value and the mutation handlers.
 */
export function SharePasswordPanel({
  hasPassword,
  pw,
  onPwChange,
  pending,
  onSet,
  onRemove,
}: {
  hasPassword: boolean;
  pw: string;
  onPwChange: (value: string) => void;
  pending: boolean;
  onSet: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-medium">
          <Lock className="size-3.5 text-ink-faint" aria-hidden />
          Password
        </span>
        <span className="font-mono text-[10.5px] text-ink-faint">
          {hasPassword ? "Protected" : "Anyone with the link can view"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="password"
          value={pw}
          onChange={(e) => onPwChange(e.target.value)}
          placeholder={hasPassword ? "New password" : "Set a password"}
          aria-label="Share password"
          autoComplete="new-password"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || pw.length < 6}
          onClick={onSet}
        >
          {hasPassword ? "Update" : "Set"}
        </Button>
      </div>
      {hasPassword ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-destructive"
          disabled={pending}
          onClick={onRemove}
        >
          Remove password
        </Button>
      ) : (
        <p className="font-mono text-[10.5px] text-ink-faint">At least 6 characters.</p>
      )}
    </div>
  );
}
