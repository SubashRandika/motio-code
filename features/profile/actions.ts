"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/features/auth/session";
import {
  AVATAR_BUCKET,
  avatarPathFromUrl,
  avatarPublicUrl,
  isOwnAvatarPath,
} from "@/lib/avatar-storage";
import { createClient } from "@/lib/supabase/server";

export interface ProfileFormState {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string>;
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Tell us what to call you").max(80),
  // An unchecked checkbox sends nothing at all, so absence is the "off" value.
  useGravatar: z.boolean(),
});

/**
 * The path the browser says it just uploaded to.
 *
 * Validated as a shape here and as ownership below. A URL is deliberately not
 * accepted -- see lib/avatar-storage.ts for why.
 */
const avatarPathSchema = z.object({
  path: z.string().trim().min(1).max(200),
});

export async function updateProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser("/settings/profile");

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    useGravatar: formData.get("useGravatar") === "on",
  });
  if (!parsed.success) {
    return { fieldErrors: { displayName: parsed.error.issues[0]?.message ?? "Invalid name" } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      use_gravatar: parsed.data.useGravatar,
    })
    .eq("id", user.id);

  if (error) return { error: `Could not save your profile: ${error.message}` };

  revalidatePath("/", "layout");
  return { notice: "Profile saved." };
}

export interface AvatarState {
  error?: string;
  notice?: string;
}

/**
 * Records an avatar the browser has already uploaded.
 *
 * The upload itself goes straight from the browser to Storage, which enforces
 * the 2MB limit and the type allowlist server-side. What is left for this
 * action is the part Storage cannot judge: whether the caller is entitled to
 * claim this object, and what URL to record for it.
 */
export async function setAvatarAction(
  _previous: AvatarState,
  formData: FormData,
): Promise<AvatarState> {
  const user = await requireUser("/settings/profile");

  const parsed = avatarPathSchema.safeParse({ path: formData.get("path") });
  if (!parsed.success) return { error: "That upload could not be read." };

  const { path } = parsed.data;
  if (!isOwnAvatarPath(path, user.id)) {
    // Not a validation nicety: without it a user could point their avatar at
    // another user's object, or at a path crafted to escape the bucket prefix.
    return { error: "That upload does not belong to your account." };
  }

  const supabase = await createClient();

  // Confirm the object is really there before recording it. Storage would
  // otherwise happily hold a URL that 404s, and the failure would look like the
  // upload silently doing nothing.
  const folder = path.slice(0, path.indexOf("/"));
  const filename = path.slice(path.indexOf("/") + 1);
  const { data: listed, error: listError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .list(folder, { search: filename, limit: 1 });

  if (listError) return { error: `Could not confirm the upload: ${listError.message}` };
  if (!listed?.some((object) => object.name === filename)) {
    return { error: "That upload could not be found. Try again." };
  }

  const previousPath = avatarPathFromUrl(user.avatarUrl);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarPublicUrl(path) })
    .eq("id", user.id);

  if (error) return { error: `Could not save your picture: ${error.message}` };

  // Only after the new one is recorded, and only if it is a path we recognise
  // as ours. A failure here leaves an orphaned file, which is untidy but
  // harmless -- losing the picture the user just set would not be.
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  revalidatePath("/", "layout");
  return { notice: "Picture updated." };
}

/** Clears the uploaded picture, falling back to Gravatar or the initial. */
export async function removeAvatarAction(): Promise<AvatarState> {
  const user = await requireUser("/settings/profile");
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) return { error: `Could not remove your picture: ${error.message}` };

  const path = avatarPathFromUrl(user.avatarUrl);
  if (path) await supabase.storage.from(AVATAR_BUCKET).remove([path]);

  revalidatePath("/", "layout");
  return { notice: "Picture removed." };
}
