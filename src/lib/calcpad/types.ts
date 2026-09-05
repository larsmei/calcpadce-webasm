export type AngleMode = 0 | 1 | 2; // deg, rad, gra

export type EngineOptions = {
  calculate: boolean;
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
' Click the underlined inputs in the report to change r or h.
r = ? {5} cm
h = ? {12} cm
V = π * r^2 * h
V|dm^3
V|gal
`;

export const DEFAULT_OPTIONS: EngineOptions = {
  calculate: true,
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
