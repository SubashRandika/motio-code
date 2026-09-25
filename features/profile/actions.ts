"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface ProfileFormState {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Tell us what to call you").max(80),
});

export async function updateProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser("/settings/profile");

  const parsed = profileSchema.safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) {
    return { fieldErrors: { displayName: parsed.error.issues[0]?.message ?? "Invalid name" } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);

  if (error) return { error: `Could not save your profile: ${error.message}` };

  revalidatePath("/", "layout");
  return { notice: "Profile saved." };
}
