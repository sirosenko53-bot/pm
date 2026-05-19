import { getWorkflowTemplateByProjectType } from '../../config/workflowTemplates';
import type { WorkflowStage } from '../../domain/workflowTypes';
import type { Project } from '../../domain/workspaceTypes';
import { loadFromStorage, saveToStorage } from '../../storage/localStorageStore';

const STORAGE_KEY = 'seisaku-pm:custom-workflow-stages';
const DETAIL_STORAGE_KEY = 'seisaku-pm:custom-workflow-stage-details';

export type CustomWorkflowMap = Record<string, string[]>;
export type CustomWorkflowStageDetail = {
  objective?: string;
  doneConditions?: string[];
};
export type CustomWorkflowStageDetailMap = Record<string, Record<string, CustomWorkflowStageDetail>>;

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

const normalizeStageDetail = (detail: unknown): CustomWorkflowStageDetail => {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return {};

  const rawDetail = detail as Record<string, unknown>;
  const objective = typeof rawDetail.objective === 'string' ? rawDetail.objective.trim() : undefined;
  const doneConditions = Array.isArray(rawDetail.doneConditions)
    ? rawDetail.doneConditions
        .filter((condition): condition is string => typeof condition === 'string')
        .map((condition) => condition.trim())
        .filter(Boolean)
    : [];

  return {
    objective: objective || undefined,
    doneConditions,
  };
};

const normalizeStageNameMap = (value: unknown): CustomWorkflowMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value).reduce<CustomWorkflowMap>((map, [projectId, stageNames]) => {
    if (!Array.isArray(stageNames)) return map;

    const nextNames = stageNames
      .filter((stageName): stageName is string => typeof stageName === 'string')
      .map(normalizeStageName)
      .filter(Boolean);

    if (nextNames.length > 0) {
      map[projectId] = nextNames;
    }

    return map;
  }, {});
};

const normalizeStageDetailMap = (value: unknown): CustomWorkflowStageDetailMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.entries(value).reduce<CustomWorkflowStageDetailMap>((map, [projectId, stageDetails]) => {
    if (!stageDetails || typeof stageDetails !== 'object' || Array.isArray(stageDetails)) return map;

    const nextProjectDetails = Object.entries(stageDetails).reduce<Record<string, CustomWorkflowStageDetail>>(
      (details, [stageId, detail]) => {
        if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return details;

        const nextDetail = normalizeStageDetail(detail);
        if (nextDetail.objective || (nextDetail.doneConditions ?? []).length > 0) {
          details[stageId] = nextDetail;
        }

        return details;
      },
      {},
    );

    if (Object.keys(nextProjectDetails).length > 0) {
      map[projectId] = nextProjectDetails;
    }

    return map;
  }, {});
};

export const loadCustomWorkflowStageNames = (): CustomWorkflowMap => {
  const result = loadFromStorage<CustomWorkflowMap>(STORAGE_KEY, {});
  return normalizeStageNameMap(result.value);
};

export const loadCustomWorkflowStageDetails = (): CustomWorkflowStageDetailMap => {
  const result = loadFromStorage<CustomWorkflowStageDetailMap>(DETAIL_STORAGE_KEY, {});
  return normalizeStageDetailMap(result.value);
};

export const restoreCustomWorkflowSettings = (
  stageNames: unknown,
  stageDetails: unknown,
): { warning?: string } => {
  const nameResult = saveToStorage(STORAGE_KEY, normalizeStageNameMap(stageNames));
  const detailResult = saveToStorage(DETAIL_STORAGE_KEY, normalizeStageDetailMap(stageDetails));

  return { warning: nameResult.warning ?? detailResult.warning };
};

const applyStageDetails = (projectId: string, stages: WorkflowStage[]): WorkflowStage[] => {
  const projectDetails = loadCustomWorkflowStageDetails()[projectId] ?? {};

  return stages.map((stage) => ({
    ...stage,
    ...normalizeStageDetail(projectDetails[stage.stageId]),
  }));
};

export const loadCustomStageNames = (projectId: string): string[] => {
  return loadCustomWorkflowStageNames()[projectId] ?? [];
};

export const saveCustomStageNames = (projectId: string, stageNames: string[]): { warning?: string } => {
  const result = loadFromStorage<CustomWorkflowMap>(STORAGE_KEY, {});
  const nextNames = stageNames.map(normalizeStageName).filter(Boolean);
  const nextMap: CustomWorkflowMap = { ...normalizeStageNameMap(result.value) };

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
    return applyStageDetails(project.projectId, toStages(project.projectId, customNames));
  }

  return applyStageDetails(project.projectId, getWorkflowTemplateByProjectType(project.projectType)?.stages ?? []);
};

export const saveCustomStageDetail = (
  projectId: string,
  stageId: string,
  detail: CustomWorkflowStageDetail,
): { warning?: string } => {
  const result = loadFromStorage<CustomWorkflowStageDetailMap>(DETAIL_STORAGE_KEY, {});
  const nextMap: CustomWorkflowStageDetailMap = { ...result.value };
  const nextProjectDetails = { ...(nextMap[projectId] ?? {}) };
  const nextDetail = normalizeStageDetail(detail);

  if (!nextDetail.objective && (nextDetail.doneConditions ?? []).length === 0) {
    delete nextProjectDetails[stageId];
  } else {
    nextProjectDetails[stageId] = nextDetail;
  }

  if (Object.keys(nextProjectDetails).length === 0) {
    delete nextMap[projectId];
  } else {
    nextMap[projectId] = nextProjectDetails;
  }

  const saved = saveToStorage(DETAIL_STORAGE_KEY, nextMap);
  return { warning: result.warning ?? saved.warning };
};

export const resolveProjectStageName = (project: Project, stageId?: string): string | undefined => {
  if (!stageId) return undefined;
  return resolveProjectWorkflowStages(project).find((stage) => stage.stageId === stageId)?.stageName;
};
