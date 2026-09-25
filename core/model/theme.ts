import { z } from "zod";

import { hexColorSchema } from "./primitives";

/**
 * Colours a composition renders with. Kept separate from the application's own
 * interface theme so a user can make a light-themed video inside a dark editor.
 */
export const themeConfigSchema = z.object({
  name: z.string().min(1).max(60).default("Console"),
  background: hexColorSchema.default("#0E1116"),
  surface: hexColorSchema.default("#151A22"),
  border: hexColorSchema.default("#2A3340"),
  text: hexColorSchema.default("#E8ECF2"),
  muted: hexColorSchema.default("#8A97A8"),
  accent: hexColorSchema.default("#F2A63B"),
  accentAlt: hexColorSchema.default("#57D2E0"),
  codeTheme: z.enum(["console-dark", "console-light"]).default("console-dark"),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

export const BUILT_IN_THEMES: ThemeConfig[] = [
  {
    name: "Console",
    background: "#0E1116",
    surface: "#151A22",
    border: "#2A3340",
    text: "#E8ECF2",
    muted: "#8A97A8",
    accent: "#F2A63B",
    accentAlt: "#57D2E0",
    codeTheme: "console-dark",
  },
  {
    name: "Blueprint",
    background: "#0B1B2B",
    surface: "#12263A",
    border: "#1E3A52",
    text: "#DCE9F5",
    muted: "#7C99B4",
    accent: "#57D2E0",
    accentAlt: "#F2A63B",
    codeTheme: "console-dark",
  },
  {
    name: "Paper",
    background: "#F5F3EE",
    surface: "#FFFFFF",
    border: "#DAD5CA",
    text: "#1A1A17",
    muted: "#6B675E",
    accent: "#B4531F",
    accentAlt: "#1F5E6B",
    codeTheme: "console-light",
  },
];
