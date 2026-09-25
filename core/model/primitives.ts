import { z } from "zod";

/** A stable, opaque identifier for a scene or element. */
export const idSchema = z.string().min(1).max(64);

export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Expected a hex color");

/**
 * Position and size are stored in canvas units (the project's design
 * resolution), not screen pixels, so a composition renders identically in the
 * editor preview and in a video render at any output resolution.
 */
export const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive().max(20000),
  height: z.number().positive().max(20000),
});

export type Rect = z.infer<typeof rectSchema>;

/** Frame counts are always integers; fps lives on the project canvas. */
export const frameCountSchema = z.number().int().min(0).max(108000);

/** A UUID, used for anything the database stores as a uuid column. */
export function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Fallback for environments without the WebCrypto UUID helper.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createId(prefix: string): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}
