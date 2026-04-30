import { WORKFLOW_TEMPLATES } from '../../config/workflowTemplates';
import type { Task, TaskOverlay, TaskViewModel } from '../../domain/taskTypes';
import type { Workspace } from '../../domain/workspaceTypes';

const resolveStageName = (workspace: Workspace, stageId?: string) => {
  if (!stageId) return '未設定';
  for (const project of workspace.projects) {
    const template = WORKFLOW_TEMPLATES.find((item) => item.workflowTemplateId === project.workflowTemplateId);
    const stage = template?.stages.find((item) => item.stageId === stageId);
    if (stage) return stage.stageName;
  }
  return '未設定';
};

const isDelayed = (dueDate: string | undefined, status: TaskViewModel['status']) => {
  if (!dueDate || status === '完了') return false;
  return new Date(dueDate).getTime() < Date.now();
};

const toUpdatedTime = (overlay?: TaskOverlay) => {
  if (!overlay?.updatedAt) return 0;
  const time = new Date(overlay.updatedAt).getTime();
  return Number.isFinite(time) ? time : 0;
};

const getTaskDedupeKey = (task: Task) => {
  const eventId = task.googleCalendarEventId?.trim();
  if (eventId) return `event:${task.projectId}:${eventId}`;
  if (task.taskId) return `task:${task.taskId}`;
  return `fallback:${task.projectId}:${task.taskName}:${task.startDateTime}:${task.dueDate ?? ''}`;
};

const resolveOverlayForTasks = (tasks: Task[], overlayMap: Map<string, TaskOverlay>): TaskOverlay | undefined => {
  const overlays = tasks
    .map((task) => overlayMap.get(task.taskId))
    .filter((overlay): overlay is TaskOverlay => Boolean(overlay));

  if (overlays.length === 0) return undefined;

  const latestOverlay = overlays.reduce((latest, current) =>
    toUpdatedTime(current) >= toUpdatedTime(latest) ? current : latest,
  );
  const latestSortOrderOverlay = overlays
    .filter((overlay) => typeof overlay.sortOrder === 'number')
    .reduce<TaskOverlay | undefined>(
      (latest, current) => (!latest || toUpdatedTime(current) >= toUpdatedTime(latest) ? current : latest),
      undefined,
    );

  return {
    ...latestOverlay,
    sortOrder: latestSortOrderOverlay?.sortOrder ?? latestOverlay.sortOrder,
  };
};

const dedupeTasks = (tasks: Task[], overlayMap: Map<string, TaskOverlay>) => {
  const groups = new Map<string, Task[]>();

  tasks.forEach((task) => {
    const key = getTaskDedupeKey(task);
    groups.set(key, [...(groups.get(key) ?? []), task]);
  });

  return [...groups.values()].map((group) => {
    const overlay = resolveOverlayForTasks(group, overlayMap);
    const task = overlay
      ? group.find((item) => item.taskId === overlay.taskId) ?? group[0]
      : group[0];

    return { task, overlay };
  });
};

export const buildTaskViewModels = (tasks: Task[], overlays: TaskOverlay[], workspace: Workspace): TaskViewModel[] => {
  const overlayMap = new Map(overlays.map((overlay) => [overlay.taskId, overlay]));

  return dedupeTasks(tasks, overlayMap).map(({ task, overlay }) => {
    const stageId = overlay?.stageOverride ?? task.stageId;
    const status = overlay?.status ?? '未着手';

    return {
      ...task,
      stageId,
      stageName: resolveStageName(workspace, stageId),
      status,
      priority: overlay?.priority,
      reviewer: overlay?.reviewer,
      memo: overlay?.memo,
      sortOrder: overlay?.sortOrder,
      isDelayed: isDelayed(task.dueDate, status),
      isUnclassifiedProject: task.projectId === 'unclassified',
      overlayUpdatedAt: overlay?.updatedAt,
    };
  });
};
