import type { Member } from '../../domain/workspaceTypes';
import { loadFromStorage, saveToStorage } from '../../storage/localStorageStore';

const CUSTOM_MEMBERS_STORAGE_KEY = 'seisaku-pm:custom-members';
const HIDDEN_MEMBER_IDS_STORAGE_KEY = 'seisaku-pm:hidden-member-ids';
const DELETED_MEMBER_IDS_STORAGE_KEY = 'seisaku-pm:deleted-member-ids';
const MEMBER_COLORS = ['#2563eb', '#0ea5e9', '#22c55e', '#a855f7', '#f97316', '#e11d48'];

export type MemberChangeResult = {
  ok: boolean;
  members: Member[];
  hiddenMemberIds: string[];
  deletedMemberIds: string[];
  message: string;
  warning?: string;
};

export type AddMemberResult = MemberChangeResult;

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

const uniqueStringList = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    if (typeof value !== 'string') return false;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const saveCustomMembers = (members: Member[]) => saveToStorage(CUSTOM_MEMBERS_STORAGE_KEY, members);
const saveHiddenMemberIds = (memberIds: string[]) => saveToStorage(HIDDEN_MEMBER_IDS_STORAGE_KEY, memberIds);
const saveDeletedMemberIds = (memberIds: string[]) => saveToStorage(DELETED_MEMBER_IDS_STORAGE_KEY, memberIds);

export const loadCustomMembers = (): Member[] => {
  const result = loadFromStorage<Member[]>(CUSTOM_MEMBERS_STORAGE_KEY, []);
  if (!Array.isArray(result.value)) return [];
  return result.value.filter(isValidMember);
};

export const loadHiddenMemberIds = (): string[] => {
  const result = loadFromStorage<string[]>(HIDDEN_MEMBER_IDS_STORAGE_KEY, []);
  return uniqueStringList(result.value);
};

export const loadDeletedMemberIds = (): string[] => {
  const result = loadFromStorage<string[]>(DELETED_MEMBER_IDS_STORAGE_KEY, []);
  return uniqueStringList(result.value);
};

export const mergeMembers = (
  baseMembers: Member[],
  customMembers: Member[],
  hiddenMemberIds: string[] = [],
  deletedMemberIds: string[] = [],
): Member[] => {
  const hiddenIds = new Set(hiddenMemberIds);
  const deletedIds = new Set(deletedMemberIds);
  const seenNames = new Set<string>();

  return [...baseMembers, ...customMembers].filter((member) => {
    if (hiddenIds.has(member.memberId) || deletedIds.has(member.memberId)) return false;
    const name = normalizeMemberName(member.displayName);
    if (!name || seenNames.has(name)) return false;
    seenNames.add(name);
    return true;
  });
};

export const addCustomMember = (
  baseMembers: Member[],
  currentCustomMembers: Member[],
  displayName: string,
  currentHiddenMemberIds: string[] = [],
  currentDeletedMemberIds: string[] = [],
): AddMemberResult => {
  const name = normalizeMemberName(displayName);
  if (!name) {
    return {
      ok: false,
      members: currentCustomMembers,
      hiddenMemberIds: currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: '担当者名を入力してください。',
    };
  }

  const hiddenIds = new Set(currentHiddenMemberIds);
  const deletedIds = new Set(currentDeletedMemberIds);
  const hiddenBaseMember = baseMembers.find((member) =>
    hiddenIds.has(member.memberId)
    && !deletedIds.has(member.memberId)
    && normalizeMemberName(member.displayName) === name,
  );

  if (hiddenBaseMember) {
    const nextHiddenMemberIds = currentHiddenMemberIds.filter((memberId) => memberId !== hiddenBaseMember.memberId);
    const saveResult = saveHiddenMemberIds(nextHiddenMemberIds);
    return {
      ok: saveResult.ok,
      members: currentCustomMembers,
      hiddenMemberIds: saveResult.ok ? nextHiddenMemberIds : currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: saveResult.ok
        ? `${name}を担当者候補に戻しました。`
        : saveResult.warning ?? '担当者候補の保存に失敗しました。',
      warning: saveResult.warning,
    };
  }

  const existingMembers = mergeMembers(
    baseMembers,
    currentCustomMembers,
    currentHiddenMemberIds,
    currentDeletedMemberIds,
  );
  if (existingMembers.some((member) => normalizeMemberName(member.displayName) === name)) {
    return {
      ok: false,
      members: currentCustomMembers,
      hiddenMemberIds: currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: 'この担当者はすでに候補にあります。',
    };
  }

  const nextMember: Member = {
    memberId: `custom-member-${Date.now().toString(36)}`,
    displayName: name,
    color: MEMBER_COLORS[currentCustomMembers.length % MEMBER_COLORS.length],
  };
  const nextMembers = [...currentCustomMembers, nextMember];
  const saveResult = saveCustomMembers(nextMembers);

  if (!saveResult.ok) {
    return {
      ok: false,
      members: currentCustomMembers,
      hiddenMemberIds: currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: saveResult.warning ?? '担当者候補の保存に失敗しました。',
      warning: saveResult.warning,
    };
  }

  return {
    ok: true,
    members: nextMembers,
    hiddenMemberIds: currentHiddenMemberIds,
    deletedMemberIds: currentDeletedMemberIds,
    message: `${name}を担当者候補に追加しました。`,
  };
};

export const removeMemberCandidate = (
  baseMembers: Member[],
  currentCustomMembers: Member[],
  currentHiddenMemberIds: string[],
  currentDeletedMemberIds: string[],
  memberId: string,
): MemberChangeResult => {
  const customMember = currentCustomMembers.find((member) => member.memberId === memberId);
  if (customMember) {
    const nextMembers = currentCustomMembers.filter((member) => member.memberId !== memberId);
    const saveResult = saveCustomMembers(nextMembers);
    return {
      ok: saveResult.ok,
      members: saveResult.ok ? nextMembers : currentCustomMembers,
      hiddenMemberIds: currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: saveResult.ok
        ? `${customMember.displayName}を担当者候補から外しました。既存タスクの担当者名は残ります。`
        : saveResult.warning ?? '担当者候補の保存に失敗しました。',
      warning: saveResult.warning,
    };
  }

  const baseMember = baseMembers.find((member) => member.memberId === memberId);
  if (!baseMember) {
    return {
      ok: false,
      members: currentCustomMembers,
      hiddenMemberIds: currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: '対象の担当者候補が見つかりませんでした。',
    };
  }

  if (currentHiddenMemberIds.includes(memberId)) {
    return {
      ok: true,
      members: currentCustomMembers,
      hiddenMemberIds: currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: `${baseMember.displayName}はすでに候補から外れています。`,
    };
  }

  const nextHiddenMemberIds = [...currentHiddenMemberIds, memberId];
  const saveResult = saveHiddenMemberIds(nextHiddenMemberIds);
  return {
    ok: saveResult.ok,
    members: currentCustomMembers,
    hiddenMemberIds: saveResult.ok ? nextHiddenMemberIds : currentHiddenMemberIds,
    deletedMemberIds: currentDeletedMemberIds,
    message: saveResult.ok
      ? `${baseMember.displayName}を担当者候補から外しました。既存タスクの担当者名は残ります。`
      : saveResult.warning ?? '担当者候補の保存に失敗しました。',
    warning: saveResult.warning,
  };
};

export const deleteMemberCandidate = (
  baseMembers: Member[],
  currentCustomMembers: Member[],
  currentHiddenMemberIds: string[],
  currentDeletedMemberIds: string[],
  memberId: string,
): MemberChangeResult => {
  const customMember = currentCustomMembers.find((member) => member.memberId === memberId);
  if (customMember) {
    const nextMembers = currentCustomMembers.filter((member) => member.memberId !== memberId);
    const saveResult = saveCustomMembers(nextMembers);
    return {
      ok: saveResult.ok,
      members: saveResult.ok ? nextMembers : currentCustomMembers,
      hiddenMemberIds: currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: saveResult.ok
        ? `${customMember.displayName}を担当者候補から削除しました。既存タスクの担当者名は残ります。`
        : saveResult.warning ?? '担当者候補の削除に失敗しました。',
      warning: saveResult.warning,
    };
  }

  const baseMember = baseMembers.find((member) => member.memberId === memberId);
  if (!baseMember) {
    return {
      ok: false,
      members: currentCustomMembers,
      hiddenMemberIds: currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: '削除する担当者候補が見つかりませんでした。',
    };
  }

  const nextHiddenMemberIds = currentHiddenMemberIds.filter((hiddenMemberId) => hiddenMemberId !== memberId);
  const nextDeletedMemberIds = currentDeletedMemberIds.includes(memberId)
    ? currentDeletedMemberIds
    : [...currentDeletedMemberIds, memberId];
  const hiddenSaveResult = saveHiddenMemberIds(nextHiddenMemberIds);
  const deletedSaveResult = saveDeletedMemberIds(nextDeletedMemberIds);
  const warning = hiddenSaveResult.warning ?? deletedSaveResult.warning;
  const ok = hiddenSaveResult.ok && deletedSaveResult.ok;

  return {
    ok,
    members: currentCustomMembers,
    hiddenMemberIds: ok ? nextHiddenMemberIds : currentHiddenMemberIds,
    deletedMemberIds: ok ? nextDeletedMemberIds : currentDeletedMemberIds,
    message: ok
      ? `${baseMember.displayName}を担当者候補から削除しました。既存タスクの担当者名は残ります。`
      : warning ?? '担当者候補の削除に失敗しました。',
    warning,
  };
};

export const restoreMemberCandidate = (
  baseMembers: Member[],
  currentCustomMembers: Member[],
  currentHiddenMemberIds: string[],
  currentDeletedMemberIds: string[],
  memberId: string,
): MemberChangeResult => {
  const member = baseMembers.find((item) => item.memberId === memberId);
  if (!member) {
    return {
      ok: false,
      members: currentCustomMembers,
      hiddenMemberIds: currentHiddenMemberIds,
      deletedMemberIds: currentDeletedMemberIds,
      message: '戻す担当者候補が見つかりませんでした。',
    };
  }

  const nextHiddenMemberIds = currentHiddenMemberIds.filter((hiddenMemberId) => hiddenMemberId !== memberId);
  const saveResult = saveHiddenMemberIds(nextHiddenMemberIds);
  return {
    ok: saveResult.ok,
    members: currentCustomMembers,
    hiddenMemberIds: saveResult.ok ? nextHiddenMemberIds : currentHiddenMemberIds,
    deletedMemberIds: currentDeletedMemberIds,
    message: saveResult.ok
      ? `${member.displayName}を担当者候補に戻しました。`
      : saveResult.warning ?? '担当者候補の保存に失敗しました。',
    warning: saveResult.warning,
  };
};
