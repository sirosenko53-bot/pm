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

export const buildTaskViewModels = (tasks: Task[], overlays: TaskOverlay[], workspace: Workspace): TaskViewModel[] => {
  const overlayMap = new Map(overlays.map((overlay) => [overlay.taskId, overlay]));

  return tasks.map((task) => {
    const overlay = overlayMap.get(task.taskId);
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
