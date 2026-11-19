import {
  BookOpen,
  Brain,
  CircleHelp,
  House,
  Library,
  NotebookPen,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; shortcut?: string[] };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/notebooks", label: "Notebooks", icon: NotebookPen },
  { href: "/app/lessons", label: "Lessons", icon: BookOpen },
  { href: "/app/quizzes", label: "Quizzes", icon: Brain },
  { href: "/app/library", label: "Library", icon: Library },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/help", label: "Help", icon: CircleHelp },
];

const ALL = [...PRIMARY_NAV, ...SECONDARY_NAV];

/** "/app" is active only on itself; other items also on their sub-pages. */
export function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function pageTitle(pathname: string) {
  return ALL.find((item) => isActive(pathname, item.href))?.label ?? "TensorLM";
}
