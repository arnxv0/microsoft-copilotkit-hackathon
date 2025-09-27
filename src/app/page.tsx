"use client";

import { useCoAgent, useCopilotAction, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotChat, CopilotPopup } from "@copilotkit/react-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/button"
import AppChatHeader, { PopupHeader } from "@/components/canvas/AppChatHeader";
import { X } from "lucide-react"
import { motion, useScroll, useTransform, useMotionValueEvent } from "motion/react";
import { cn, getContentArg } from "@/lib/utils";
import useMediaQuery from "@/hooks/use-media-query";

// Updated types based on your requirements
export type CardType = "table" | "text";

export type TableData = {
  columns: string[];
  rows: string[][];
};

export type TextData = {
  content: string;
};

export type ItemData = TableData | TextData;

export interface Item {
  id: string;
  type: CardType;
  name: string;
  subtitle: string;
  data: ItemData;
}

export interface AgentState {
  items: Item[];
  globalTitle: string;
  globalDescription: string;
  lastAction?: string;
  itemsCreated: number;
}

const initialState: AgentState = {
  items: [],
  globalTitle: "Project Canvas",
  globalDescription: "Manage your projects and data",
  itemsCreated: 0,
};

const isNonEmptyAgentState = (state: AgentState | null): boolean => {
  return state !== null && (state.items.length > 0 || state.globalTitle !== "" || state.globalDescription !== "");
};

// Card Renderer Component
const CardRenderer: React.FC<{ item: Item; onUpdateData: (updater: (data: ItemData) => ItemData) => void }> = ({ item, onUpdateData }) => {
  if (item.type === "table") {
    const tableData = item.data as TableData;
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              {tableData.columns.map((column, index) => (
                <th key={index} className="border border-gray-200 p-2 text-left font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border border-gray-200 p-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (item.type === "text") {
    const textData = item.data as TextData;
    return (
      <div className="prose prose-sm max-w-none">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{textData.content}</p>
      </div>
    );
  }

  return <div>Unknown card type</div>;
};

// Item Header Component
const ItemHeader: React.FC<{
  id: string;
  name: string;
  subtitle: string;
  description: string;
  onNameChange: (name: string) => void;
  onSubtitleChange: (subtitle: string) => void;
}> = ({ id, name, subtitle, onNameChange, onSubtitleChange }) => {
  return (
    <div className="space-y-2">
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Item name..."
        className="w-full text-lg font-semibold bg-transparent border-none outline-none focus:ring-0"
      />
      <input
        value={subtitle}
        onChange={(e) => onSubtitleChange(e.target.value)}
        placeholder="Item subtitle..."
        className="w-full text-sm text-gray-600 bg-transparent border-none outline-none focus:ring-0"
      />
    </div>
  );
};

// New Item Menu Component
const NewItemMenu: React.FC<{
  onSelect: (type: CardType) => void;
  align?: string;
  className?: string;
}> = ({ onSelect, align, className }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-1.25 text-base font-semibold"
      >
        + Add Item
      </Button>
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 bg-white border rounded-lg shadow-lg p-2 space-y-1 z-50">
          <button
            onClick={() => {
              onSelect("table");
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
          >
            📊 Table
          </button>
          <button
            onClick={() => {
              onSelect("text");
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
          >
            📝 Text
          </button>
        </div>
      )}
    </div>
  );
};

export default function CopilotKitPage() {
  const { state, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
    initialState,
  });

  // Global cache for the last non-empty agent state
  const cachedStateRef = useRef<AgentState>(state ?? initialState);
  useEffect(() => {
    if (isNonEmptyAgentState(state)) {
      cachedStateRef.current = state as AgentState;
    }
  }, [state]);

  const viewState: AgentState = isNonEmptyAgentState(state) ? (state as AgentState) : cachedStateRef.current;

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [showJsonView, setShowJsonView] = useState<boolean>(false);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const { scrollY } = useScroll({ container: scrollAreaRef });
  const headerScrollThreshold = 64;
  const headerOpacity = useTransform(scrollY, [0, headerScrollThreshold], [1, 0]);
  const [headerDisabled, setHeaderDisabled] = useState<boolean>(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const descTextareaRef = useRef<HTMLInputElement | null>(null);

  // Helper function to generate unique IDs
  const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add item function
  const addItem = (type: CardType) => {
    const newItem: Item = {
      id: generateId(),
      type,
      name: `New ${type === "table" ? "Table" : "Text"}`,
      subtitle: "",
      data: type === "table"
        ? { columns: ["Column 1", "Column 2"], rows: [["Row 1, Col 1", "Row 1, Col 2"]] }
        : { content: "Enter your text here..." }
    };

    setState((prev) => ({
      ...(prev ?? initialState),
      items: [...(prev?.items ?? []), newItem],
      itemsCreated: (prev?.itemsCreated ?? 0) + 1,
      lastAction: `Added ${type} item`
    }));
  };

  // Delete item function
  const deleteItem = (id: string) => {
    setState((prev) => ({
      ...(prev ?? initialState),
      items: (prev?.items ?? []).filter(item => item.id !== id),
      lastAction: `Deleted item ${id}`
    }));
  };

  // Update item function
  const updateItem = (id: string, updates: Partial<Pick<Item, 'name' | 'subtitle'>>) => {
    setState((prev) => ({
      ...(prev ?? initialState),
      items: (prev?.items ?? []).map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
      lastAction: `Updated item ${id}`
    }));
  };

  // Update item data function
  const updateItemData = (id: string, updater: (data: ItemData) => ItemData) => {
    setState((prev) => ({
      ...(prev ?? initialState),
      items: (prev?.items ?? []).map(item =>
        item.id === id ? { ...item, data: updater(item.data) } : item
      ),
      lastAction: `Updated data for item ${id}`
    }));
  };

  // Sample data for the default table
  const sampleTableData: TableData = {
    columns: ["Project", "Status", "Progress", "Assignee"],
    rows: [
      ["Project Alpha", "Active", "75%", "John Doe"],
      ["Beta Release", "Pending", "45%", "Jane Smith"],
      ["Documentation", "Complete", "100%", "Bob Johnson"],
      ["Testing Phase", "Active", "60%", "Alice Brown"],
    ]
  };

  // Register Copilot actions
  useCopilotAction({
    name: "add_table_item",
    description: "Add a new table item to the canvas",
    parameters: [
      {
        name: "name",
        type: "string",
        description: "Name of the table item",
        required: true,
      },
      {
        name: "subtitle",
        type: "string",
        description: "Subtitle for the table item",
        required: false,
      },
      {
        name: "columns",
        type: "string[]",
        description: "Column headers for the table",
        required: true,
      },
      {
        name: "rows",
        type: "string[][]",
        description: "Rows of data for the table",
        required: true,
      }
    ],
    handler: ({ name, subtitle, columns, rows }) => {
      const newItem: Item = {
        id: generateId(),
        type: "table",
        name: name || "New Table",
        subtitle: subtitle || "",
        data: { columns, rows }
      };

      setState((prev) => ({
        ...(prev ?? initialState),
        items: [...(prev?.items ?? []), newItem],
        itemsCreated: (prev?.itemsCreated ?? 0) + 1,
        lastAction: `Added table item: ${name}`
      }));
    },
  });

  useCopilotAction({
    name: "add_text_item",
    description: "Add a new text item to the canvas",
    parameters: [
      {
        name: "name",
        type: "string",
        description: "Name of the text item",
        required: true,
      },
      {
        name: "subtitle",
        type: "string",
        description: "Subtitle for the text item",
        required: false,
      },
      {
        name: "content",
        type: "string",
        description: "Text content",
        required: true,
      }
    ],
    handler: ({ name, subtitle, content }) => {
      const newItem: Item = {
        id: generateId(),
        type: "text",
        name: name || "New Text",
        subtitle: subtitle || "",
        data: { content }
      };

      setState((prev) => ({
        ...(prev ?? initialState),
        items: [...(prev?.items ?? []), newItem],
        itemsCreated: (prev?.itemsCreated ?? 0) + 1,
        lastAction: `Added text item: ${name}`
      }));
    },
  });

  const titleClasses = "bg-transparent border-none outline-none focus:ring-0 resize-none";

  // Replace the EmptyState section with table and heading
  const renderMainContent = () => {
    if ((viewState.items ?? []).length === 0) {
      return (
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold text-foreground mb-6">Project Dashboard</h2>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Sample Table</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        {sampleTableData.columns.map((column, index) => (
                          <th key={index} className="border border-gray-200 p-3 text-left font-medium text-muted-foreground">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleTableData.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-muted/50">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="border border-gray-200 p-3 text-sm">
                              {cellIndex === 2 && cell.includes('%') ? (
                                <span className="font-medium">{cell}</span>
                              ) : cellIndex === 1 ? (
                                <span className={cn(
                                  "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full",
                                  cell === "Active" ? "bg-green-100 text-green-800" :
                                    cell === "Complete" ? "bg-blue-100 text-blue-800" :
                                      "bg-yellow-100 text-yellow-800"
                                )}>
                                  {cell}
                                </span>
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Ask Scout to add new items or start by clicking the "Add Item" button.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 py-0 overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-2 pb-20 p-6">
          {(viewState.items ?? []).map((item) => (
            <article key={item.id} className="relative rounded-2xl border p-5 shadow-sm transition-colors ease-out bg-card hover:border-accent/40 focus-within:border-accent/60">
              <button
                type="button"
                aria-label="Delete card"
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-card text-gray-400 hover:bg-accent/10 hover:text-accent transition-colors"
                onClick={() => deleteItem(item.id)}
              >
                <X className="h-4 w-4" />
              </button>
              <ItemHeader
                id={item.id}
                name={item.name}
                subtitle={item.subtitle}
                description={""}
                onNameChange={(v) => updateItem(item.id, { name: v })}
                onSubtitleChange={(v) => updateItem(item.id, { subtitle: v })}
              />
              <div className="mt-6">
                <CardRenderer item={item} onUpdateData={(updater) => updateItemData(item.id, updater)} />
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <motion.div style={{ opacity: headerOpacity }} className="p-4">
            <input
              ref={titleInputRef}
              disabled={headerDisabled}
              value={viewState?.globalTitle ?? initialState.globalTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState((prev) => ({ ...(prev ?? initialState), globalTitle: e.target.value }))
              }
              placeholder="Canvas title..."
              className={cn(titleClasses, "text-2xl font-semibold w-full")}
            />
            <input
              ref={descTextareaRef}
              disabled={headerDisabled}
              value={viewState?.globalDescription ?? initialState.globalDescription}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setState((prev) => ({ ...(prev ?? initialState), globalDescription: e.target.value }))
              }
              placeholder="Canvas description..."
              className={cn(titleClasses, "mt-2 text-sm leading-6 w-full")}
            />
          </motion.div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <div ref={scrollAreaRef} className="h-full overflow-y-auto">
            {renderMainContent()}
          </div>

          {/* Bottom Action Bar */}
          <div className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-4",
            "inline-flex rounded-lg shadow-lg bg-card"
          )}>
            <NewItemMenu
              onSelect={(t: CardType) => addItem(t)}
              align="center"
              className="rounded-r-none border-r-0"
            />
            <Button
              type="button"
              variant="outline"
              className="gap-1.25 text-base font-semibold rounded-l-none"
              onClick={() => setShowJsonView((v) => !v)}
            >
              {showJsonView ? "Canvas" : "JSON"}
            </Button>
          </div>

          {/* JSON View Modal */}
          {showJsonView && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50">
              <div className="h-full p-4">
                <div className="h-full bg-card rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">JSON View</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowJsonView(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <pre className="bg-muted p-4 rounded text-sm overflow-auto h-full">
                    {JSON.stringify(viewState, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="w-96 border-l">
        <CopilotChat
          className="h-full"
          instructions="You are Scout, an AI assistant that helps manage canvas items. You can add table items with add_table_item and text items with add_text_item. Help users organize their data effectively."
        />
      </div>
    </div>
  );
}
