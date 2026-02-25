/**
 * state.ts
 * Sadece bu sayfanın state'i.
 * Başka sayfa state'i ile bağlantı KURMA.
 */

import { useState } from "react";
import type { PrimRowRequest } from "./contract";

/**
 * Prim sayfası state interface'i
 */
export interface PrimState {
  rows: PrimRowRequest[];
  amounts: number[];
  total: number;
  brutInputForNet: string;
  currentRecordName: string | null;
  loadRanRef: { current: boolean };
}

/**
 * State hook'u
 */
export function usePrimState() {
  const [rows, setRows] = useState<PrimRowRequest[]>([
    { id: Math.random().toString(36).slice(2), principal: "", percent: "" },
  ]);
  const [amounts, setAmounts] = useState<number[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [brutInputForNet, setBrutInputForNet] = useState("");
  const [currentRecordName, setCurrentRecordName] = useState<string | null>(null);
  const loadRanRef = { current: false };

  return {
    rows,
    setRows,
    amounts,
    setAmounts,
    total,
    setTotal,
    brutInputForNet,
    setBrutInputForNet,
    currentRecordName,
    setCurrentRecordName,
    loadRanRef,
  };
}
