import type { WorkflowTemplate } from '../domain/workflowTypes';
import type { ProjectType } from '../domain/workspaceTypes';

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    workflowTemplateId: 'workflow-poetry',
    projectType: 'poetry',
    displayName: '詩集制作',
    defaultStageId: 'poetry-creation',
    stages: [
      { stageId: 'poetry-creation', stageName: '個別詩制作', order: 1, keywordRules: ['本文', '第'] },
      { stageId: 'poetry-revise', stageName: '個別詩修正', order: 2, keywordRules: ['修正', '改稿'] },
      { stageId: 'poetry-series', stageName: '連作構成', order: 3, keywordRules: ['連作', '並び替え'] },
      { stageId: 'poetry-layout', stageName: '本文レイアウト', order: 4, keywordRules: ['レイアウト', 'PDF', 'ノンブル'] },
    ],
  },
  {
    workflowTemplateId: 'workflow-exhibition',
    projectType: 'exhibition',
    displayName: '展示制作',
    defaultStageId: 'exhibition-concept',
    stages: [
      { stageId: 'exhibition-concept', stageName: 'コンセプト', order: 1, keywordRules: ['コンセプト'] },
      { stageId: 'exhibition-flow', stageName: '導線設計', order: 2, keywordRules: ['導線', 'ルート', '回遊'] },
      { stageId: 'exhibition-room', stageName: '部屋役割', order: 3, keywordRules: ['部屋', 'プロローグ'] },
      { stageId: 'exhibition-impl', stageName: '実装', order: 4, keywordRules: ['実装', 'Unity', '配置'] },
    ],
  },
  {
    workflowTemplateId: 'workflow-audio',
    projectType: 'audio',
    displayName: '音声作品',
    defaultStageId: 'audio-theory',
    stages: [
      { stageId: 'audio-theory', stageName: '作品理論', order: 1, keywordRules: ['理論'] },
      { stageId: 'audio-characters', stageName: '登場人物との関係', order: 2, keywordRules: ['登場人物', '関係'] },
      { stageId: 'audio-track', stageName: 'トラック構成', order: 3, keywordRules: ['トラック'] },
      { stageId: 'audio-recording', stageName: '収録', order: 4, keywordRules: ['収録'] },
      { stageId: 'audio-edit', stageName: '編集', order: 5, keywordRules: ['編集'] },
    ],
  },
  {
    workflowTemplateId: 'workflow-novel',
    projectType: 'novel',
    displayName: '小説執筆',
    defaultStageId: 'novel-planning',
    stages: [
      { stageId: 'novel-planning', stageName: '企画', order: 1, keywordRules: ['企画'] },
      { stageId: 'novel-structure', stageName: '構成', order: 2, keywordRules: ['構成'] },
      { stageId: 'novel-chapter', stageName: '章立て', order: 3, keywordRules: ['章立て'] },
      { stageId: 'novel-body', stageName: '本文', order: 4, keywordRules: ['本文'] },
      { stageId: 'novel-polish', stageName: '推敲', order: 5, keywordRules: ['推敲'] },
    ],
  },
];

export const getWorkflowTemplateByProjectType = (projectType: ProjectType) =>
  WORKFLOW_TEMPLATES.find((template) => template.projectType === projectType);

export const estimateStageId = (projectType: ProjectType, taskName: string): string | undefined => {
  const template = getWorkflowTemplateByProjectType(projectType);
  if (!template) return undefined;
  const normalized = taskName.toLowerCase();
  const stage = template.stages.find((item) =>
    item.keywordRules.some((keyword) => normalized.includes(keyword.toLowerCase())),
  );
  return stage?.stageId ?? template.defaultStageId;
};
