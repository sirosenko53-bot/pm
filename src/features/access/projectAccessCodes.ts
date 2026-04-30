import type { ProjectAccessCode } from './projectAccessTypes';

export const PROJECT_ACCESS_CODES: ProjectAccessCode[] = [
  {
    code: 'tokigire-poetry',
    label: '詩集制作',
    projectIds: ['poetry'],
    defaultProjectId: 'poetry',
    mode: 'project',
  },
  {
    code: 'tokigire-exhibition',
    label: '展示制作',
    projectIds: ['exhibition'],
    defaultProjectId: 'exhibition',
    mode: 'project',
  },
  {
    code: 'tokigire-audio',
    label: '音声作品',
    projectIds: ['audio'],
    defaultProjectId: 'audio',
    mode: 'project',
  },
  {
    code: 'tokigire-admin',
    label: '管理者',
    projectIds: ['poetry', 'exhibition', 'audio', 'novel'],
    mode: 'admin',
  },
  {
    code: 'tokigire',
    label: '互換用',
    projectIds: ['poetry', 'exhibition', 'audio', 'novel'],
    mode: 'admin',
  },
];

export const resolveProjectAccessCode = (code: string): ProjectAccessCode | null => {
  const normalized = code.trim().toLowerCase();
  return PROJECT_ACCESS_CODES.find((item) => item.code === normalized) ?? null;
};
