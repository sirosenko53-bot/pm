import type { TaskOverlay, TaskStatus } from '../../domain/taskTypes';
import { loadFromStorage, saveToStorage } from '../../storage/localStorageStore';

const STORAGE_KEY = 'seisaku-pm:task-overlays';

type OverlayMap = Record<string, TaskOverlay>;

const getMap = (): OverlayMap => loadFromStorage<OverlayMap>(STORAGE_KEY, {}).value;

const saveMap = (overlayMap: OverlayMap) => saveToStorage(STORAGE_KEY, overlayMap);

export const getAllTaskOverlays = (): TaskOverlay[] => Object.values(getMap());

export const replaceAllTaskOverlays = (overlays: TaskOverlay[]): { warning?: string } => {
  const nextMap: OverlayMap = {};
  overlays.forEach((overlay) => {
    nextMap[overlay.taskId] = overlay;
  });
  const result = saveMap(nextMap);
  return { warning: result.warning };
};

export const clearTaskOverlays = (): { warning?: string } => {
  const result = saveMap({});
  return { warning: result.warning };
};

export const getTaskOverlay = (taskId: string): TaskOverlay | null => getMap()[taskId] ?? null;

export const saveTaskOverlay = (overlay: TaskOverlay): { warning?: string } => {
  const overlayMap = getMap();
  overlayMap[overlay.taskId] = { ...overlay, updatedAt: new Date().toISOString() };
  const result = saveMap(overlayMap);
  return { warning: result.warning };
};

export const updateTaskOverlay = (taskId: string, patch: Partial<TaskOverlay>): { warning?: string } => {
  const overlayMap = getMap();
  const current = overlayMap[taskId];
  if (!current) return {};
  overlayMap[taskId] = { ...current, ...patch, updatedAt: new Date().toISOString() };
  const result = saveMap(overlayMap);
  return { warning: result.warning };
};

export const upsertTaskOverlayStatus = (
  taskId: string,
  googleCalendarEventId: string,
  status: TaskStatus,
): { warning?: string } => {
  const existing = getTaskOverlay(taskId);
  if (existing) {
    return updateTaskOverlay(taskId, { status });
  }

  return saveTaskOverlay({
    taskId,
    googleCalendarEventId,
    status,
    updatedAt: new Date().toISOString(),
  });
};

export const updateTaskOverlaySortOrders = (
  updates: Array<{ taskId: string; googleCalendarEventId: string; status: TaskStatus; sortOrder: number }>,
): { warning?: string } => {
  const overlayMap = getMap();
  const timestamp = new Date().toISOString();

  updates.forEach(({ taskId, googleCalendarEventId, status, sortOrder }) => {
    const current = overlayMap[taskId];
    overlayMap[taskId] = {
      ...(current ?? {
        taskId,
        googleCalendarEventId,
        status,
      }),
      status,
      sortOrder,
      updatedAt: timestamp,
    };
  });

  const result = saveMap(overlayMap);
  return { warning: result.warning };
};

export const deleteTaskOverlay = (taskId: string): { warning?: string } => {
  const overlayMap = getMap();
  delete overlayMap[taskId];
  const result = saveMap(overlayMap);
  return { warning: result.warning };
};
