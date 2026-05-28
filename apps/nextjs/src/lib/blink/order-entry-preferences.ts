"use client";

import { useCallback, useEffect, useState } from "react";

export type OrderEntrySizeMode = "coin" | "usd";

const PERSIST_SIZE_KEY = "blink:order-entry:persist-size";
const PERSISTED_SIZE_KEY = "blink:order-entry:size";
const PERSISTED_SIZE_MODE_KEY = "blink:order-entry:size-mode";
const SETTINGS_CHANGED_EVENT = "blink:order-entry-settings";

function emitSettingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

/** Defaults to on; users can disable in Account → Preferences. */
export function readPersistSizePreference() {
  if (typeof window === "undefined") return true;

  const stored = window.localStorage.getItem(PERSIST_SIZE_KEY);
  if (stored === null) return true;
  return stored === "1";
}

export function setPersistSizePreference(nextValue: boolean) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(PERSIST_SIZE_KEY, nextValue ? "1" : "0");
  emitSettingsChanged();
}

export function readPersistedOrderSizeDraft(): {
  size: string;
  sizeMode: OrderEntrySizeMode;
} {
  if (typeof window === "undefined") {
    return {
      size: "",
      sizeMode: "coin",
    };
  }

  const size = window.localStorage.getItem(PERSISTED_SIZE_KEY) ?? "";
  const rawSizeMode = window.localStorage.getItem(PERSISTED_SIZE_MODE_KEY);
  const sizeMode: OrderEntrySizeMode = rawSizeMode === "usd" ? "usd" : "coin";

  return { size, sizeMode };
}

export function writePersistedOrderSizeDraft(params: {
  size: string;
  sizeMode: OrderEntrySizeMode;
}) {
  if (typeof window === "undefined") return;

  if (params.size) {
    window.localStorage.setItem(PERSISTED_SIZE_KEY, params.size);
  } else {
    window.localStorage.removeItem(PERSISTED_SIZE_KEY);
  }

  window.localStorage.setItem(PERSISTED_SIZE_MODE_KEY, params.sizeMode);
  emitSettingsChanged();
}

export function usePersistSizePreference() {
  const [persistSize, setPersistSizeState] = useState(() =>
    typeof window === "undefined" ? true : readPersistSizePreference(),
  );

  useEffect(() => {
    const sync = () => {
      setPersistSizeState(readPersistSizePreference());
    };

    sync();

    window.addEventListener("storage", sync);
    window.addEventListener(SETTINGS_CHANGED_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SETTINGS_CHANGED_EVENT, sync);
    };
  }, []);

  const setPersistSize = useCallback((nextValue: boolean) => {
    setPersistSizePreference(nextValue);
    setPersistSizeState(nextValue);
  }, []);

  return {
    persistSize,
    setPersistSize,
  };
}
