// Small data hooks shared by the popup screens. Reading only; writes go through PopupMessages.

import { useEffect, useState } from 'react';
import { storage } from 'wxt/utils/storage';
import { STORAGE_KEYS } from '@/src/contracts';
import type { BarryState, PopupMessage } from '@/src/contracts';
import { withStateDefaults } from '@/src/popup/view';

export type Send = (msg: PopupMessage) => void;

export const send: Send = (msg) => {
  browser.runtime.sendMessage(msg).catch(() => {});
};

export function useStored<T>(key: `local:${string}`, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let alive = true;
    storage.getItem<T>(key).then((v) => alive && v != null && setValue(v));
    const unwatch = storage.watch<T>(key, (v) => setValue(v ?? fallback));
    return () => {
      alive = false;
      unwatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
}

export function useBarryState() {
  const [state, setState] = useState<BarryState | null>(null);
  useEffect(() => {
    let alive = true;
    storage
      .getItem<BarryState>(STORAGE_KEYS.state)
      .then((s) => alive && setState(withStateDefaults(s)));
    const unwatch = storage.watch<BarryState>(STORAGE_KEYS.state, (s) =>
      setState(withStateDefaults(s)),
    );
    return () => {
      alive = false;
      unwatch();
    };
  }, []);
  return state;
}

export function useActiveTabId() {
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((t) => setId(t[0]?.id ?? null))
      .catch(() => {});
  }, []);
  return id;
}

export function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
