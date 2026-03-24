"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Methodology } from "@/types";

const MAX_COMPARE = 3;

type CompareContextType = {
  items: Methodology[];
  add: (m: Methodology) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
  isFull: boolean;
};

const CompareContext = createContext<CompareContextType>({
  items: [],
  add: () => {},
  remove: () => {},
  clear: () => {},
  has: () => false,
  isFull: false,
});

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Methodology[]>([]);

  const add = useCallback((m: Methodology) => {
    setItems((prev) => {
      if (prev.length >= MAX_COMPARE || prev.some((p) => p.id === m.id)) return prev;
      return [...prev, m];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback((id: string) => items.some((p) => p.id === id), [items]);

  return (
    <CompareContext.Provider value={{ items, add, remove, clear, has, isFull: items.length >= MAX_COMPARE }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  return useContext(CompareContext);
}
