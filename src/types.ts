import { z } from 'zod';

export interface MADEToken {
  name: string;
  value: string;
  category: 'color' | 'spacing' | 'typography' | 'shadow' | 'radius' | 'breakpoint' | 'time' | 'other';
  description?: string;
}

export interface MADEComponent {
  name: string;
  description: string;
  tags: string[];
  variants: Record<string, string[]>;
  props: Record<string, any>;
  a11yNotes?: string[];
  htmlScaffold: string;
  cssClasses: string[];
  cssVarsUsed: string[];
  examples: ComponentExample[];
}

export interface ComponentExample {
  title: string;
  html: string;
  description?: string;
  props?: Record<string, any>;
}

export interface SearchResult {
  component: string;
  title: string;
  html: string;
  sourcePath: string;
  upstreamRef: string;
}

export interface LintIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  fixSuggestion?: string;
  line?: number;
  column?: number;
}

export interface IndexMeta {
  version: string;
  upstreamCommit: string;
  upstreamRef: string;
  buildTime: string;
  componentsCount: number;
  tokensCount: number;
}

// Zod schemas for MCP tool validation
export const ListTokensSchema = z.object({
  scope: z.string().optional()
});

export const GetComponentSchema = z.object({
  name: z.string()
});

export const ScaffoldComponentSchema = z.object({
  name: z.string(),
  props: z.record(z.string(), z.any()).optional()
});

export const SearchExamplesSchema = z.object({
  query: z.string()
});

export const LintMarkupSchema = z.object({
  html: z.string()
});

// MCP Tool Response Types
export interface ListTokensResponse {
  tokens: MADEToken[];
  meta?: {
    totalCount: number;
    filteredCount: number;
  };
}

export interface ListComponentsResponse {
  components: Array<{
    name: string;
    description: string;
    tags: string[];
    variants: Record<string, string[]>;
    props: Record<string, any>;
    a11yNotes?: string[];
  }>;
}

export interface GetComponentResponse extends MADEComponent {
  html: string;
  classes: string[];
  cssVarsUsed: string[];
  variants: Record<string, string[]>;
  a11yNotes: string[];
  examples: ComponentExample[];
}

export interface ScaffoldComponentResponse {
  html: string;
  notes: string[];
  dependencies?: string[];
}

export interface SearchExamplesResponse {
  results: SearchResult[];
  meta: {
    totalResults: number;
    query: string;
  };
}

export interface LintMarkupResponse {
  valid: boolean;
  issues: LintIssue[];
  suggestions?: string[];
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  upstreamVersion?: string;
  lastSync?: string;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }>;
}

export interface VersionResponse {
  server: string;
  upstream: string;
  lastSync: string;
  indexMeta: IndexMeta;
}