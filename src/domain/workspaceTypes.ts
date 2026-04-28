export type ProjectType = 'poetry' | 'exhibition' | 'audio' | 'novel';

export type Project = {
  projectId: string;
  projectName: string;
  projectType: ProjectType;
  calendarId: string;
  workflowTemplateId: string;
  currentStageId?: string;
  milestones: string[];
  isActive: boolean;
};

export type CalendarSource = {
  calendarSourceId: string;
  calendarId: string;
  projectId: string;
  displayName: string;
  color: string;
  readOnly: boolean;
};

export type Member = {
  memberId: string;
  displayName: string;
  color: string;
};

export type Workspace = {
  workspaceId: string;
  workspaceCode: string;
  workspaceName: string;
  projects: Project[];
  members: Member[];
  calendarSources: CalendarSource[];
};
