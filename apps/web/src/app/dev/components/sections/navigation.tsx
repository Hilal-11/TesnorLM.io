"use client";

import { BookOpen, Brain, Clock, FileText, Layers, NotebookPen, Star } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BreadcrumbSwitcher } from "@/components/ui/breadcrumb-switcher";
import {
  Sidebar,
  SidebarCollapseToggle,
  SidebarGroup,
  SidebarNavItem,
  SidebarSection,
} from "@/components/ui/sidebar-nav";
import { TabStatus, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCard, type ThemeChoice } from "@/components/ui/user-card";
import { WorkspaceSwitcher } from "@/components/ui/workspace-switcher";
import { Demo, ShowcaseSection, StateMatrix } from "../showcase";

const WORKSPACES = [
  { id: "study", name: "Study group", plan: "Pro" },
  { id: "personal", name: "Personal" },
];

function MiniSidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange?: (c: boolean) => void;
}) {
  const [workspace, setWorkspace] = useState("study");
  const [theme, setTheme] = useState<ThemeChoice>("system");
  return (
    <Sidebar collapsed={collapsed} className="min-h-[640px] rounded-md border border-rule">
      <div className={collapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-2"}>
        <WorkspaceSwitcher
          workspaces={WORKSPACES}
          currentId={workspace}
          onSelect={setWorkspace}
          compact={collapsed}
          className={collapsed ? undefined : "flex-1"}
        />
        {onCollapsedChange && (
          <SidebarCollapseToggle collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
        )}
      </div>
      <SidebarSection label="Library">
        <SidebarNavItem
          icon={FileText}
          label="All sources"
          count={12}
          active
          shortcut={["mod", "1"]}
        />
        <SidebarNavItem icon={Clock} label="Recent" />
        <SidebarNavItem icon={Star} label="Starred" count={3} />
      </SidebarSection>
      <SidebarSection label="Notebooks">
        <SidebarGroup id={`transformers-${collapsed}`} icon={NotebookPen} label="Transformers">
          <SidebarNavItem icon={FileText} label="Attention" />
          <SidebarNavItem icon={FileText} label="BERT" />
        </SidebarGroup>
        <SidebarNavItem icon={NotebookPen} label="Vision models" />
      </SidebarSection>
      <SidebarSection label="Tools">
        <SidebarNavItem icon={Brain} label="Quizzes" />
        <SidebarNavItem icon={Layers} label="Flashcards" />
      </SidebarSection>
      <div className="mt-auto w-full">
        <UserCard
          name="Asha Rao"
          email="asha.rao@example.com"
          theme={theme}
          onThemeChange={setTheme}
          onSignOut={() => {}}
          compact={collapsed}
        />
      </div>
    </Sidebar>
  );
}

export function NavigationSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [notebook, setNotebook] = useState("transformers");
  const [level, setLevel] = useState("intermediate");

  return (
    <ShowcaseSection
      id="navigation"
      title="Navigation"
      usage="Cobalt marks where you are: the active tab underline and the active sidebar item's left edge. Section labels are sentence case. Collapsed items keep their names in tooltips."
    >
      <Demo title="Page tabs">
        <Tabs defaultValue="sources">
          <TabsList aria-label="Notebook">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sources">
              Sources <Badge className="tabular-nums">7</Badge>
            </TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="lessons">
              Lessons <TabStatus>Writing</TabStatus>
            </TabsTrigger>
            <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          {["overview", "sources", "chat", "lessons", "quizzes", "settings"].map((v) => (
            <TabsContent key={v} value={v} className="text-small text-graphite">
              The {v} panel.
            </TabsContent>
          ))}
        </Tabs>
      </Demo>

      <Demo title="Breadcrumb switcher">
        <BreadcrumbSwitcher
          segments={[
            {
              label: "Study group",
              badge: <Badge variant="cobalt">Pro</Badge>,
              menuLabel: "Workspaces",
              options: WORKSPACES.map((w) => ({ value: w.id, label: w.name })),
              value: "study",
            },
            {
              label: notebook === "transformers" ? "Transformers" : "Vision models",
              menuLabel: "Notebooks",
              options: [
                { value: "transformers", label: "Transformers" },
                { value: "vision", label: "Vision models" },
              ],
              value: notebook,
              onSelect: setNotebook,
            },
            {
              label: "Explain",
              status: { word: `${level[0].toUpperCase()}${level.slice(1)} level`, tone: "success" },
              menuLabel: "Level",
              options: [
                { value: "beginner", label: "Beginner" },
                { value: "intermediate", label: "Intermediate" },
                { value: "expert", label: "Expert" },
              ],
              value: level,
              onSelect: setLevel,
            },
          ]}
        />
      </Demo>

      <Demo title="Sidebar item" note="Default · hover · pressed · focus · active">
        <StateMatrix
          columns={["Default", "Hover", "Pressed", "Focus", "Active"]}
          rows={[
            {
              label: "Item",
              cells: (["default", "hover", "pressed", "focus", "active"] as const).map((s) => (
                <Sidebar key={s} className="w-44 p-0">
                  <ul>
                    <SidebarNavItem
                      icon={BookOpen}
                      label="Lessons"
                      count={4}
                      active={s === "active"}
                      data-force={s === "hover" || s === "pressed" || s === "focus" ? s : undefined}
                    />
                  </ul>
                </Sidebar>
              )),
            },
          ]}
        />
      </Demo>

      <Demo title="Sidebar" note="Expanded (live: try the collapse button) and collapsed.">
        <div className="flex flex-wrap items-start gap-6">
          <MiniSidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
          <MiniSidebar collapsed />
        </div>
      </Demo>
    </ShowcaseSection>
  );
}
