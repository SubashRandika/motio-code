import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NumberField, SelectField, TextField, ToggleField } from "@/features/editor/properties/controls";
import { POPOVER_WIDTH, placePopover } from "@/features/editor/properties/field-help";
import { HELP } from "@/features/editor/properties/help-text";

/**
 * Help on a property field.
 *
 * The thing most worth testing is not that a tooltip opens -- it is that the
 * description is attached to the *input*. A tooltip a screen-reader user has to
 * discover, tab to, and read separately is a second, worse feature wearing the
 * same name. `aria-describedby` is what makes the sighted path and the
 * assistive path the same path.
 */
describe("a field with help", () => {
  it("describes the input itself, so the explanation arrives with the field", async () => {
    render(<TextField label="Name" value="" help="Only used to find this scene." onChange={vi.fn()} />);

    const input = screen.getByLabelText("Name");
    const describedBy = input.getAttribute("aria-describedby");

    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("Only used to find this scene.");
  });

  it("keeps the description in the accessibility tree whether or not the tooltip is open", () => {
    // If the description only existed while the tooltip was visible, it would
    // reach only the people who had already found the tooltip.
    render(<TextField label="Name" value="" help="Explanation." onChange={vi.fn()} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Explanation.");
  });

  it("adds nothing when a field has no help", () => {
    render(<TextField label="Name" value="" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("button", { name: /what does this do/i })).not.toBeInTheDocument();
  });

  it("shows the explanation on hover", async () => {
    const user = userEvent.setup();
    render(<TextField label="Name" value="" help="Explanation." onChange={vi.fn()} />);

    await user.hover(screen.getByRole("button", { name: /what does this do/i }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("Explanation.");
  });

  it("shows it on keyboard focus too, since hover is not available to everyone", async () => {
    const user = userEvent.setup();
    render(<TextField label="Name" value="" help="Explanation." onChange={vi.fn()} />);

    await user.tab();
    expect(screen.getByRole("button", { name: /what does this do/i })).toHaveFocus();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("stays open when clicked, so it can be read at length or tapped", async () => {
    const user = userEvent.setup();
    render(<TextField label="Name" value="" help="Explanation." onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /what does this do/i });
    await user.click(trigger);
    await user.unhover(trigger);

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("closes again on a second click", async () => {
    const user = userEvent.setup();
    render(<TextField label="Name" value="" help="Explanation." onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /what does this do/i });
    await user.click(trigger);
    await user.click(trigger);
    await user.unhover(trigger);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("reports whether it is open, so the control is not a mystery button", async () => {
    const user = userEvent.setup();
    render(<TextField label="Name" value="" help="Explanation." onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /what does this do/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("is offered by every control kind, not just text", () => {
    const { unmount } = render(
      <NumberField label="Duration" value={90} help="How long." onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Duration")).toHaveAccessibleDescription("How long.");
    unmount();

    const select = render(
      <SelectField
        label="Format"
        value="mp4"
        options={[{ value: "mp4", label: "MP4" }]}
        help="Which container."
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Format")).toHaveAccessibleDescription("Which container.");
    select.unmount();

    render(<ToggleField label="Locked" checked={false} help="Stops moving." onChange={vi.fn()} />);
    expect(screen.getByLabelText("Locked")).toHaveAccessibleDescription("Stops moving.");
  });
});

/**
 * The copy is the feature. A tooltip on "Duration" reading "the duration" has
 * cost a hover and said nothing, so these guard the writing rather than the
 * markup.
 */
describe("the help copy", () => {
  const entries = Object.entries(HELP);

  it("explains rather than restating the label", () => {
    for (const [key, text] of entries) {
      // Short enough to have said nothing useful.
      expect(text.length, `${key} is too short to be an explanation`).toBeGreaterThan(40);
    }
  });

  it("stays short enough to read in a tooltip", () => {
    for (const [key, text] of entries) {
      expect(text.length, `${key} is too long for a tooltip`).toBeLessThan(220);
    }
  });

  it("is written as sentences", () => {
    for (const [key, text] of entries) {
      expect(text, `${key} should end in a full stop`).toMatch(/[.!?]$/);
      expect(text[0], `${key} should start with a capital`).toBe(text[0].toUpperCase());
    }
  });

  it("says what changing the value does, for the properties that surprise people", () => {
    // These three cost a user an experiment to discover, which is the whole
    // reason the feature exists.
    expect(HELP.exportFps).toMatch(/resample/i);
    expect(HELP.exportAspectRatio).toMatch(/never cropped|centred/i);
    expect(HELP.compositionTheme).toMatch(/separate from the editor/i);
  });
});

/**
 * The properties panel is docked to the right edge of the window, so a trigger
 * in the right-hand column of a two-column row -- Height, Y, Resolution -- sits
 * within a popover's width of the edge. An unclamped position puts half the
 * text off screen, and jsdom has no layout engine to catch it.
 */
describe("placing the popover", () => {
  const VIEWPORT = 1440;

  it("hangs it under the trigger", () => {
    const { top } = placePopover({ bottom: 300, left: 100 }, VIEWPORT);
    expect(top).toBe(306);
  });

  it("aligns it with the trigger when there is room", () => {
    expect(placePopover({ bottom: 0, left: 400 }, VIEWPORT).left).toBe(400);
  });

  it("pulls it back on screen next to a field at the right edge", () => {
    // A trigger 40px from the right edge: unclamped this would put most of the
    // popover outside the window.
    const { left } = placePopover({ bottom: 0, left: VIEWPORT - 40 }, VIEWPORT);

    expect(left + POPOVER_WIDTH).toBeLessThanOrEqual(VIEWPORT);
  });

  it("never pushes it off the left edge, even on a narrow window", () => {
    // A viewport narrower than the popover itself: it should pin left rather
    // than swap which edge it overflows.
    const { left } = placePopover({ bottom: 0, left: 10 }, 200);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it("keeps a gap from the edge rather than butting against it", () => {
    expect(placePopover({ bottom: 0, left: 0 }, VIEWPORT).left).toBeGreaterThan(0);
  });
});
