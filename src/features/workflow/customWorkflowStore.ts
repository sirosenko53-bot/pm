import { getWorkflowTemplateByProjectType } from '../../config/workflowTemplates';
import type { WorkflowStage } from '../../domain/workflowTypes';
import type { Project } from '../../domain/workspaceTypes';
import { loadFromStorage, saveToStorage } from '../../storage/localStorageStore';

const STORAGE_KEY = 'seisaku-pm:custom-workflow-stages';

type CustomWorkflowMap = Record<string, string[]>;

const normalizeStageName = (value: string): string => {
  return value
    .replace(/^\s*(?:\d+|[①②③④⑤⑥⑦⑧⑨⑩])[\.\)）．、:\s]*/u, '')
    .replace(/^「(.+)」$/u, '$1')
    .trim();
};

const toStages = (projectId: string, stageNames: string[]): WorkflowStage[] =>
  stageNames
    .map(normalizeStageName)
    .filter(Boolean)
    .map((stageName, index) => ({
      stageId: `custom-${projectId}-${index + 1}`,
      stageName,
      order: index + 1,
      keywordRules: [stageName],
    }));

export const loadCustomStageNames = (projectId: string): string[] => {
  const result = loadFromStorage<CustomWorkflowMap>(STORAGE_KEY, {});
  return result.value[projectId] ?? [];
};

export const saveCustomStageNames = (projectId: string, stageNames: string[]): { warning?: string } => {
  const result = loadFromStorage<CustomWorkflowMap>(STORAGE_KEY, {});
  const nextNames = stageNames.map(normalizeStageName).filter(Boolean);
  const nextMap: CustomWorkflowMap = { ...result.value };

  if (nextNames.length === 0) {
    delete nextMap[projectId];
  } else {
    nextMap[projectId] = nextNames;
  }

  const saved = saveToStorage(STORAGE_KEY, nextMap);
  return { warning: result.warning ?? saved.warning };
};

export const resolveProjectWorkflowStages = (project: Project): WorkflowStage[] => {
  const customNames = loadCustomStageNames(project.projectId);
  if (customNames.length > 0) {
    return toStages(project.projectId, customNames);
  }

  return getWorkflowTemplateByProjectType(project.projectType)?.stages ?? [];
};

export const resolveProjectStageName = (project: Project, stageId?: string): string | undefined => {
  if (!stageId) return undefined;
  return resolveProjectWorkflowStages(project).find((stage) => stage.stageId === stageId)?.stageName;
};
