/**
 * What each property does, in one or two sentences.
 *
 * Kept in one file rather than scattered through the panels so the whole set
 * can be read as a piece and kept in one voice — help text that drifts into
 * forty different registers reads worse than none.
 *
 * The rule for writing these: say what the property does to the output, and
 * where it is surprising, say the surprise. A tooltip on "Duration" that reads
 * "the duration" has cost a user a hover and told them nothing. The ones worth
 * having are the ones that answer a question someone would otherwise have to
 * answer by experiment — that changing export frame rate resamples rather than
 * retimes, that a mismatched aspect ratio is fitted rather than cropped, that
 * the composition theme is not the editor's theme.
 */
export const HELP = {
  // ---------------------------------------------------------------- scene
  sceneName: "Only for finding this scene in the timeline and scene list. It never appears in the video.",
  sceneDuration:
    "How long this scene stays on screen, in frames. Every animation inside it is timed against this, so shortening it can cut one short.",
  sceneTransition:
    "How this scene arrives from the one before it. Cut is instant; the others blend over the length below, overlapping the two scenes.",
  transitionLength:
    "How many frames the blend takes. It overlaps the two scenes rather than adding time, so the project does not get longer.",

  // --------------------------------------------------------------- canvas
  canvasAspectRatio:
    "The shape you compose in. Changing it resizes the canvas but leaves elements where they are, so check the edges afterwards.",
  canvasFps:
    "Frames per second for the timeline. It decides what a frame is worth: at 30 fps a 90-frame scene runs for three seconds.",
  canvasBackground: "The colour behind every scene that does not set its own.",

  // ---------------------------------------------------------------- theme
  compositionTheme:
    "Colours used by elements inside the video — panels, text, accents. This is separate from the editor's own dark interface, which does not change.",

  // --------------------------------------------------------------- export
  exportFormat:
    "MP4 plays everywhere and is the safe choice. WebM is smaller but less widely supported. GIF cannot be encoded in the browser yet.",
  exportResolution:
    "The height of the exported file. The composition is scaled to it, so exporting a 1080p canvas at 1080p is pixel for pixel.",
  exportAspectRatio:
    "The shape of the exported file. If it differs from the canvas the composition is scaled to fit and centred, with bars in the canvas colour — never cropped.",
  exportFps:
    "Frames per second in the file. Changing it resamples the same animation to the new rate; it does not make the video faster or slower.",

  // -------------------------------------------------------------- element
  elementName: "Only for finding this element in the layers list and timeline. It never appears in the video.",
  elementPosition:
    "Position in canvas units from the top-left corner, not screen pixels — so it means the same thing at any zoom or export size.",
  elementSize: "Width and height in canvas units. Resizing the box does not rescale the text inside it.",
  elementStartsAt:
    "The frame within this scene where the element appears, counted from the start of the scene rather than the project.",
  elementLength:
    "How many frames the element stays on screen. Leave it running to the end of the scene unless it should disappear early.",
  elementRunsToEnd: "Keeps the element on screen until the scene ends, however long the scene becomes.",
  elementLocked: "Stops the element being moved or resized on the canvas. It still appears in the video.",
  elementHidden: "Hides the element from the canvas and from the export, without deleting it.",
  elementOpacity:
    "How solid the element is, before any animation. Fade animations multiply this rather than replacing it.",
  elementLayer:
    "Which element is drawn on top where two overlap. Connectors sit below the nodes they join so arrows tuck under the boxes.",
} as const;

export type HelpKey = keyof typeof HELP;
