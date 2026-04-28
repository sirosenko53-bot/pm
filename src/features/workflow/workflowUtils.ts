import { getWorkflowTemplateByProjectType } from '../../config/workflowTemplates';
import type { TaskViewModel } from '../../domain/taskTypes';
import type { WorkflowStage, WorkflowTemplate } from '../../domain/workflowTypes';
import type { Project } from '../../domain/workspaceTypes';

export const getWorkflowTemplateForProject = (project: Project): WorkflowTemplate | undefined =>
  getWorkflowTemplateByProjectType(project.projectType);

export const getCurrentStage = (project: Project, tasks: TaskViewModel[], template?: WorkflowTemplate): WorkflowStage | undefined => {
  if (!template) return undefined;
  const byProject = project.currentStageId
    ? template.stages.find((stage) => stage.stageId === project.currentStageId)
    : undefined;
  if (byProject) return byProject;

  const firstInProgress = template.stages.find((stage) =>
    tasks.some((task) => (task.stageId === stage.stageId || task.stageName === stage.stageName) && task.status !== '完了'),
  );

  return firstInProgress ?? template.stages[0];
};

export const getStageTasks = (stage: WorkflowStage, tasks: TaskViewModel[]) =>
  tasks.filter((task) => task.stageId === stage.stageId || task.stageName === stage.stageName);

export const calculateStageSummary = (stageTasks: TaskViewModel[]) => {
  const done = stageTasks.filter((task) => task.status === '完了').length;
  const delayed = stageTasks.filter((task) => task.isDelayed).length;
  return {
    total: stageTasks.length,
    done,
    todo: Math.max(0, stageTasks.length - done),
    delayed,
  };
};

export const calculateStageProgress = (stageTasks: TaskViewModel[]) => {
  if (stageTasks.length === 0) return 0;
  const done = stageTasks.filter((task) => task.status === '完了').length;
  return Math.round((done / stageTasks.length) * 100);
};

export const sortStages = (stages: WorkflowStage[]) => [...stages].sort((a, b) => a.order - b.order);

export const sortStageTasks = (tasks: TaskViewModel[]) =>
  [...tasks].sort((a, b) => {
    const startA = a.startDateTime ? new Date(a.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
    const startB = b.startDateTime ? new Date(b.startDateTime).getTime() : Number.MAX_SAFE_INTEGER;
    if (startA !== startB) return startA - startB;
    return a.taskName.localeCompare(b.taskName, 'ja');
  });
