import { z } from "zod";

import { RENDER_STATUSES } from "@/core/render";

/** Only the outcomes a client may report; `processing` is set when the job starts. */
export const renderOutcomeSchema = z.enum(["completed", "failed", "cancelled"]);
export type RenderOutcome = z.infer<typeof renderOutcomeSchema>;

export const renderStatusSchema = z.enum(RENDER_STATUSES);

export const finishRenderSchema = z.object({
  jobId: z.string().uuid(),
  outcome: renderOutcomeSchema,
  // A renderer's message is for a human to read, not for the database to store
  // at length. The column allows 4000 characters; this keeps it to a sentence or
  // two so a stack trace cannot fill a row.
  errorMessage: z
    .string()
    .max(500)
    .transform((value) => (value.trim() === "" ? null : value.trim()))
    .nullable()
    .default(null),
});

export type FinishRenderInput = z.input<typeof finishRenderSchema>;
