import { AvatarUploader } from "@/features/profile/components/avatar-uploader";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { getProfile } from "@/features/profile/queries";
import { requireSession } from "@/lib/auth/guards";
import { initials } from "@/lib/utils";

export default async function ProfilePage() {
  const { user } = await requireSession();
  const profile = await getProfile(user.id);

  const displayName = profile?.displayName ?? user.name;
  const avatarUrl = profile?.avatarKey ? `/api/files/${profile.avatarKey}` : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">
          Profile
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          How you appear in BragBit — on your timeline and on documents you share.
        </p>
      </header>

      <div className="rounded-xl border border-line bg-card p-6 shadow-card">
        <AvatarUploader avatarUrl={avatarUrl} initials={initials(displayName)} />
      </div>

      <div className="rounded-xl border border-line bg-card p-6 shadow-card">
        <ProfileForm
          initial={{
            displayName,
            roleTitle: profile?.roleTitle ?? "",
            team: profile?.team ?? "",
            bio: profile?.bio ?? "",
          }}
        />
      </div>
    </div>
  );
}
