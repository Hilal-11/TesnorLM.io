import { createCn } from "cn/config";

/** TensorLM type roles from globals.css (skill 3.1). Registered so `cn` treats them as font sizes. */
export const TYPE_ROLES = [
  "display",
  "h1",
  "h2",
  "h3",
  "body-read",
  "body",
  "small",
  "caption",
  "code",
] as const;

/**
 * Class joining + Tailwind conflict resolution, taught our custom utilities. Without this,
 * `cn("text-h1", "text-ink")` drops `text-h1` because unknown `text-*` classes look like colours.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPE_ROLES] }],
      ease: [{ ease: ["inout", "spring"] }],
    },
  },
});
