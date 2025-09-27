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

// Updated types with rows as one-dimensional array
export type CardType = "table" | "text";

export type TableData = {
  columns: string[];
  rows: string[]; // 1D array format
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
  globalTitle: "ScoutAI Dashboard",
  globalDescription: "AI-powered intelligent data analysis",
  itemsCreated: 0,
};

const isNonEmptyAgentState = (state: AgentState | null): boolean => {
  return state !== null && (state.items.length > 0 || state.globalTitle !== "" || state.globalDescription !== "");
};

// Card Renderer Component - Updated to handle 1D array
const CardRenderer: React.FC<{ item: Item; onUpdateData: (updater: (data: ItemData) => ItemData) => void }> = ({ item, onUpdateData }) => {
  if (item.type === "table") {
    const tableData = item.data as TableData;
    const numColumns = tableData.columns.length;

    // Convert 1D array to 2D array for rendering
    const rows2D: string[][] = [];
    for (let i = 0; i < tableData.rows.length; i += numColumns) {
      rows2D.push(tableData.rows.slice(i, i + numColumns));
    }

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
            {rows2D.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border border-gray-200 p-2">
                    {cell || ""}
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

  // Delete item function (only accessible via X button)
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

  // Intelligent data analysis action
  useCopilotAction({
    name: "intelligent_data_analysis",
    description: "Perform intelligent data analysis that automatically figures out data sources, queries, and presentation",
    parameters: [
      {
        name: "user_request",
        type: "string",
        description: "Natural language description of what to analyze (e.g., 'show me transaction failures', 'analyze user behavior', 'find fraud patterns')",
        required: true,
      }
    ],
    handler: async ({ user_request }) => {
      return `🧠 Analyzing: "${user_request}" - Using AI to determine optimal approach...`;
    },
  });

  useCopilotAction({
    name: "create_intelligent_analysis_table",
    description: "Create a table from intelligent analysis results",
    parameters: [
      {
        name: "columns",
        type: "string[]",
        description: "Table column headers",
        required: true,
      },
      {
        name: "rows",
        type: "string[]",
        description: "Flattened table data",
        required: true,
      },
      {
        name: "title",
        type: "string",
        description: "Analysis title",
        required: true,
      },
      {
        name: "subtitle",
        type: "string",
        description: "Analysis details and methodology",
        required: false,
      },
      {
        name: "metadata",
        type: "string",
        description: "Analysis metadata and insights",
        required: false,
      }
    ],
    handler: ({ columns, rows, title, subtitle = "", metadata = "" }) => {
      const enhancedSubtitle = subtitle + (metadata ? ` | ${metadata}` : "");

      const newItem: Item = {
        id: generateId(),
        type: "table",
        name: title,
        subtitle: enhancedSubtitle,
        data: { columns, rows }
      };

      setState((prev) => ({
        ...(prev ?? initialState),
        items: [...(prev?.items ?? []), newItem],
        itemsCreated: (prev?.itemsCreated ?? 0) + 1,
        lastAction: `Created intelligent analysis: ${title}`
      }));

      const rowCount = Math.floor(rows.length / columns.length);
      return `🧠 Created "${title}" with ${columns.length} columns and ${rowCount} rows using AI analysis`;
    },
  });

  // Regular text item creation (for AI to use)
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
    handler: ({ name, subtitle = "", content }) => {
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

      return `Added text item "${name}"`;
    },
  });

  const titleClasses = "bg-transparent border-none outline-none focus:ring-0 resize-none";

  // Sample data with 1D array format
  const sampleTableData: TableData = {
    columns: ["Analysis Type", "Status", "Capabilities"],
    rows: [
      "Transaction Analysis", "Active", "Failure patterns, fraud detection",
      "User Behavior", "Active", "Engagement metrics, subscription trends",
      "Merchant Performance", "Active", "Volume analysis, commission tracking",
      "Fraud Detection", "Active", "Risk scoring, alert management"
    ]
  };

  // Helper function to render sample table with 1D array
  const renderSampleTable = () => {
    const numColumns = sampleTableData.columns.length;
    const rows2D: string[][] = [];

    for (let i = 0; i < sampleTableData.rows.length; i += numColumns) {
      rows2D.push(sampleTableData.rows.slice(i, i + numColumns));
    }

    return (
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
          {rows2D.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-muted/50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-gray-200 p-3 text-sm">
                  {cellIndex === 1 ? (
                    <span className={cn(
                      "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full",
                      "bg-green-100 text-green-800"
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
    );
  };

  // Main content rendering - no add buttons, AI only adds items
  const renderMainContent = () => {
    if ((viewState.items ?? []).length === 0) {
      return (
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold text-foreground mb-6">ScoutAI Intelligent Dashboard</h2>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Welcome to ScoutAI</h3>
                <div className="mb-6">
                  <p className="text-muted-foreground mb-4">
                    ScoutAI is your intelligent data management assistant with advanced AI-powered analysis capabilities. Just ask what you want to analyze:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                    <li><strong>"Show me transaction failures"</strong> - Automatically analyzes failure patterns</li>
                    <li><strong>"Find high-risk users"</strong> - Identifies users with suspicious activity</li>
                    <li><strong>"Analyze merchant performance"</strong> - Reviews metrics and trends</li>
                    <li><strong>"Show fraud patterns"</strong> - Examines alerts and correlations</li>
                    <li><strong>"Revenue analysis by country"</strong> - Geographic breakdown</li>
                  </ul>
                </div>

                <h4 className="text-md font-semibold mb-3">AI Analysis Capabilities</h4>
                <div className="overflow-x-auto">
                  {renderSampleTable()}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  🧠 ScoutAI automatically determines data sources, generates SQL queries, and presents insights based on your natural language requests.
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

          {/* JSON View Toggle Button - Only show if there are items */}
          {(viewState.items ?? []).length > 0 && (
            <div className={cn(
              "absolute right-4 bottom-4",
              "inline-flex rounded-lg shadow-lg bg-card"
            )}>
              <Button
                type="button"
                variant="outline"
                className="gap-1.25 text-base font-semibold"
                onClick={() => setShowJsonView((v) => !v)}
              >
                {showJsonView ? "Canvas" : "JSON"}
              </Button>
            </div>
          )}

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

      {/* ScoutAI Chat Sidebar */}
      <div className="w-96 border-l">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b bg-card">
            <h2 className="text-lg font-semibold text-foreground">ScoutAI</h2>
            <p className="text-sm text-muted-foreground">Your intelligent data assistant</p>
          </div>
          <CopilotChat
            className="flex-1"
            instructions="You are ScoutAI, an intelligent data management assistant with advanced AI-powered analysis capabilities.

            **INTELLIGENT DATA ANALYSIS:**
            
            I can automatically figure out:
            🧠 Which data sources to use (transactions, users, merchants, fraud alerts)
            🧠 What SQL queries to run based on the request
            🧠 How to structure and present the results
            🧠 What insights to highlight
            
            **WORKFLOW:**
            1. Use 'intelligent_data_analysis' with natural language requests
            2. Use 'create_intelligent_analysis_table' to display results
            
            **EXAMPLE REQUESTS:**
            • 'Show me transaction failures' → Automatically analyzes failure patterns
            • 'Find high-risk users' → Identifies users with suspicious activity  
            • 'Analyze merchant performance' → Reviews merchant metrics and trends
            • 'Show fraud patterns' → Examines fraud alerts and correlations
            • 'Revenue analysis by country' → Geographic revenue breakdown
            • 'User engagement trends' → User activity and subscription analysis
            
            **INTELLIGENCE FEATURES:**
            ✅ Automatically fetches comprehensive data from MCP servers
            ✅ Uses AI to understand natural language requests
            ✅ Generates optimized SQL queries dynamically
            ✅ Presents data in the most relevant format
            ✅ Includes actionable insights and metadata
            
            Just tell me what you want to analyze in natural language - I'll figure out the rest!"
          />
        </div>
      </div>
    </div>
  );
}
