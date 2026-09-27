import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ActionResult = { error?: string; notice?: string };

const upload = vi.fn<(path: string, file: File, options?: unknown) => Promise<{ error: unknown }>>(
  async () => ({ error: null }),
);
const setAvatarAction = vi.fn<(previous: unknown, formData: FormData) => Promise<ActionResult>>(
  async () => ({ notice: "Picture updated." }),
);
const removeAvatarAction = vi.fn<() => Promise<ActionResult>>(async () => ({
  notice: "Picture removed.",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ upload }) } }),
}));

vi.mock("@/features/profile/actions", () => ({
  setAvatarAction: (previous: unknown, formData: FormData) => setAvatarAction(previous, formData),
  removeAvatarAction: () => removeAvatarAction(),
}));

const { AvatarField } = await import("@/features/profile/avatar-field");

const USER = "3f0f1c3e-1d1a-4a4b-9f6c-2f4a1d6b8c11";

function file(name: string, type: string, bytes: number) {
  return new File([new Uint8Array(bytes)], name, { type });
}

function setup(props: Partial<Parameters<typeof AvatarField>[0]> = {}) {
  render(
    <AvatarField
      userId={USER}
      currentSrc={null}
      initial="S"
      hasUpload={false}
      {...props}
    />,
  );
  return userEvent.setup();
}

beforeEach(() => {
  upload.mockClear();
  setAvatarAction.mockClear();
  removeAvatarAction.mockClear();
});

describe("uploading a profile picture", () => {
  it("sends the file to storage and records the path, not a URL", async () => {
    // The server building the URL from a validated path is what stops a user
    // pointing their avatar at an arbitrary address, so the action must be
    // handed a path and nothing else.
    const user = setup();

    await user.upload(screen.getByLabelText("Picture"), file("me.png", "image/png", 1024));

    await waitFor(() => expect(setAvatarAction).toHaveBeenCalled());

    const [, formData] = setAvatarAction.mock.calls[0];
    const path = formData.get("path") as string;

    expect(path.startsWith(`${USER}/`)).toBe(true);
    expect(path.endsWith(".png")).toBe(true);
    expect(formData.get("url")).toBeNull();
  });

  it("refuses a type the bucket would reject, without uploading anything", async () => {
    // Bounced here rather than after a slow upload and an opaque server error.
    const user = setup();

    await user.upload(screen.getByLabelText("Picture"), file("me.svg", "image/svg+xml", 1024));

    expect(upload).not.toHaveBeenCalled();
    expect(setAvatarAction).not.toHaveBeenCalled();
    expect(await screen.findByText(/PNG, JPEG or WebP/)).toBeInTheDocument();
  });

  it("refuses an oversized file and says how big it was", async () => {
    const user = setup();

    await user.upload(
      screen.getByLabelText("Picture"),
      file("huge.png", "image/png", 3 * 1024 * 1024),
    );

    expect(upload).not.toHaveBeenCalled();
    expect(await screen.findByText(/3\.0MB.*limit is 2MB/)).toBeInTheDocument();
  });

  it("does not record anything when the upload itself fails", async () => {
    upload.mockResolvedValueOnce({ error: { message: "Network unreachable" } });
    const user = setup();

    await user.upload(screen.getByLabelText("Picture"), file("me.png", "image/png", 1024));

    await waitFor(() => expect(screen.getByText(/Network unreachable/)).toBeInTheDocument());
    expect(setAvatarAction).not.toHaveBeenCalled();
  });

  it("surfaces a rejection from the server rather than claiming success", async () => {
    setAvatarAction.mockResolvedValueOnce({
      error: "That upload does not belong to your account.",
    });
    const user = setup();

    await user.upload(screen.getByLabelText("Picture"), file("me.png", "image/png", 1024));

    expect(await screen.findByText(/does not belong to your account/)).toBeInTheDocument();
  });
});

describe("removing a profile picture", () => {
  it("offers removal only when there is an upload to remove", () => {
    // Gravatar is not removable here -- it is switched off in the form below,
    // and a Remove button that silently did nothing would be a lie.
    setup({ hasUpload: false });
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("removes the picture when asked", async () => {
    const user = setup({ hasUpload: true, currentSrc: "https://example.supabase.co/x.png" });

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removeAvatarAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Picture removed.")).toBeInTheDocument();
  });

  it("says Replace rather than Upload once a picture exists", async () => {
    setup({ hasUpload: true });
    expect(screen.getByRole("button", { name: /Replace/ })).toBeInTheDocument();
  });
});

describe("the file input", () => {
  it("stays reachable by keyboard", async () => {
    // Hidden with sr-only rather than display:none on purpose: a `hidden` input
    // is not focusable, and the styled button would be the only way in.
    setup();

    const input = screen.getByLabelText("Picture");
    input.focus();
    expect(input).toHaveFocus();
  });

  it("only accepts the types the bucket allows", () => {
    setup();
    expect(screen.getByLabelText("Picture")).toHaveAttribute(
      "accept",
      "image/png,image/jpeg,image/webp",
    );
  });
});
