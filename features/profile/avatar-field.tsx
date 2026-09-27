"use client";

import { Loader2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormError, FormNotice, Label } from "@/components/ui/field";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  avatarPathFor,
} from "@/lib/avatar-storage";
import { createClient } from "@/lib/supabase/client";

import { removeAvatarAction, setAvatarAction } from "./actions";

const MEGABYTE = 1024 * 1024;

/**
 * Uploading a profile picture.
 *
 * The file goes from the browser straight to Storage rather than through a
 * server action, because a server action's request body is capped at 1MB and an
 * avatar is allowed to be 2MB -- routing it through the server would mean
 * raising that cap for every action in the app to carry image bytes twice.
 *
 * The checks below are a courtesy, not a control. Storage enforces the same
 * size and type limits itself, server-side, and the RLS policy on the bucket is
 * what actually stops a write outside the user's own folder. What these buy is
 * a useful message instead of an opaque rejection after a slow upload.
 */
export function AvatarField({
  userId,
  currentSrc,
  initial,
  hasUpload,
}: {
  userId: string;
  currentSrc: string | null;
  initial: string;
  /** Whether the current picture is an upload, as opposed to Gravatar. */
  hasUpload: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const busy = pending || uploading;

  async function upload(file: File) {
    setError(null);
    setNotice(null);

    if (!AVATAR_MIME_TYPES.includes(file.type as (typeof AVATAR_MIME_TYPES)[number])) {
      setError("Pictures must be a PNG, JPEG or WebP file.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      const size = (file.size / MEGABYTE).toFixed(1);
      setError(`That picture is ${size}MB. The limit is ${AVATAR_MAX_BYTES / MEGABYTE}MB.`);
      return;
    }

    const path = avatarPathFor(userId, file.type);
    if (!path) {
      setError("Pictures must be a PNG, JPEG or WebP file.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setError(`Could not upload that picture: ${uploadError.message}`);
        return;
      }

      // The server decides what URL to record; it is handed the path, never a URL.
      const formData = new FormData();
      formData.set("path", path);
      const result = await setAvatarAction({}, formData);

      if (result.error) setError(result.error);
      else setNotice(result.notice ?? "Picture updated.");
    } finally {
      setUploading(false);
      // Clear the input so choosing the same file again still fires a change.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (result.error) setError(result.error);
      else setNotice(result.notice ?? "Picture removed.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="avatar-file">Picture</Label>

      <div className="flex items-center gap-4">
        <Avatar src={currentSrc} initial={initial} label="Your picture" className="size-14" />

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="size-3.5" aria-hidden="true" />
                  {hasUpload ? "Replace" : "Upload"}
                </>
              )}
            </Button>

            {hasUpload ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
                {pending ? "Removing…" : "Remove"}
              </Button>
            ) : null}
          </div>

          <p className="text-[12px] text-mist-dim">
            PNG, JPEG or WebP, up to {AVATAR_MAX_BYTES / MEGABYTE}MB.
          </p>
        </div>
      </div>

      {/*
        A real file input, kept off-screen rather than `display: none`, so it
        stays in the tab order and keeps its label -- a hidden input is not
        focusable, and the button above would be the only way in.
      */}
      <input
        ref={inputRef}
        id="avatar-file"
        type="file"
        accept={AVATAR_MIME_TYPES.join(",")}
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <FormError>{error}</FormError>
      <FormNotice>{notice}</FormNotice>
    </div>
  );
}
