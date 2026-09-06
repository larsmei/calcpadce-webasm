import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_OPTIONS,
  DEFAULT_WORKSHEET,
  type EngineOptions,
  type ParseError,
  type ViewMode,
} from "./types";
import { persistStorage } from "./persist-storage";

export type EngineStatus = "idle" | "booting" | "ready" | "running" | "error";

type CalcpadState = {
  source: string;
  options: EngineOptions;
  html: string;
  errors: ParseError[];
  status: EngineStatus;
  bootError: string | null;
  lastRunMs: number | null;
  fileName: string;
  autoRun: boolean;
  viewMode: ViewMode;
  uiOverrides: Record<string, string>;
  greekBar: boolean;
  setSource: (source: string) => void;
  setOptions: (patch: Partial<EngineOptions>) => void;
  setResult: (html: string, errors: ParseError[], ms: number) => void;
  setStatus: (status: EngineStatus, bootError?: string | null) => void;
  setFileName: (fileName: string) => void;
  setAutoRun: (autoRun: boolean) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setUiOverrides: (uiOverrides: Record<string, string>) => void;
  setGreekBar: (greekBar: boolean) => void;
  resetWorksheet: () => void;
};

export const useCalcpadStore = create<CalcpadState>()(
  persist(
    (set) => ({
      source: DEFAULT_WORKSHEET,
      options: DEFAULT_OPTIONS,
      html: "",
      errors: [],
      status: "idle",
      bootError: null,
      lastRunMs: null,
      fileName: "worksheet.cpd",
      autoRun: true,
      viewMode: "results",
      uiOverrides: {},
      greekBar: false,
      setSource: (source) => set({ source }),
      setOptions: (patch) =>
        set((s) => ({ options: { ...s.options, ...patch } })),
      setResult: (html, errors, ms) =>
        set({ html, errors, lastRunMs: ms, status: "ready" }),
      setStatus: (status, bootError = null) => set({ status, bootError }),
      setFileName: (fileName) => set({ fileName }),
      setAutoRun: (autoRun) => set({ autoRun }),
      setViewMode: (viewMode) => set({ viewMode }),
      setUiOverrides: (uiOverrides) => set({ uiOverrides }),
      setGreekBar: (greekBar) => set({ greekBar }),
      resetWorksheet: () =>
        set({
          source: DEFAULT_WORKSHEET,
          fileName: "worksheet.cpd",
          html: "",
          errors: [],
          viewMode: "results",
          uiOverrides: {},
        }),
    }),
    {
      name: "calcpadce-wasm",
      storage: createJSONStorage(() => persistStorage),
      partialize: (s) => ({
        source: s.source,
        options: s.options,
        fileName: s.fileName,
        autoRun: s.autoRun,
        viewMode: s.viewMode,
        uiOverrides: s.uiOverrides,
        greekBar: s.greekBar,
      }),
    },
  ),
);
