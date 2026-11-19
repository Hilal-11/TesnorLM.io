import { screen, within } from "@testing-library/react";
import { Copy, Pencil, Share2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
  TypedConfirmDialog,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast, Toaster } from "@/components/ui/toast";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";

function AddSourceDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Add source</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader title="Add a source by link" description="PDFs and web pages work best." />
        <DialogBody>
          <Field label="Link">
            <Input prefix="https://" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button>Add source</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Modal", () => {
  it("focuses the first field, traps focus, closes on Esc and returns focus", async () => {
    const { user } = renderUI(<AddSourceDialog />);
    const trigger = screen.getByRole("button", { name: "Add source" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Add a source by link" });
    expect(dialog).toHaveAccessibleDescription("PDFs and web pages work best.");
    expect(within(dialog).getByLabelText("Link")).toHaveFocus();

    // Tab past the last control wraps inside the dialog.
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    expect(within(dialog).getByRole("button", { name: "Close dialog" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("typed confirmation enables the action only on an exact match", async () => {
    const onConfirm = vi.fn();
    const { user } = renderUI(
      <TypedConfirmDialog
        trigger={<Button variant="danger">Delete notebook</Button>}
        title="Delete this notebook?"
        description="This can't be undone."
        confirmText="Transformers"
        actionLabel="Delete notebook"
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete notebook" }));
    const dialog = await screen.findByRole("dialog");
    const action = within(dialog).getByRole("button", { name: "Delete notebook" });
    const input = within(dialog).getByRole("textbox");
    expect(action).toBeDisabled();
    await user.type(input, "transformers");
    expect(action).toBeDisabled();
    await user.clear(input);
    await user.type(input, "Transformers");
    expect(action).toBeEnabled();
    await user.click(action);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("has no axe violations when open", async () => {
    const { user, baseElement } = renderUI(<AddSourceDialog />);
    await user.click(screen.getByRole("button", { name: "Add source" }));
    await screen.findByRole("dialog");
    await expectNoAxeViolations(baseElement);
  });
});

describe("Sheet", () => {
  it("opens as a bottom sheet on small screens, steps through snap points, closes on Esc", async () => {
    const { user } = renderUI(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Open source details</Button>
        </SheetTrigger>
        <SheetContent title="attention-is-all-you-need.pdf">Body</SheetContent>
      </Sheet>,
    );
    await user.click(screen.getByRole("button", { name: "Open source details" }));
    const sheet = await screen.findByRole("dialog", { name: "attention-is-all-you-need.pdf" });
    expect(sheet).toHaveAttribute("data-side", "bottom");
    expect(sheet).toHaveAttribute("data-snap", "0.5");
    await user.click(within(sheet).getByRole("button", { name: /Resize sheet/ }));
    expect(sheet).toHaveAttribute("data-snap", "1");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("DropdownMenu", () => {
  it("works with arrows, typeahead and a submenu", async () => {
    const onDuplicate = vi.fn();
    const { user } = renderUI(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Source actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem icon={Pencil}>Rename</DropdownMenuItem>
          <DropdownMenuItem icon={Copy} onSelect={onDuplicate}>
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger icon={Share2}>Share</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Copy link</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    screen.getByRole("button", { name: "Source actions" }).focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Rename" })).toHaveFocus();

    await user.keyboard("s");
    expect(within(menu).getByRole("menuitem", { name: "Share" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByRole("menuitem", { name: "Copy link" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(within(menu).getByRole("menuitem", { name: "Share" })).toHaveFocus();

    await user.keyboard("{ArrowUp}{Enter}");
    expect(onDuplicate).toHaveBeenCalledOnce();
  });
});

describe("Toast", () => {
  it("announces politely and runs Undo", async () => {
    const onUndo = vi.fn();
    const { user } = renderUI(<Toaster />);
    toast.success("Source deleted", { action: { label: "Undo", onClick: onUndo } });
    const message = await screen.findByText("Source deleted");
    expect(message.closest("[aria-live='polite']")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
