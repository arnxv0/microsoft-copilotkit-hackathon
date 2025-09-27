export type CardType = "table" | "text"


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




