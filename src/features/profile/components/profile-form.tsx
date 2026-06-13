"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { updateProfile } from "../actions";
import { profileSchema } from "../schema";

export type ProfileFormValues = {
  displayName: string;
  roleTitle: string;
  team: string;
  bio: string;
};

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = profileSchema.safeParse({
      displayName: String(fd.get("displayName") ?? ""),
      roleTitle: String(fd.get("roleTitle") ?? ""),
      team: String(fd.get("team") ?? ""),
      bio: String(fd.get("bio") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    start(async () => {
      const result = await updateProfile(parsed.data);
      if (result.ok) {
        toast.success("Profile saved.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          defaultValue={initial.displayName}
          placeholder="Ada Lovelace"
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="roleTitle">Role title</Label>
          <Input
            id="roleTitle"
            name="roleTitle"
            defaultValue={initial.roleTitle}
            placeholder="Senior Software Engineer"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team">Team</Label>
          <Input
            id="team"
            name="team"
            defaultValue={initial.team}
            placeholder="Platform Reliability"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          rows={4}
          defaultValue={initial.bio}
          placeholder="A short note about what you work on — shown on your profile."
        />
      </div>

      <Button type="submit" disabled={pending} className="mt-1 self-start">
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
