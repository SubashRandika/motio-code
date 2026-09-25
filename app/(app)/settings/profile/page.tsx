import type { Metadata } from "next";

import { Panel, PageHeading } from "@/components/ui/panel";
import { requireUser } from "@/features/auth/session";
import { ProfileForm } from "@/features/profile/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const user = await requireUser("/settings/profile");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeading title="Profile" description="How you appear inside MotioCode." />

      <Panel className="mt-6 p-5">
        <ProfileForm displayName={user.displayName} email={user.email} />
      </Panel>
    </div>
  );
}
