export type AngleMode = 0 | 1 | 2; // deg, rad, gra

export type ViewMode = "form" | "results";

export type EngineOptions = {
  calculate: boolean;
  enableUi: boolean;
  forPrint: boolean;
  uiOverrides: Record<string, string>;
  decimals: number;
  degrees: AngleMode;
  complex: boolean;
  substitute: boolean;
  debug: boolean;
  isUs: boolean;
  units: string;
  fileName: string;
  plotWidth: number;
  plotHeight: number;
};

export type ParseError = {
  line: number;
  outputLine: number;
  message: string;
  source: string;
};

export type ParseResult = {
  html: string;
  errors: ParseError[];
  ok: boolean;
};

export type ExampleMeta = {
  title: string;
  file: string;
  bytes?: number;
  preview?: string;
};

export const DEFAULT_WORKSHEET = `' Calculate the volume of a cylinder
' Form (F4) compiles question marks to input boxes. Results (F5) calculates.
r = ? {5} cm
h = ? {12} cm
#post
V = π * r^2 * h
V|dm^3
V|gal
#end post
`;

export const DEFAULT_OPTIONS: EngineOptions = {
  calculate: true,
  enableUi: false,
  forPrint: false,
  uiOverrides: {},
  decimals: 6,
  degrees: 0,
  complex: false,
  substitute: true,
  debug: true,
  isUs: false,
  units: "m",
  fileName: "worksheet.cpd",
  plotWidth: 520,
  plotHeight: 320,
};

export function hasUiDirective(source: string) {
  return /(^|\n)[ \t]*#ui\b/i.test(source);
}
