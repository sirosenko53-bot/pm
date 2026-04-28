import type { ProjectType } from './workspaceTypes';

export type WorkflowStage = {
  stageId: string;
  stageName: string;
  order: number;
  keywordRules: string[];
};

export type WorkflowTemplate = {
  workflowTemplateId: string;
  projectType: ProjectType;
  displayName: string;
  defaultStageId?: string;
  stages: WorkflowStage[];
};
