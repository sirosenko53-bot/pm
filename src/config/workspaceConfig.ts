import type { Workspace } from '../domain/workspaceTypes';

export const WORKSPACE: Workspace = {
  workspaceId: 'ws-tokigire',
  workspaceCode: 'tokigire',
  workspaceName: '途切れ制作管理',
  projects: [
    {
      projectId: 'project-poetry',
      projectName: '詩集制作',
      projectType: 'poetry',
      calendarId: 'cal-poetry@example.com',
      workflowTemplateId: 'workflow-poetry',
      currentStageId: 'poetry-creation',
      milestones: ['本文確定'],
      isActive: true,
    },
    {
      projectId: 'project-exhibition',
      projectName: '展示制作',
      projectType: 'exhibition',
      calendarId: 'cal-exhibition@example.com',
      workflowTemplateId: 'workflow-exhibition',
      currentStageId: 'exhibition-impl',
      milestones: ['公開準備'],
      isActive: true,
    },
    {
      projectId: 'project-audio',
      projectName: '音声作品',
      projectType: 'audio',
      calendarId: 'cal-audio@example.com',
      workflowTemplateId: 'workflow-audio',
      currentStageId: 'audio-recording',
      milestones: ['収録完了'],
      isActive: true,
    },
    {
      projectId: 'project-novel',
      projectName: '小説執筆',
      projectType: 'novel',
      calendarId: 'cal-novel@example.com',
      workflowTemplateId: 'workflow-novel',
      currentStageId: 'novel-body',
      milestones: ['本文初稿'],
      isActive: true,
    },
  ],
  members: [
    { memberId: 'member-sato', displayName: '佐藤', color: '#2563eb' },
    { memberId: 'member-c', displayName: 'C', color: '#0ea5e9' },
    { memberId: 'member-d', displayName: 'D', color: '#22c55e' },
    { memberId: 'member-e', displayName: 'E', color: '#a855f7' },
  ],
  calendarSources: [
    {
      calendarSourceId: 'source-poetry',
      calendarId: 'cal-poetry@example.com',
      projectId: 'project-poetry',
      displayName: '詩集制作カレンダー',
      color: '#3b82f6',
      readOnly: true,
    },
    {
      calendarSourceId: 'source-exhibition',
      calendarId: 'cal-exhibition@example.com',
      projectId: 'project-exhibition',
      displayName: '展示制作カレンダー',
      color: '#14b8a6',
      readOnly: true,
    },
    {
      calendarSourceId: 'source-audio',
      calendarId: 'cal-audio@example.com',
      projectId: 'project-audio',
      displayName: '音声作品カレンダー',
      color: '#f97316',
      readOnly: true,
    },
    {
      calendarSourceId: 'source-novel',
      calendarId: 'cal-novel@example.com',
      projectId: 'project-novel',
      displayName: '小説執筆カレンダー',
      color: '#a855f7',
      readOnly: true,
    },
  ],
};

export const findWorkspaceByCode = (workspaceCode: string) =>
  workspaceCode.trim() === WORKSPACE.workspaceCode ? WORKSPACE : null;
