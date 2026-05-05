import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const apiGetMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

import { ArtistCombobox, type ArtistOption } from "./ArtistCombobox";

const artists: ArtistOption[] = [
  { id: "a1", name: "Aurora", status: "published", imageUrl: "https://cdn.example/a.jpg" },
  { id: "a2", name: "Borealis", status: "published" },
];

const renderBox = (props: Partial<Parameters<typeof ArtistCombobox>[0]> = {}) => {
  const onChange = vi.fn();
  const onRequestNew = vi.fn();
  const componentProps = {
    value: props.value ?? null,
    onChange: props.onChange ?? onChange,
    onRequestNew: props.onRequestNew ?? onRequestNew,
    ...(props.disabled !== undefined ? { disabled: props.disabled } : {}),
  };
  render(<ArtistCombobox {...componentProps} />);
  return { onChange, onRequestNew };
};

beforeEach(() => {
  apiGetMock.mockReset();
  apiGetMock.mockResolvedValue({ items: artists });
});

describe("U-ARTIST-COMBO-001..010: ArtistCombobox", () => {
  it("loads artists, renders image/fallback options, and selects an option", async () => {
    const user = userEvent.setup();
    const { onChange } = renderBox();
    await user.click(screen.getByRole("combobox", { name: /artist/i }));
    expect(await screen.findByText("Aurora")).toBeInTheDocument();
    expect(screen.getByText("Borealis")).toBeInTheDocument();
    expect(document.querySelector('img[src="https://cdn.example/a.jpg"]')).not.toBeNull();
    expect(screen.getByText("♪")).toBeInTheDocument();
    await user.click(screen.getByText("Aurora"));
    expect(onChange).toHaveBeenCalledWith(artists[0]);
  });

  it("debounces search queries and shows add-new footer for no exact match", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    const { onRequestNew } = renderBox();
    await user.type(screen.getByRole("combobox", { name: /artist/i }), "New Artist");
    await user.click(await screen.findByRole("button", { name: /add "new artist"/i }));
    await waitFor(() =>
      expect(apiGetMock).toHaveBeenLastCalledWith("/artists?status=published&q=New%20Artist")
    );
    expect(onRequestNew).toHaveBeenCalledWith("New Artist");
  });

  it("clears selection while typing and hides add-new when there is an exact match", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBox({ value: artists[0]!, onChange });
    const input = screen.getByRole("combobox", { name: /artist/i });
    expect(input).toHaveValue("Aurora");
    await user.clear(input);
    await user.type(input, "Aurora");
    await screen.findByText("Aurora");
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("button", { name: /add/i })).toBeNull();
  });

  it("supports keyboard navigation and Enter selection", async () => {
    const user = userEvent.setup();
    const { onChange } = renderBox();
    const input = screen.getByRole("combobox", { name: /artist/i });
    await user.click(input);
    await screen.findByText("Aurora");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith(artists[1]);
  });

  it("supports ArrowUp wrapping from the first option", async () => {
    const user = userEvent.setup();
    const { onChange } = renderBox();
    const input = screen.getByRole("combobox", { name: /artist/i });
    await user.click(input);
    await screen.findByText("Aurora");
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenCalledWith(artists[1]);
  });

  it("closes the listbox with Escape", async () => {
    const user = userEvent.setup();
    renderBox();
    const input = screen.getByRole("combobox", { name: /artist/i });
    await user.click(input);
    await screen.findByText("Aurora");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("ArrowDown is a no-op when there are no options", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    const { onChange } = renderBox();
    const input = screen.getByRole("combobox", { name: /artist/i });
    await user.click(input);
    await screen.findByText(/no artists match/i);
    await user.keyboard("{ArrowDown}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders loading and API error states", async () => {
    let reject!: (error: unknown) => void;
    apiGetMock.mockReturnValue(new Promise((_resolve, rej) => (reject = rej)));
    renderBox();
    await userEvent.click(screen.getByRole("combobox", { name: /artist/i }));
    expect(await screen.findByText(/loading artists/i)).toBeInTheDocument();
    reject({ status: 500, code: "INTERNAL", message: "boom", requestId: "r1" });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/INTERNAL/));
  });

  it("respects disabled state and ignores empty request names", async () => {
    apiGetMock.mockResolvedValue({ items: [] });
    const { onRequestNew } = renderBox({ disabled: true });
    expect(screen.getByRole("combobox", { name: /artist/i })).toBeDisabled();
    renderBox();
    await userEvent.click(screen.getAllByRole("combobox", { name: /artist/i })[1]!);
    expect(onRequestNew).not.toHaveBeenCalled();
  });
});
