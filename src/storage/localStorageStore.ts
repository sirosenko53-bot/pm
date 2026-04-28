export const loadFromStorage = <T>(key: string, fallback: T): { value: T; warning?: string } => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { value: fallback };
    return { value: JSON.parse(raw) as T };
  } catch {
    return { value: fallback, warning: 'ローカル保存の読み込みに失敗しました。' };
  }
};

export const saveToStorage = <T>(key: string, value: T): { ok: boolean; warning?: string } => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch {
    return { ok: false, warning: 'ローカル保存に失敗しました。' };
  }
};
