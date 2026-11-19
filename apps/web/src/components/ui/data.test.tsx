import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { DataTable, formatRelative, type DataTableColumn } from "@/components/ui/data-table";
import { getPageItems, Pagination } from "@/components/ui/pagination";
import { toast, Toaster } from "@/components/ui/toast";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";

type Doc = { id: string; name: string; pages: number };
const DOCS: Doc[] = [
  { id: "1", name: "bert.pdf", pages: 16 },
  { id: "2", name: "attention.pdf", pages: 15 },
  { id: "3", name: "resnet.pdf", pages: 12 },
  { id: "4", name: "gpt-3.pdf", pages: 75 },
  { id: "5", name: "clip.pdf", pages: 48 },
];
const COLUMNS: DataTableColumn<Doc>[] = [
  { id: "name", accessorKey: "name", header: "Name" },
  { id: "pages", accessorKey: "pages", header: "Pages", meta: { align: "right" } },
];

const names = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1]?.textContent);

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Doc>>> = {}) {
  return renderUI(
    <>
      <DataTable
        caption="Sources"
        columns={COLUMNS}
        data={DOCS}
        getRowId={(d) => d.id}
        selectable
        {...props}
      />
      <Toaster />
    </>,
  );
}

describe("DataTable sorting", () => {
  it("cycles ascending → descending → none and sets aria-sort", async () => {
    const { user } = renderTable();
    const table = screen.getByRole("table", { name: "Sources" });
    const header = within(table).getByRole("columnheader", { name: /Name/ });
    const sortButton = within(header).getByRole("button");

    expect(header).toHaveAttribute("aria-sort", "none");
    await user.click(sortButton);
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(names(table)).toEqual([
      "attention.pdf",
      "bert.pdf",
      "clip.pdf",
      "gpt-3.pdf",
      "resnet.pdf",
    ]);
    await user.click(sortButton);
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(names(table)[0]).toBe("resnet.pdf");
    await user.click(sortButton);
    expect(header).toHaveAttribute("aria-sort", "none");
    expect(names(table)).toEqual(DOCS.map((d) => d.name));
  });
});

describe("DataTable selection", () => {
  it("select-all shows mixed, then all; the chip counts and clears", async () => {
    const { user } = renderTable();
    const table = screen.getByRole("table");
    const all = within(table).getByRole("checkbox", { name: "Select all rows" });
    await user.click(within(table).getByRole("checkbox", { name: "Select bert.pdf" }));
    expect(all).toHaveAttribute("aria-checked", "mixed");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    await user.click(all);
    expect(all).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("5 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it("Shift+click selects a range", async () => {
    const onSelectionChange = vi.fn();
    const { user } = renderTable({ onSelectionChange });
    const table = screen.getByRole("table");
    await user.click(within(table).getByRole("checkbox", { name: "Select bert.pdf" }));
    await user.keyboard("{Shift>}");
    await user.click(within(table).getByRole("checkbox", { name: "Select gpt-3.pdf" }));
    await user.keyboard("{/Shift}");
    expect(onSelectionChange).toHaveBeenLastCalledWith(["1", "2", "3", "4"]);
    expect(screen.getByText("4 selected")).toBeInTheDocument();
  });

  it("bulk delete shows an Undo toast", async () => {
    const { user } = renderTable({
      defaultSelectedIds: ["1", "2"],
      bulkActions: (ids, clear) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            toast.success(`${ids.length} sources deleted`, {
              action: { label: "Undo", onClick: () => {} },
            });
            clear();
          }}
        >
          Delete
        </Button>
      ),
    });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("2 sources deleted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });
});

describe("DataTable states", () => {
  it("renders loading, empty and error", async () => {
    const onRetry = vi.fn();
    const { user, rerender } = renderUI(
      <DataTable caption="Sources" columns={COLUMNS} data={[]} getRowId={(d) => d.id} loading />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading rows");

    rerender(
      <DataTable
        caption="Sources"
        columns={COLUMNS}
        data={[]}
        getRowId={(d) => d.id}
        emptyState={<p>No sources yet</p>}
      />,
    );
    expect(screen.getByText("No sources yet")).toBeInTheDocument();

    rerender(
      <DataTable
        caption="Sources"
        columns={COLUMNS}
        data={[]}
        getRowId={(d) => d.id}
        error="Couldn't load your sources."
        onRetry={onRetry}
      />,
    );
    const alert = within(screen.getByRole("table")).getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load your sources.");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("has no axe violations", async () => {
    const { container } = renderTable({ defaultSelectedIds: ["1"] });
    await expectNoAxeViolations(container);
  });
});

describe("Pagination", () => {
  it("builds page items with ellipses", () => {
    expect(getPageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageItems(1, 20)).toEqual([1, 2, 3, 4, 5, "ellipsis", 20]);
    expect(getPageItems(10, 20)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
    expect(getPageItems(20, 20)).toEqual([1, "ellipsis", 16, 17, 18, 19, 20]);
  });

  it("shows the range, marks the current page and moves", async () => {
    const onPageChange = vi.fn();
    const { user, container } = renderUI(
      <Pagination
        page={1}
        pageSize={20}
        total={134}
        onPageChange={onPageChange}
        onPageSizeChange={() => {}}
      />,
    );
    expect(screen.getByText("1–20 of 134")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    await expectNoAxeViolations(container);
  });
});

describe("formatRelative", () => {
  it("reads like a person would say it", () => {
    const now = new Date("2026-11-19T10:00:00Z");
    expect(formatRelative(new Date("2026-11-19T08:00:00Z"), now)).toBe("2 hours ago");
    expect(formatRelative(new Date("2026-11-18T09:00:00Z"), now)).toBe("yesterday");
    expect(formatRelative(new Date("2026-11-19T09:59:50Z"), now)).toBe("just now");
  });
});
