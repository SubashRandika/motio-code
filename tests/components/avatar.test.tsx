import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "@/components/ui/avatar";

/**
 * Most email addresses have no Gravatar, so the 404 path is the common case,
 * not the edge case. It has to be completely silent: no broken-image glyph, no
 * empty circle, no flash.
 */
describe("the header avatar", () => {
  it("shows the initial when there is no picture to try", () => {
    render(<Avatar src={null} initial="S" label="Signed in as Subash" />);

    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps the initial underneath while a picture is showing", () => {
    // Not a swap: the initial is always rendered and the image covers it. That
    // is what removes the flash of an empty circle before the image arrives.
    render(
      <Avatar src="https://www.gravatar.com/avatar/abc" initial="S" label="Signed in as Subash" />,
    );

    expect(screen.getByText("S")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeInTheDocument();
  });

  it("drops the picture quietly when the address has no Gravatar", () => {
    render(
      <Avatar src="https://www.gravatar.com/avatar/abc" initial="S" label="Signed in as Subash" />,
    );

    const image = document.querySelector("img");
    expect(image).toBeInTheDocument();

    // A 404 from Gravatar, which is how it answers for an unknown address.
    fireEvent.error(image!);

    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("says who is signed in, which the picture alone never did", () => {
    render(<Avatar src={null} initial="S" label="Signed in as Subash" />);

    expect(screen.getByText("Signed in as Subash")).toBeInTheDocument();
  });

  it("does not describe the picture, so the identity is not read twice", () => {
    render(
      <Avatar src="https://www.gravatar.com/avatar/abc" initial="S" label="Signed in as Subash" />,
    );

    // An empty alt makes the image decorative; the sr-only label carries the name.
    expect(document.querySelector("img")).toHaveAttribute("alt", "");
  });
});
