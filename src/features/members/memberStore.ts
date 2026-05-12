import type { Member } from '../../domain/workspaceTypes';
import { loadFromStorage, saveToStorage } from '../../storage/localStorageStore';

const STORAGE_KEY = 'seisaku-pm:custom-members';
const MEMBER_COLORS = ['#2563eb', '#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#e11d48'];

export type AddMemberResult = {
  ok: boolean;
  members: Member[];
  message: string;
  warning?: string;
};

const normalizeMemberName = (value: string) => value.trim().replace(/\s+/g, ' ');

const isValidMember = (value: unknown): value is Member => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Member>;
  return (
    typeof candidate.memberId === 'string'
    && typeof candidate.displayName === 'string'
    && typeof candidate.color === 'string'
  );
};

export const loadCustomMembers = (): Member[] => {
  const result = loadFromStorage<Member[]>(STORAGE_KEY, []);
  if (!Array.isArray(result.value)) return [];
  return result.value.filter(isValidMember);
};

export const mergeMembers = (baseMembers: Member[], customMembers: Member[]): Member[] => {
  const seen = new Set<string>();
  return [...baseMembers, ...customMembers].filter((member) => {
    const name = normalizeMemberName(member.displayName);
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
};

export const addCustomMember = (
  baseMembers: Member[],
  currentCustomMembers: Member[],
  displayName: string,
): AddMemberResult => {
  const name = normalizeMemberName(displayName);
  if (!name) {
    return {
      ok: false,
      members: currentCustomMembers,
      message: '担当者名を入力してください。',
    };
  }

  const existingMembers = mergeMembers(baseMembers, currentCustomMembers);
  if (existingMembers.some((member) => normalizeMemberName(member.displayName) === name)) {
    return {
      ok: false,
      members: currentCustomMembers,
      message: 'この担当者はすでに候補にあります。',
    };
  }

  const nextMember: Member = {
    memberId: `custom-member-${Date.now().toString(36)}`,
    displayName: name,
    color: MEMBER_COLORS[currentCustomMembers.length % MEMBER_COLORS.length],
  };
  const nextMembers = [...currentCustomMembers, nextMember];
  const saveResult = saveToStorage(STORAGE_KEY, nextMembers);

  if (!saveResult.ok) {
    return {
      ok: false,
      members: currentCustomMembers,
      message: saveResult.warning ?? '担当者候補の保存に失敗しました。',
      warning: saveResult.warning,
    };
  }

  return {
    ok: true,
    members: nextMembers,
    message: `${name}を担当者候補に追加しました。`,
  };
};
