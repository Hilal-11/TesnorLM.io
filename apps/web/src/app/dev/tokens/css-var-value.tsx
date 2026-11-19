"use client";

/**
 * Prints a CSS custom property's live value at the place it renders, so a swatch inside a `.dark`
 * wrapper shows the dark value. Reading the DOM keeps the page in sync with globals.css.
 */
export function CssVarValue({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={className}
      ref={(el) => {
        if (!el) return;
        el.textContent = readable(getComputedStyle(el).getPropertyValue(`--${name}`).trim());
      }}
    />
  );
}

/** Undo the CSS minifier's short forms (3-digit hex, seconds) so values read like the design skill. */
function readable(value: string) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const full = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return `#${full.toUpperCase()}`;
  }
  const seconds = /^(\d*\.?\d+)s$/.exec(value);
  if (seconds) return `${Math.round(parseFloat(seconds[1]) * 1000)}ms`;
  return value;
}
