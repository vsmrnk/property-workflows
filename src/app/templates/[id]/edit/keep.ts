"use client";

import { createContext, useContext } from "react";

/**
 * Запис робочої копії через редактор: успіх — «All changes kept», помилка — «Your last change was not kept. Try
 * again.» в одному місці редактора (AC-EDITOR-25, impl-template-versions-2 U4). Помилку прокидає далі, щоб поле чи
 * форма не втратили введене.
 */
export type Keep = (write: () => Promise<void>) => Promise<void>;

export const KeepContext = createContext<Keep>((write) => write());

export const useKeep = () => useContext(KeepContext);
