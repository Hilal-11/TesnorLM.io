import { screen, waitFor, within } from "@testing-library/react";
import { BookOpen, FileText, NotebookPen } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { BreadcrumbSwitcher } from "@/components/ui/breadcrumb-switcher";
import { Sidebar, SidebarGroup, SidebarNavItem, SidebarSection } from "@/components/ui/sidebar-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCard } from "@/components/ui/user-card";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";

function NotebookTabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Notebook">
        {["Overview", "Sources", "Chat"].map((t) => (
          <TabsTrigger key={t} value={t.toLowerCase()}>
            {t}
          </TabsTrigger>
        ))}
      </TabsList>
      {["overview", "sources", "chat"].map((v) => (
        <TabsContent key={v} value={v}>
          {v} panel
        </TabsContent>
      ))}
    </Tabs>
  );
}

describe("Tabs", () => {
  it("arrow keys move between tabs and the underline follows", async () => {
    const { user, container } = renderUI(<NotebookTabs />);
    screen.getAllByRole("tab").forEach((tab, i) => {
      Object.defineProperty(tab, "offsetLeft", { configurable: true, value: i * 100 });
      Object.defineProperty(tab, "offsetWidth", { configurable: true, value: 80 });
    });
    await user.tab();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    const sources = screen.getByRole("tab", { name: "Sources" });
    expect(sources).toHaveFocus();
    expect(sources).toHaveAttribute("aria-selected", "true");
    const indicator = container.querySelector(
      '[data-slot="tabs-list"] > span[aria-hidden]',
    ) as HTMLElement;
    await waitFor(() => expect(indicator.style.transform).toBe("translateX(100px) scaleX(80)"));
  });
});

describe("BreadcrumbSwitcher", () => {
  it("marks the current page and switches from a segment menu", async () => {
    const onSelect = vi.fn();
    const { user } = renderUI(
      <BreadcrumbSwitcher
        segments={[
          {
            label: "Transformers",
            options: [
              { value: "transformers", label: "Transformers" },
              { value: "vision", label: "Vision models" },
            ],
            value: "transformers",
            onSelect,
          },
          { label: "Explain", status: { word: "Intermediate level" } },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByText("Explain").closest("[aria-current]")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(within(nav).getByRole("button", { name: "Transformers" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Vision models" }));
    expect(onSelect).toHaveBeenCalledWith("vision");
  });
});

describe("Sidebar", () => {
  it("marks the active item and persists a group's open state", async () => {
    const tree = (
      <Sidebar>
        <SidebarSection label="Notebooks">
          <SidebarNavItem icon={FileText} label="All sources" active count={12} />
          <SidebarGroup id="transformers" icon={NotebookPen} label="Transformers">
            <SidebarNavItem icon={BookOpen} label="Attention" />
          </SidebarGroup>
        </SidebarSection>
      </Sidebar>
    );
    const { user, unmount } = renderUI(tree);
    expect(screen.getByRole("link", { name: /All sources/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const group = screen.getByRole("button", { name: "Transformers" });
    expect(group).toHaveAttribute("aria-expanded", "true");
    await user.click(group);
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(group.getAttribute("aria-controls")!)).toHaveAttribute("inert");

    unmount();
    renderUI(tree);
    expect(screen.getByRole("button", { name: "Transformers" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("collapsed items keep their names", () => {
    renderUI(
      <Sidebar collapsed>
        <SidebarSection label="Library">
          <SidebarNavItem icon={FileText} label="All sources" />
        </SidebarSection>
      </Sidebar>,
    );
    expect(screen.getByRole("link", { name: "All sources" })).toBeInTheDocument();
  });
});

describe("UserCard", () => {
  it("menu ends with Sign out and switches theme", async () => {
    const onThemeChange = vi.fn();
    const { user } = renderUI(
      <UserCard
        name="Asha Rao"
        email="asha@example.com"
        theme="system"
        onThemeChange={onThemeChange}
        onSignOut={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Asha Rao/ }));
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.at(-1)).toHaveAccessibleName("Sign out");
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });

  it("has no axe violations", async () => {
    const { container } = renderUI(
      <div>
        <NotebookTabs />
        <BreadcrumbSwitcher segments={[{ label: "Study group" }, { label: "Transformers" }]} />
        <Sidebar>
          <SidebarSection label="Library">
            <SidebarNavItem icon={FileText} label="All sources" active />
          </SidebarSection>
        </Sidebar>
        <UserCard
          name="Asha Rao"
          email="asha@example.com"
          theme="light"
          onThemeChange={() => {}}
          onSignOut={() => {}}
        />
      </div>,
    );
    await expectNoAxeViolations(container);
  });
});
