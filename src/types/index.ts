export type PropertyType =
  | "title"
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "status"
  | "date"
  | "checkbox"
  | "url"
  | "email"
  | "person"
  | "relation"
  | "rollup"
  | "formula";

export interface SelectOption {
  id: string;
  name: string;
  color: string; // e.g., 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red'
}

export interface PropertyConfig {
  options?: SelectOption[];
  numberFormat?: "number" | "currency" | "percent";
  formulaExpr?: string;
  relationDatabaseId?: string;
  relationPropertyId?: string;
  rollupRelationPropId?: string;
  rollupTargetPropId?: string;
  rollupFunction?: "count_all" | "count_values" | "count_unique" | "sum" | "avg" | "min" | "max" | "percent_checked";
}

export interface PropertySchema {
  id: string;
  databaseId: string;
  name: string;
  type: PropertyType;
  config: PropertyConfig;
  order: number;
}

export interface DatabaseRow {
  id: string;
  databaseId: string;
  pageId?: string | null;
  properties: Record<string, any>; // [propertyId]: value
  order: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  page?: {
    id: string;
    title: string;
    icon?: string | null;
    cover?: string | null;
  } | null;
}

export type ViewType = "table" | "board" | "calendar" | "gallery" | "list" | "timeline";

export interface FilterCondition {
  id: string;
  propertyId: string;
  operator: "equals" | "does_not_equal" | "contains" | "does_not_contain" | "is_empty" | "is_not_empty" | "is_checked" | "is_not_checked" | "greater_than" | "less_than";
  value?: any;
}

export interface SortCondition {
  propertyId: string;
  direction: "asc" | "desc";
}

export interface DatabaseViewSchema {
  id: string;
  databaseId: string;
  name: string;
  type: ViewType;
  filters: FilterCondition[];
  sorts: SortCondition[];
  grouping?: {
    propertyId?: string;
  };
  visibleProps: string[];
  order: number;
}

export interface DatabaseSchema {
  id: string;
  pageId?: string | null;
  title: string;
  description?: string | null;
  properties: PropertySchema[];
  rows: DatabaseRow[];
  views: DatabaseViewSchema[];
}

export type BlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bullet_list"
  | "numbered_list"
  | "todo"
  | "toggle"
  | "callout"
  | "code"
  | "quote"
  | "divider"
  | "image"
  | "database_view"
  | "synced_block"
  | "columns"
  | "table"
  | "mermaid"
  | "math"
  | "progress"
  | "video"
  | "bookmark";

export interface BlockSchema {
  id: string;
  pageId: string;
  type: BlockType;
  content: Record<string, any>;
  order: number;
  parentId?: string | null;
  syncedBlockId?: string | null;
  children?: BlockSchema[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PageSchema {
  id: string;
  workspaceId: string;
  parentId?: string | null;
  title: string;
  icon?: string | null;
  cover?: string | null;
  isPublished: boolean;
  isTemplate: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  fontStyle?: "sans" | "serif" | "mono";
  fullWidth?: boolean;
  slug?: string | null;
  databaseId?: string | null;
  order: number;
  blocks: BlockSchema[];
  database?: DatabaseSchema | null;
  children?: PageSchema[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface WorkspaceSchema {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  pages: PageSchema[];
}

export interface CommentSchema {
  id: string;
  pageId: string;
  blockId?: string | null;
  authorName: string;
  authorAvatar?: string | null;
  content: string;
  resolved: boolean;
  createdAt: string | Date;
}
