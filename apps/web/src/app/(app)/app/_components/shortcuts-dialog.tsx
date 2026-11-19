"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

/** Skill 8.5 shortcuts; the ones not built yet are marked. */
const SHORTCUTS: { keys: string[]; label: string; ready: boolean }[] = [
  { keys: ["mod", "K"], label: "Open the command palette", ready: true },
  { keys: ["mod", "B"], label: "Collapse or expand the sidebar", ready: true },
  { keys: ["Esc"], label: "Close a dialog, menu or panel", ready: true },
  { keys: ["mod", "U"], label: "Add a source", ready: false },
  { keys: ["mod", "/"], label: "Focus the question box", ready: false },
  { keys: ["←", "→"], label: "Step through a diagram", ready: false },
  { keys: ["mod", "shift", "C"], label: "Copy the last answer", ready: false },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader
          title="Keyboard shortcuts"
          description="Ctrl on Windows and Linux, ⌘ on Mac."
        />
        <DialogBody>
          <ul className="flex flex-col divide-y divide-rule">
            {SHORTCUTS.map(({ keys, label, ready }) => (
              <li key={label} className="flex items-center gap-3 py-3">
                <span className="flex-1 text-body text-ink">{label}</span>
                {!ready && <Badge>Coming soon</Badge>}
                <Kbd keys={keys} />
              </li>
            ))}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
