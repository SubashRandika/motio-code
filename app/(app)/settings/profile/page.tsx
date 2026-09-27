import type { Metadata } from "next";

import { Panel, PageHeading } from "@/components/ui/panel";
import { requireUser } from "@/features/auth/session";
import { AvatarField } from "@/features/profile/avatar-field";
import { ProfileForm } from "@/features/profile/profile-form";
import { avatarInitial, avatarSourceFor } from "@/lib/avatar";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const user = await requireUser("/settings/profile");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading title="Profile" description="How you appear inside MotioCode." />

      <Panel className="mt-6 flex flex-col gap-6 p-5">
        <AvatarField
          userId={user.id}
          currentSrc={avatarSourceFor(user)}
          initial={avatarInitial(user.displayName, user.email)}
          hasUpload={Boolean(user.avatarUrl)}
        />

        <hr className="border-line" />

        <ProfileForm
          displayName={user.displayName}
          email={user.email}
          useGravatar={user.useGravatar}
          hasUpload={Boolean(user.avatarUrl)}
        />
      </Panel>
    </div>
  );
}
