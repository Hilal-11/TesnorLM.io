"use client";

import {
  ArrowUpRight,
  CircleCheck,
  Copy,
  FileDown,
  FileText,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
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
  dialogPanel,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  menuItem,
  menuSurface,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { toast, toastAction, toastSurface } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Demo, ShowcaseSection } from "../showcase";

function CitationPreview() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-small text-graphite">
        <FileText aria-hidden className="size-4" />
        <span className="truncate font-medium text-ink">attention-is-all-you-need.pdf</span>
        <span className="shrink-0">p. 4</span>
      </div>
      <blockquote className="text-body-read text-ink">
        &ldquo;We call our particular attention{" "}
        <mark className="rounded-xs bg-highlight box-decoration-clone px-1 text-ink">
          Scaled Dot-Product Attention
        </mark>
        .&rdquo;
      </blockquote>
      <Button variant="link" size="sm" trailingIcon={ArrowUpRight} className="self-start">
        Open in source
      </Button>
    </div>
  );
}

function AddSourceDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Add source</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader
          title="Add a source by link"
          description={
            <>
              PDFs and web pages work best. <a href="#overlays">What can I add?</a>
            </>
          }
        />
        <DialogBody>
          <Field label="Link" helper="We read the page once and keep a copy in your notebook.">
            <Input prefix="https://" placeholder="arxiv.org/abs/1706.03762" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Add source</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceMenu() {
  const [showFigures, setShowFigures] = useState(true);
  const [level, setLevel] = useState("intermediate");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton icon={MoreHorizontal} aria-label="Source actions" variant="secondary" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuItem icon={Pencil} shortcut={["F2"]}>
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem icon={Copy} shortcut={["mod", "D"]}>
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger icon={Share2}>Share</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Copy link</DropdownMenuItem>
              <DropdownMenuItem>Invite people</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem icon={FileDown}>Download PDF</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={showFigures} onCheckedChange={setShowFigures}>
          Read figures
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Explain at</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={level} onValueChange={setLevel}>
          <DropdownMenuRadioItem value="beginner">Beginner level</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="intermediate">Intermediate level</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="expert">Expert level</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          icon={Trash2}
          destructive
          onSelect={() =>
            toast.success("Source deleted", {
              action: { label: "Undo", onClick: () => toast.info("Source restored") },
            })
          }
        >
          Delete source
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Static renders of the open overlays, so screenshots capture them in both themes. */
function StaticPreviews() {
  return (
    <div inert className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 items-center justify-center rounded-md scrim-dots p-2 sm:p-6 lg:col-span-2">
        <Dialog open modal={false}>
          <div className={cn(dialogPanel, "max-w-[520px]")}>
            <DialogHeader
              title="Add a source by link"
              description="PDFs and web pages work best."
            />
            <DialogBody>
              <Field label="Link">
                <Input prefix="https://" defaultValue="arxiv.org/abs/1706.03762" />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary">Cancel</Button>
              <Button>Add source</Button>
            </DialogFooter>
          </div>
        </Dialog>
      </div>
      <div className={cn(menuSurface, "w-60 max-w-full")} role="presentation">
        <div className={menuItem}>
          <Pencil aria-hidden className="text-graphite" />
          <span className="flex-1">Rename</span>
          <Kbd>F2</Kbd>
        </div>
        <div className={menuItem} data-highlighted="">
          <Copy aria-hidden className="text-graphite" />
          <span className="flex-1">Duplicate</span>
          <Kbd keys={["mod", "D"]} />
        </div>
        <div className="-mx-1 my-1 h-px bg-rule" />
        <p className="px-2 pt-2 pb-1 text-small font-medium text-graphite">Explain at</p>
        <div className={cn(menuItem, "pl-8")}>
          <span className="absolute left-2 flex size-4 items-center justify-center">
            <span className="block size-2 rounded-full bg-primary" />
          </span>
          Intermediate level
        </div>
        <div className="-mx-1 my-1 h-px bg-rule" />
        <div className={cn(menuItem, "text-danger-strong")}>
          <Trash2 aria-hidden />
          Delete source
        </div>
      </div>
      <div className={cn(menuSurface, "w-80 max-w-full p-4")}>
        <CitationPreview />
      </div>
      <div className={cn(toastSurface, "max-w-full")}>
        <CircleCheck aria-hidden className="size-4 text-success-strong" />
        <span className="text-body font-medium">Source deleted</span>
        <button type="button" className={toastAction}>
          Undo
        </button>
      </div>
      <div className={cn(toastSurface, "max-w-full")}>
        <StatusPill status="failed" className="-ml-1" />
        <div className="flex min-w-0 flex-col">
          <span className="text-body font-medium">Couldn&apos;t read bert.pdf</span>
          <span className="text-small text-graphite">
            It has no text layer. Run OCR, then try again.
          </span>
        </div>
      </div>
    </div>
  );
}

export function OverlaysSection() {
  return (
    <ShowcaseSection
      id="overlays"
      title="Overlays"
      usage="Modals for focused tasks, sheets for side detail (a bottom sheet on phones), menus for actions, popovers for previews. Prefer Undo toasts over confirmation dialogs (skill 8.4); keep typed confirmation for what can't be undone."
    >
      <Demo title="Open states" note="Static renders of each overlay's surface.">
        <StaticPreviews />
      </Demo>

      <Demo title="Live example" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <AddSourceDialog />
          <TypedConfirmDialog
            trigger={<Button variant="danger">Delete notebook</Button>}
            title="Delete this notebook?"
            description="Its 7 sources, chats and lessons are deleted for everyone. This can't be undone."
            confirmText="Transformers"
            actionLabel="Delete notebook"
            onConfirm={() => toast.success("Notebook deleted")}
          />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary">Open source details</Button>
            </SheetTrigger>
            <SheetContent title="attention-is-all-you-need.pdf" description="Added 2 hours ago">
              <div className="flex flex-col gap-4">
                <StatusPill status="ready" detail="15 pages" />
                <p className="measure text-body-read">
                  The paper introduces the Transformer, which uses attention instead of recurrence
                  to relate words in a sentence.
                </p>
              </div>
            </SheetContent>
          </Sheet>
          <SourceMenu />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 cursor-pointer items-center rounded-xs bg-accent px-2 text-small font-medium text-primary interactive hover:bg-[color-mix(in_oklab,var(--accent),var(--primary)_12%)]"
              >
                [1]
              </button>
            </PopoverTrigger>
            <PopoverContent arrow className="w-80">
              <CitationPreview />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.success("Source deleted", {
                action: { label: "Undo", onClick: () => toast.info("Source restored") },
              })
            }
          >
            Success with Undo
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.error("Couldn't read bert.pdf", {
                description: "It has no text layer. Run OCR, then try again.",
              })
            }
          >
            Error
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.info("3 sources are still indexing")}
          >
            Info
          </Button>
        </div>
      </Demo>
    </ShowcaseSection>
  );
}
