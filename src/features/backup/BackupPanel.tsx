import { useEffect, useMemo, useState } from 'react';
import type { SettingsSection } from '../../app/routes';
import { WORKFLOW_TEMPLATES } from '../../config/workflowTemplates';
import type { Member, Workspace } from '../../domain/workspaceTypes';
import type {
  CalendarConnectionDiagnostic,
  CalendarImportSummary,
} from '../calendar/calendarDiagnostics';
import {
  loadCalendarSourceSettings,
  saveCalendarSourceSettings,
  type CalendarSourceSettings,
} from '../calendar/calendarSourceSettings';
import { fetchDriveJsonFile, updateDriveJsonFile } from '../sharedState/googleDriveSharedStateClient';
import { getDriveReadAccessToken, getDriveWriteAccessToken } from '../sharedState/googleDriveAuth';
import {
  clearSharedDriveFileSettings,
  markSharedStateReadFailed,
  markSharedStateSaveFailed,
  markSharedStateConflict,
  markSharedStateSaved,
  saveSharedDriveFileSettings,
  setAutoReadSharedStateOnEnter,
  setSharedStateSyncStatus,
} from '../sharedState/sharedStateStore';
import {
  backupCurrentLocalStateBeforeSharedSave,
  createSharedStatePackage,
  parseSharedStateJson,
  validateSharedStatePackage,
} from '../sharedState/sharedStatePackageService';
import type { SharedStateMetadata } from '../sharedState/sharedStateTypes';
import { getAllTaskOverlays } from '../tasks/taskOverlayStore';
import { readSharedStateFromDrive } from '../sharedState/sharedStateReadService';
import type { AddMemberResult, MemberChangeResult } from '../members/memberStore';
import { AppSidebar } from '../navigation/AppSidebar';
import { loadCustomWorkflowStageDetails, loadCustomWorkflowStageNames } from '../workflow/customWorkflowStore';
import {
  createBackupPackage,
  exportBackupToFile,
  loadLastBackupAt,
  loadViewPreference,
  parseBackupJson,
  restoreBackupPackage,
  saveLastBackupAt,
  validateBackupPackage,
} from './backupService';
import type { BackupPackage } from './backupTypes';

type Props = {
  workspace: Workspace;
  appVersion: string;
  lastSyncedAt: string | null;
  calendarStatus: string;
  calendarError?: string;
  calendarDiagnostics: CalendarConnectionDiagnostic;
  calendarImportSummary?: CalendarImportSummary;
  calendarAuthStatus?: string;
  isConnectingGoogle?: boolean;
  isReloadingCalendar?: boolean;
  storageWarning?: string;
  sharedStateMetadata: SharedStateMetadata;
  onBackHome: () => void;
  onBackProject?: () => void;
  onConnectGoogleCalendar: () => void;
  onReloadCalendar: () => void;
  hiddenMembers: Member[];
  onAddMember: (displayName: string) => AddMemberResult;
  onRemoveMember: (memberId: string) => MemberChangeResult;
  onDeleteMember: (memberId: string) => MemberChangeResult;
  onRestoreMember: (memberId: string) => MemberChangeResult;
  onRestored: (message: string, warning?: string) => void;
  onSharedStateMetadataUpdated: (metadata: SharedStateMetadata, warning?: string) => void;
  onSharedStateApplied: (message: string, warning?: string) => void;
  onCalendarSourceSettingsUpdated: () => void;
  onOpenCalendarSettings?: () => void;
  onOpenBackupSettings?: () => void;
  onOpenSharedSettings?: () => void;
  initialSection?: SettingsSection;
};

const formatDateTime = (value: string | null): string => (value ? new Date(value).toLocaleString() : '未記録');

const sourceLabelMap: Record<SharedStateMetadata['source'], string> = {
  local: 'ローカル',
  'shared-json': '共有ファイル',
  'shared-json-read-failed': '共有ファイルを読めませんでした',
};


type ConflictState = {
  localRevision: number;
  remoteRevision: number;
  remoteSavedAt?: string;
  remoteSavedBy?: string;
};

export const BackupPanel = ({
  workspace,
  appVersion,
  lastSyncedAt,
  calendarStatus,
  calendarError,
  calendarDiagnostics,
  calendarImportSummary,
  calendarAuthStatus = '未接続',
  isConnectingGoogle = false,
  isReloadingCalendar = false,
  storageWarning,
  sharedStateMetadata,
  onBackHome,
  onBackProject,
  onConnectGoogleCalendar,
  onReloadCalendar,
  hiddenMembers,
  onAddMember,
  onRemoveMember,
  onDeleteMember,
  onRestoreMember,
  onRestored,
  onSharedStateMetadataUpdated,
  onSharedStateApplied,
  onCalendarSourceSettingsUpdated,
  onOpenCalendarSettings,
  onOpenBackupSettings,
  onOpenSharedSettings,
  initialSection = 'backup',
}: Props) => {
  const [panelMessage, setPanelMessage] = useState<string | undefined>();
  const [panelError, setPanelError] = useState<string | undefined>();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(loadLastBackupAt());
  const [candidateBackup, setCandidateBackup] = useState<BackupPackage | null>(null);
  const [sharedFileIdInput, setSharedFileIdInput] = useState(sharedStateMetadata.sharedFileId ?? '');
  const [sharedFileNameInput, setSharedFileNameInput] = useState(sharedStateMetadata.sharedFileName ?? '');
  const [calendarIdInputs, setCalendarIdInputs] = useState<CalendarSourceSettings>(() =>
    Object.fromEntries(workspace.calendarSources.map((source) => [source.projectId, source.calendarId])),
  );
  const [memberNameInput, setMemberNameInput] = useState('');
  const [driveAccessToken, setDriveAccessToken] = useState('');
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  const overlayCount = useMemo(() => getAllTaskOverlays().length, [lastBackupAt, panelMessage]);
  const hasSharedFileId = Boolean(sharedStateMetadata.sharedFileId);
  const lastImportText = calendarImportSummary
    ? new Date(calendarImportSummary.updatedAt).toLocaleString('ja-JP')
    : '未実施';

  useEffect(() => {
    const target = document.getElementById(`settings-section-${initialSection}`);
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
    });
  }, [initialSection]);

  const scrollToSettingsSection = (section: SettingsSection) => {
    const target = document.getElementById(`settings-section-${section}`);
    if (!target) return;
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  useEffect(() => {
    setCalendarIdInputs(
      Object.fromEntries(workspace.calendarSources.map((source) => [source.projectId, source.calendarId])),
    );
  }, [workspace.calendarSources]);

  const handleSaveCalendarSettings = () => {
    setPanelMessage(undefined);
    setPanelError(undefined);

    const nextSettings = workspace.calendarSources.reduce<CalendarSourceSettings>((settings, source) => {
      const value = calendarIdInputs[source.projectId]?.trim();
      if (value) {
        settings[source.projectId] = value;
      } else {
        delete settings[source.projectId];
      }
      return settings;
    }, loadCalendarSourceSettings());

    saveCalendarSourceSettings(nextSettings);
    onCalendarSourceSettingsUpdated();
    setPanelMessage('GoogleカレンダーIDを保存しました。');
  };

  const handleAddMember = () => {
    setPanelMessage(undefined);
    setPanelError(undefined);

    const result = onAddMember(memberNameInput);
    if (result.ok) {
      setMemberNameInput('');
      setPanelMessage(result.message);
    } else {
      setPanelError(result.message);
    }

    if (result.warning) {
      setPanelError(result.warning);
    }
  };

  const handleMemberChangeResult = (result: MemberChangeResult) => {
    setPanelMessage(undefined);
    setPanelError(undefined);

    if (result.ok) {
      setPanelMessage(result.message);
    } else {
      setPanelError(result.message);
    }

    if (result.warning) {
      setPanelError(result.warning);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    handleMemberChangeResult(onRemoveMember(memberId));
  };

  const handleDeleteMember = (memberId: string, displayName: string) => {
    const confirmed = window.confirm(
      `${displayName}を担当者候補から削除します。既存タスクの担当者名、Googleカレンダー予定、共有ファイルは削除されません。よろしいですか？`,
    );
    if (!confirmed) return;
    handleMemberChangeResult(onDeleteMember(memberId));
  };

  const handleRestoreMember = (memberId: string) => {
    handleMemberChangeResult(onRestoreMember(memberId));
  };

  const handleExport = () => {
    setPanelMessage(undefined);
    setPanelError(undefined);
    try {
      const backup = createBackupPackage({
        appVersion,
        workspace,
        projects: workspace.projects,
        workflowTemplates: WORKFLOW_TEMPLATES,
        taskOverlays: getAllTaskOverlays(),
        viewPreference: loadViewPreference(),
        customWorkflowStageNames: loadCustomWorkflowStageNames(),
        customWorkflowStageDetails: loadCustomWorkflowStageDetails(),
        lastSyncedAt,
      });
      exportBackupToFile(backup);
      const saveResult = saveLastBackupAt(backup.exportedAt);
      setLastBackupAt(backup.exportedAt);
      setPanelMessage('復元用ファイルを書き出しました。');
      if (saveResult.warning) {
        setPanelError(saveResult.warning);
      }
    } catch {
      setPanelError('復元用ファイルの書き出しに失敗しました。');
    }
  };

  const handleSaveSharedSettings = () => {
    setPanelMessage(undefined);
    setPanelError(undefined);

    const result = saveSharedDriveFileSettings({
      sharedFileId: sharedFileIdInput,
      sharedFileName: sharedFileNameInput,
    });

    if (!result.value) {
      setPanelError(result.warning ?? '共有ファイル設定の保存に失敗しました。');
      return;
    }

    setSharedFileIdInput(result.value.sharedFileId ?? '');
    setSharedFileNameInput(result.value.sharedFileName ?? '');
    onSharedStateMetadataUpdated(result.value, result.warning);
    setPanelMessage('共有ファイル設定を保存しました。');

    if (result.warning) {
      setPanelError(result.warning);
    }
  };

  const handleClearSharedSettings = () => {
    setPanelMessage(undefined);
    setPanelError(undefined);
    const result = clearSharedDriveFileSettings();
    setSharedFileIdInput('');
    setSharedFileNameInput('');
    onSharedStateMetadataUpdated(result.value, result.warning);
    setPanelMessage('共有ファイル設定をクリアしました。');
    if (result.warning) {
      setPanelError(result.warning);
    }
  };

  const handleManualReadSharedState = async (accessToken: string) => {
    setPanelMessage(undefined);
    setPanelError(undefined);

    const loading = setSharedStateSyncStatus('loading');
    onSharedStateMetadataUpdated(loading.value, loading.warning);

    const fileId = sharedStateMetadata.sharedFileId ?? sharedFileIdInput.trim();
    if (!fileId) {
      const failed = markSharedStateReadFailed('DriveファイルIDが未設定です。先に設定を保存してください。');
      onSharedStateMetadataUpdated(failed.value, failed.warning);
      setPanelError('DriveファイルIDが未設定です。');
      return;
    }

    const readResult = await readSharedStateFromDrive({
      appVersion,
      workspace,
      metadata: sharedStateMetadata,
      fileId,
      accessToken,
      lastSyncedAt,
    });
    onSharedStateMetadataUpdated(readResult.metadata, readResult.warning);
    if (!readResult.ok) {
      setPanelError(readResult.error);
      return;
    }
    setPanelMessage(readResult.message);
    onSharedStateApplied(readResult.message, readResult.warning);
  };


  const handleManualReadWithOAuth = async () => {
    setPanelMessage(undefined);
    setPanelError(undefined);

    const authResult = await getDriveReadAccessToken();
    if (!authResult.ok) {
      setPanelError(authResult.error);
      return;
    }

    await handleManualReadSharedState(authResult.accessToken);
    setConflictState(null);
  };

  const handleManualReadWithDebugToken = async () => {
    await handleManualReadSharedState(driveAccessToken);
    setConflictState(null);
  };

  const executeSaveWithToken = async (params: {
    accessToken: string;
    revisionBase?: number;
  }) => {
    const fileId = sharedStateMetadata.sharedFileId ?? sharedFileIdInput.trim();
    if (!fileId) {
      const failed = markSharedStateSaveFailed('sharedFileIdが未設定です。');
      onSharedStateMetadataUpdated(failed.value, failed.warning);
      setPanelError('共有ファイルIDが未設定です。先に共有ファイル設定を保存してください。');
      return;
    }

    const beforeSaveBackup = backupCurrentLocalStateBeforeSharedSave({
      taskOverlays: getAllTaskOverlays(),
      metadata: sharedStateMetadata,
    });

    if (beforeSaveBackup.warning) {
      const failed = markSharedStateSaveFailed(`保存前バックアップに失敗しました: ${beforeSaveBackup.warning}`);
      onSharedStateMetadataUpdated(failed.value, failed.warning);
      setPanelError(`保存前バックアップに失敗しました: ${beforeSaveBackup.warning}`);
      return;
    }

    const sharedPackage = createSharedStatePackage({
      workspace,
      taskOverlays: getAllTaskOverlays(),
      metadata: sharedStateMetadata,
      lastSyncedAt,
      revisionBase: params.revisionBase,
    });

    const validation = validateSharedStatePackage(sharedPackage);
    if (!validation.ok) {
      const failedMessage = `共有ファイルへ保存する内容の検証に失敗しました。\n${validation.errors.join('\n')}`;
      const failed = markSharedStateSaveFailed(failedMessage);
      onSharedStateMetadataUpdated(failed.value, failed.warning);
      setPanelError(failedMessage);
      return;
    }

    const updateResult = await updateDriveJsonFile({
      fileId,
      accessToken: params.accessToken,
      jsonText: JSON.stringify(sharedPackage, null, 2),
    });

    if (!updateResult.ok) {
      const failed = markSharedStateSaveFailed(updateResult.error);
      onSharedStateMetadataUpdated(failed.value, failed.warning);
      setPanelError(updateResult.error);
      return;
    }

    const saved = markSharedStateSaved({
      fileId,
      fileName: sharedStateMetadata.sharedFileName ?? 'shared-state.json',
      revision: sharedPackage.revision,
      savedBy: sharedPackage.savedBy,
      deviceId: sharedPackage.deviceId,
    });
    onSharedStateMetadataUpdated(saved.value, saved.warning);
    setConflictState(null);

    const message = `共有ファイルへ保存しました（共有版: ${sharedPackage.revision}）。`;
    setPanelMessage(message);
    onSharedStateApplied(message, saved.warning);
  };

  const handleManualSaveSharedState = async () => {
    setPanelMessage(undefined);
    setPanelError(undefined);

    const fileId = sharedStateMetadata.sharedFileId ?? sharedFileIdInput.trim();
    if (!fileId) {
      const failed = markSharedStateSaveFailed('sharedFileIdが未設定です。');
      onSharedStateMetadataUpdated(failed.value, failed.warning);
      setPanelError('共有ファイルIDが未設定です。先に共有ファイル設定を保存してください。');
      return;
    }

    const savingMeta = setSharedStateSyncStatus('saving');
    onSharedStateMetadataUpdated(savingMeta.value, savingMeta.warning);

    const writeAuth = await getDriveWriteAccessToken();
    if (!writeAuth.ok) {
      const failed = markSharedStateSaveFailed(writeAuth.error);
      onSharedStateMetadataUpdated(failed.value, failed.warning);
      setPanelError(writeAuth.error);
      return;
    }

    const currentDrive = await fetchDriveJsonFile({ fileId, accessToken: writeAuth.accessToken });
    if (currentDrive.ok) {
      const parsedCurrent = parseSharedStateJson(currentDrive.text);
      if (parsedCurrent.ok && parsedCurrent.data.revision !== sharedStateMetadata.revision) {
        const conflictMessage = '他の端末または別ユーザーが共有状態を更新した可能性があります。';
        const conflict = markSharedStateConflict(conflictMessage);
        onSharedStateMetadataUpdated(conflict.value, conflict.warning);
        setConflictState({
          localRevision: sharedStateMetadata.revision,
          remoteRevision: parsedCurrent.data.revision,
          remoteSavedAt: parsedCurrent.data.savedAt,
          remoteSavedBy: parsedCurrent.data.savedBy,
        });
        setPanelError(conflictMessage);
        return;
      }
    }

    await executeSaveWithToken({ accessToken: writeAuth.accessToken });
  };

  const handleConflictReloadFromDrive = async () => {
    setConflictState(null);
    await handleManualReadWithOAuth();
  };

  const handleConflictOverwriteSave = async () => {
    if (!conflictState) return;
    const writeAuth = await getDriveWriteAccessToken();
    if (!writeAuth.ok) {
      const failed = markSharedStateSaveFailed(writeAuth.error);
      onSharedStateMetadataUpdated(failed.value, failed.warning);
      setPanelError(writeAuth.error);
      return;
    }

    await executeSaveWithToken({
      accessToken: writeAuth.accessToken,
      revisionBase: conflictState.remoteRevision,
    });
  };

  const handleConflictCancel = () => {
    setConflictState(null);
    const conflict = setSharedStateSyncStatus('idle');
    onSharedStateMetadataUpdated(conflict.value, conflict.warning);
    setPanelError('競合により保存をキャンセルしました。');
  };

  const handleSelectBackupFile = async (file: File) => {
    setPanelMessage(undefined);
    setPanelError(undefined);
    setCandidateBackup(null);

    const text = await file.text();
    const parsed = parseBackupJson(text);
    if (!parsed.ok) {
      setPanelError(parsed.error);
      return;
    }

    const validation = validateBackupPackage(parsed.data);
    if (!validation.ok) {
      setPanelError(`復元用ファイルの検証に失敗しました。\n${validation.errors.join('\n')}`);
      return;
    }

    setCandidateBackup(parsed.data);
    setPanelMessage('復元用ファイルを読み込みました。内容を確認して復元してください。');
  };

  const handleToggleAutoReadOnEnter = (enabled: boolean) => {
    setPanelMessage(undefined);
    setPanelError(undefined);
    const result = setAutoReadSharedStateOnEnter(enabled);
    onSharedStateMetadataUpdated(result.value, result.warning);
    setPanelMessage(
      enabled
        ? '入室時の共有データ読み込みをONにしました。'
        : '入室時の共有データ読み込みをOFFにしました。',
    );
    if (result.warning) {
      setPanelError(result.warning);
    }
  };

  const handleRestore = () => {
    if (!candidateBackup) return;
    const result = restoreBackupPackage(candidateBackup);
    if (!result.ok) {
      setPanelError(result.warning ?? result.message);
      return;
    }

    setCandidateBackup(null);
    setPanelError(result.warning);
    setPanelMessage(result.message);
    onRestored(result.message, result.warning);
  };

  const activeSettingsPage = initialSection === 'calendar'
    ? 'calendar'
    : initialSection === 'backup'
      ? 'backup'
      : 'settings';
  const activeSidebarKey = activeSettingsPage === 'calendar'
    ? 'calendar'
    : activeSettingsPage === 'backup'
      ? 'backup'
      : 'settings';
  const pageTitleMap = {
    calendar: {
      title: 'カレンダー連携',
      chip: 'カレンダー',
      context: 'Googleカレンダー',
      description: 'Googleカレンダーの接続、カレンダーID、予定の取り込み設定を管理します。',
    },
    backup: {
      title: 'バックアップ',
      chip: 'バックアップ',
      context: '復元用ファイル',
      description: 'この端末の状態の保存、復元ファイルの読み込み、バックアップ設定を管理します。',
    },
    settings: {
      title: '設定・同期',
      chip: '設定・同期',
      context: '共有と担当者',
      description: '共有ファイル設定、同期設定、担当者候補を管理します。',
    },
  }[activeSettingsPage];

  const openCalendarPage = onOpenCalendarSettings ?? (() => scrollToSettingsSection('calendar'));
  const openBackupPage = onOpenBackupSettings ?? (() => scrollToSettingsSection('backup'));
  const openSettingsPage = onOpenSharedSettings ?? (() => scrollToSettingsSection('shared'));

  return (
    <main className="page settings-reference-page">
      <AppSidebar
        workspaceName={workspace.workspaceName}
        activeKey={activeSidebarKey}
        calendarStatus={calendarStatus}
        lastUpdatedText={lastImportText}
        onHome={onBackHome}
        onProjects={onBackProject ?? onBackHome}
        onCalendar={openCalendarPage}
        onBackup={openBackupPage}
        onSettings={openSettingsPage}
      />
      <section className="card board-header">
        <div className="settings-topbar">
          <div className="workspace-brand">
            <span className="app-mark" aria-hidden="true" />
            <strong>制作PM</strong>
          </div>
          <div className="settings-topbar-context" aria-label="現在の階層">
            <strong>{workspace.workspaceName}</strong>
            <span>{pageTitleMap.context}</span>
          </div>
          <div className="common-nav-secondary">
            <button className="common-nav-action" onClick={onBackHome}>ワークスペースホーム</button>
            {onBackProject ? <button className="common-nav-action" onClick={onBackProject}>プロジェクト画面へ戻る</button> : null}
          </div>
        </div>
        <div className="page-title-row">
          <h1>{pageTitleMap.title}</h1>
          <span className="pill">{pageTitleMap.chip}</span>
        </div>
        <div className="scope-strip" aria-label="現在の操作範囲">
          <span className="scope-chip active">{pageTitleMap.context}</span>
          <span>{pageTitleMap.description}</span>
        </div>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
        {panelMessage ? <p className="note">{panelMessage}</p> : null}
        {panelError ? <p className="error preserve-line-break">{panelError}</p> : null}
      </section>

      <section className="settings-status-grid" aria-label="現在の状態">
        <article className="card settings-status-card">
          <span>ローカル保存</span>
          <strong>有効</strong>
          <small>この端末に保存</small>
        </article>
        <article className="card settings-status-card">
          <span>Googleカレンダー</span>
          <strong>{calendarAuthStatus}</strong>
          <small>{calendarStatus}</small>
        </article>
        <article className="card settings-status-card">
          <span>共有ファイル</span>
          <strong>{hasSharedFileId ? '設定済み' : '未設定'}</strong>
          <small>{sharedStateMetadata.sharedFileName ?? 'DriveファイルIDが必要'}</small>
        </article>
        <article className="card settings-status-card">
          <span>最終同期</span>
          <strong>{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('ja-JP') : '未記録'}</strong>
          <small>前回の取り込み・同期</small>
        </article>
      </section>

      <section className="card settings-quick-actions-card">
        <div className="settings-section-heading">
          <div>
            <p className="meta">普段使う操作</p>
            <h2>必要な操作だけをここに集約</h2>
          </div>
          <span className="pill">手動運用</span>
        </div>
        <div className="settings-quick-action-grid">
          {activeSettingsPage === 'calendar' ? (
            <>
              <button
                type="button"
                className="settings-quick-action"
                onClick={onConnectGoogleCalendar}
                disabled={isConnectingGoogle || calendarDiagnostics.isMockMode}
              >
                <strong>{isConnectingGoogle ? '接続中' : 'Googleアカウントで接続'}</strong>
                <span>対象カレンダーを読めるGoogleアカウントで許可します。</span>
              </button>
              <button
                type="button"
                className="settings-quick-action"
                onClick={onReloadCalendar}
                disabled={isReloadingCalendar || (!calendarDiagnostics.isMockMode && !calendarDiagnostics.readyForGoogleRead)}
              >
                <strong>{isReloadingCalendar ? '取り込み中' : 'Googleカレンダーを取り込む'}</strong>
                <span>正本カレンダーから予定を再取得します。</span>
              </button>
              <button type="button" className="settings-quick-action" onClick={() => scrollToSettingsSection('calendar')}>
                <strong>カレンダーIDを確認</strong>
                <span>プロジェクトごとのカレンダーID設定を確認します。</span>
              </button>
              <button type="button" className="settings-quick-action" onClick={() => scrollToSettingsSection('calendar')}>
                <strong>取り込み状態を見る</strong>
                <span>接続準備、取得済み予定、形式確認件数を確認します。</span>
              </button>
            </>
          ) : null}
          {activeSettingsPage === 'settings' ? (
            <>
              <button
                type="button"
                className="settings-quick-action"
                onClick={() => void handleManualReadWithOAuth()}
                disabled={!hasSharedFileId || sharedStateMetadata.syncStatus === 'loading'}
              >
                <strong>共有ファイルを読む</strong>
                <span>チームの進行状況をこの端末へ反映します。</span>
              </button>
              <button
                type="button"
                className="settings-quick-action"
                onClick={() => void handleManualSaveSharedState()}
                disabled={!hasSharedFileId || sharedStateMetadata.syncStatus === 'saving'}
              >
                <strong>共有ファイルへ保存</strong>
                <span>この端末の進行状況を共有ファイルへ保存します。</span>
              </button>
              <button type="button" className="settings-quick-action" onClick={() => scrollToSettingsSection('shared')}>
                <strong>共有設定を確認</strong>
                <span>DriveファイルID、入室時の読み込み設定を確認します。</span>
              </button>
              <button type="button" className="settings-quick-action" onClick={() => scrollToSettingsSection('settings')}>
                <strong>担当者を管理</strong>
                <span>タスク編集で選ぶ担当者候補を追加・整理します。</span>
              </button>
            </>
          ) : null}
          {activeSettingsPage === 'backup' ? (
            <>
              <button type="button" className="settings-quick-action" onClick={handleExport}>
                <strong>バックアップを作成</strong>
                <span>この端末の状態を復元用ファイルとして保存します。</span>
              </button>
              <button
                type="button"
                className="settings-quick-action"
                onClick={() => document.getElementById('backup-restore-input')?.click()}
              >
                <strong>復元ファイルを読み込む</strong>
                <span>保存済みファイルを選び、内容確認後に復元します。</span>
              </button>
              <button type="button" className="settings-quick-action" onClick={() => scrollToSettingsSection('backup')}>
                <strong>保存内容を確認</strong>
                <span>進行状況、最終バックアップ、保存件数を確認します。</span>
              </button>
            </>
          ) : null}
        </div>
      </section>

      {activeSettingsPage === 'settings' ? (
        <>
      <section id="settings-section-settings" className="card shared-state-card">
        <h2>担当者候補</h2>
        <p className="note">
          タスク編集で選べる担当者をこの端末で管理します。候補から外すと戻せます。削除しても既存タスク、Googleカレンダー予定、共有ファイルは削除しません。
        </p>
        <div className="member-list" aria-label="現在の担当者候補">
          {workspace.members.length > 0 ? workspace.members.map((member) => (
            <div key={member.memberId} className="member-chip">
              <span className="member-color-dot" style={{ backgroundColor: member.color }} aria-hidden="true" />
              <span>{member.displayName}</span>
              <button type="button" className="member-remove-button" onClick={() => handleRemoveMember(member.memberId)}>
                候補から外す
              </button>
              <button
                type="button"
                className="member-delete-button"
                onClick={() => handleDeleteMember(member.memberId, member.displayName)}
              >
                削除
              </button>
            </div>
          )) : (
            <p className="empty-state">担当者候補がありません。</p>
          )}
        </div>
        {hiddenMembers.length > 0 ? (
          <div className="member-restore-panel">
            <p className="member-restore-title">候補から外した担当者</p>
            <div className="member-list" aria-label="候補から外した担当者">
              {hiddenMembers.map((member) => (
                <div key={member.memberId} className="member-chip member-chip-muted">
                  <span className="member-color-dot" style={{ backgroundColor: member.color }} aria-hidden="true" />
                  <span>{member.displayName}</span>
                  <button type="button" className="member-restore-button" onClick={() => handleRestoreMember(member.memberId)}>
                    戻す
                  </button>
                  <button
                    type="button"
                    className="member-delete-button"
                    onClick={() => handleDeleteMember(member.memberId, member.displayName)}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="shared-settings-form member-settings-form">
          <label>
            追加する担当者名
            <input
              type="text"
              value={memberNameInput}
              onChange={(event) => setMemberNameInput(event.target.value)}
              placeholder="例: 田中"
            />
          </label>
        </div>
        <div className="overview-nav">
          <button type="button" className="secondary" onClick={handleAddMember}>
            担当者を追加
          </button>
        </div>
      </section>

        </>
      ) : null}

      {activeSettingsPage === 'calendar' ? (
        <>
      <section id="settings-section-calendar" className="card shared-state-card">
        <h2>GoogleカレンダーID</h2>
        <p className="note">
          Googleカレンダーの「設定と共有」から取得したカレンダーIDを、プロジェクトごとに登録します。
          ここで保存したIDはこの端末にだけ保存されます。
        </p>
        <div className="calendar-id-settings-grid">
          {workspace.calendarSources.map((source) => (
            <label key={source.calendarSourceId} className="calendar-id-input-row">
              <span>{source.displayName}</span>
              <input
                type="text"
                value={calendarIdInputs[source.projectId] ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setCalendarIdInputs((current) => ({
                    ...current,
                    [source.projectId]: value,
                  }));
                }}
                placeholder="project-calendar-id@group.calendar.google.com"
              />
            </label>
          ))}
        </div>
        <div className="overview-nav">
          <button type="button" className="secondary" onClick={handleSaveCalendarSettings}>
            カレンダーIDを保存
          </button>
        </div>
        <p className="note">
          OAuthトークンは保存しません。実読取時はGoogle認証で一時的に読み取り権限を取得します。
        </p>
      </section>

      <section className="card calendar-readiness-card">
        <div className="section-heading-row">
          <div>
            <p className="meta">最初に見る場所</p>
            <h2>接続準備チェック</h2>
          </div>
          <span className={calendarDiagnostics.readyForGoogleRead ? 'pill status-complete' : 'pill'}>
            {calendarDiagnostics.statusLabel}
          </span>
        </div>
        <p className="note">{calendarDiagnostics.detail}</p>
        <div className="calendar-connect-guide">
          <div>
            <strong>Googleアカウントで許可が必要です</strong>
            <p>
              カレンダーIDだけでは予定を読めません。対象カレンダーを閲覧できるGoogleアカウントを選び、
              読み取りを許可してから取り込みます。取得したトークンは保存しません。
            </p>
          </div>
          <div className="calendar-connect-actions">
            <span className="pill">接続: {calendarAuthStatus}</span>
            <button
              type="button"
              className="setup-step-action"
              onClick={onConnectGoogleCalendar}
              disabled={isConnectingGoogle || calendarDiagnostics.isMockMode}
            >
              {isConnectingGoogle ? '接続中' : 'Googleアカウントで接続'}
            </button>
            <button
              type="button"
              className="setup-step-action primary-lite"
              onClick={onReloadCalendar}
              disabled={isReloadingCalendar || (!calendarDiagnostics.isMockMode && !calendarDiagnostics.readyForGoogleRead)}
            >
              {isReloadingCalendar ? '取り込み中' : 'Googleカレンダーを取り込む'}
            </button>
          </div>
        </div>
        <div className="setup-check-grid">
          <p>
            <span>予定の表示</span>
            <strong>{calendarStatus}</strong>
          </p>
          <p>
            <span>OAuth Client ID</span>
            <strong>{calendarDiagnostics.hasOAuthClientId ? '設定済み' : '未設定'}</strong>
          </p>
          <p>
            <span>カレンダーID</span>
            <strong>{calendarDiagnostics.configuredSources}/{calendarDiagnostics.totalSources}件</strong>
          </p>
          <p>
            <span>前回の取り込み</span>
            <strong>{lastImportText}</strong>
          </p>
          <p>
            <span>取り込んだ予定</span>
            <strong>{calendarImportSummary ? `${calendarImportSummary.totalEvents}件` : '未実施'}</strong>
          </p>
          <p>
            <span>形式確認が必要</span>
            <strong>{calendarImportSummary ? `${calendarImportSummary.parseErrorCount}件` : '未実施'}</strong>
          </p>
        </div>
        {calendarDiagnostics.missingSources.length > 0 ? (
          <div className="missing-source-list">
            <strong>未設定のカレンダー</strong>
            <ul>
              {calendarDiagnostics.missingSources.map((source) => (
                <li key={source.calendarSourceId}>{source.displayName}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {calendarImportSummary?.skippedSourceCount ? (
          <p className="note">
            前回取り込みでは未設定カレンダー {calendarImportSummary.skippedSourceCount}件を読み飛ばしました。
            設定済みのプロジェクトはそのまま使えます。
          </p>
        ) : null}
        {calendarError ? <p className="error preserve-line-break">{calendarError}</p> : null}
        <p className="note">{calendarDiagnostics.nextAction}</p>
      </section>

        </>
      ) : null}

      {activeSettingsPage === 'settings' ? (
        <>
      <section id="settings-section-shared" className="card shared-state-card">
        <h2>共有データの状態</h2>
        <p className="note">Google Drive上の共有ファイルを手動で読み書きします。自動保存、ポーリング同期、Driveファイル作成は未実装です。OAuthトークンは保存しません。</p>
        <div className="shared-state-grid">
          <p>表示元: <strong>{sourceLabelMap[sharedStateMetadata.source]}</strong></p>
          <p>共有の状態: <strong>{sharedStateMetadata.syncStatus}</strong></p>
          <p>共有ファイル: <strong>{sharedStateMetadata.sharedFileName ?? '未設定'}</strong></p>
          <p>Drive上のファイルID: <strong>{sharedStateMetadata.sharedFileId ?? '未設定'}</strong></p>
          <p>共有版: <strong>{sharedStateMetadata.revision}</strong></p>
          <p>最後に共有から読んだ日時: <strong>{formatDateTime(sharedStateMetadata.lastReadAt)}</strong></p>
          <p>最後に共有へ保存した日時: <strong>{formatDateTime(sharedStateMetadata.lastSaveAt)}</strong></p>
          <p>保存した端末: <strong>{sharedStateMetadata.savedBy ?? '未記録'}</strong></p>
          <p>この端末ID: <strong>{sharedStateMetadata.deviceId ?? '未記録'}</strong></p>
          <p>
            入室時に読む:
            {' '}
            <strong>{sharedStateMetadata.autoReadSharedStateOnEnter ? '有効' : '無効'}</strong>
          </p>
        </div>

        {!sharedStateMetadata.sharedFileId ? (
          <p className="note">現在はローカル保存された状態を表示しています。</p>
        ) : null}
        {!hasSharedFileId ? (
          <p className="note">DriveファイルIDを設定すると、共有ファイルの読み込み・保存ができます。</p>
        ) : null}

        {sharedStateMetadata.hasLocalChangesAfterShare ? (
          <p className="warning-text shared-state-warning">
            共有ファイルへ保存すると他端末に反映できます。
          </p>
        ) : (
          <p className="note">共有後のローカル変更はありません。</p>
        )}

        <p className="note">Drive保存にはDrive書き込み権限が必要です。OAuthトークンは保存しません。将来はGoogle Picker + drive.fileで権限を限定予定です。</p>
        <button
          type="button"
          className="secondary"
          disabled={!hasSharedFileId || sharedStateMetadata.syncStatus === 'saving'}
          onClick={() => void handleManualSaveSharedState()}
        >
          共有ファイルへ保存
        </button>

        {conflictState ? (
          <div className="shared-conflict">
            <h3>共有状態の競合を検出しました</h3>
            <p>
              Drive上の共有ファイルが、現在のローカル状態より新しい可能性があります。上書きする前に、再読み込みするか、ローカル状態で上書きするかを選択してください。
            </p>
            <ul>
              <li>ローカル共有版: {conflictState.localRevision}</li>
              <li>Drive側共有版: {conflictState.remoteRevision}</li>
              <li>Drive側保存日時: {formatDateTime(conflictState.remoteSavedAt ?? null)}</li>
              <li>Drive側保存端末: {conflictState.remoteSavedBy ?? '未記録'}</li>
              <li>ローカル最終保存日時: {formatDateTime(sharedStateMetadata.lastSaveAt)}</li>
              <li>共有後ローカル変更あり: {sharedStateMetadata.hasLocalChangesAfterShare ? 'あり' : 'なし'}</li>
            </ul>
            <p className="note">
              ローカル状態で上書き保存すると、Drive側の最新状態を上書きします。保存前にはローカルスナップショットを作成します。
            </p>
            <div className="overview-nav">
              <button type="button" className="secondary" onClick={() => void handleConflictReloadFromDrive()}>Drive側を再読み込み</button>
              <button type="button" className="secondary" onClick={() => void handleConflictOverwriteSave()}>ローカル状態で上書き保存</button>
              <button type="button" className="secondary" onClick={handleConflictCancel}>キャンセル</button>
            </div>
          </div>
        ) : null}

        {sharedStateMetadata.lastReadError ? (
          <p className="error">最終エラー: {sharedStateMetadata.lastReadError}</p>
        ) : (
          <p className="note">最終エラー: なし</p>
        )}
      </section>

      <section className="card shared-state-card">
        <h2>入室時に自動で読む</h2>
        <p className="note">ONにすると、ワークスペースに入るときGoogle Drive上の共有ファイルを読み取ります。</p>
        <p className="note">読み取りにはGoogle認証が必要です。認証が必要な場合は手動で読み込んでください。</p>
        <p className="note">読み取りに失敗した場合はローカル状態で表示します。Driveへ自動保存はしません。</p>
        <div className="overview-nav">
          <button
            type="button"
            className="secondary"
            onClick={() => handleToggleAutoReadOnEnter(true)}
            disabled={sharedStateMetadata.autoReadSharedStateOnEnter}
          >
            ONにする
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => handleToggleAutoReadOnEnter(false)}
            disabled={!sharedStateMetadata.autoReadSharedStateOnEnter}
          >
            OFFにする
          </button>
        </div>
      </section>

      <section className="card shared-state-card">
        <h2>チーム共有ファイル</h2>
        <p className="note">Google Drive上に置いた共有用ファイルのIDを登録します。</p>
        <p className="note">登録したファイルIDを使って、手動で読み込み・保存します。</p>
        <div className="shared-settings-form">
          <label>
            DriveファイルID
            <input
              type="text"
              value={sharedFileIdInput}
              onChange={(event) => setSharedFileIdInput(event.target.value)}
              placeholder="例: 1AbCdEfGhIjKlMnOp"
            />
          </label>
          <label>
            共有ファイル名（任意）
            <input
              type="text"
              value={sharedFileNameInput}
              onChange={(event) => setSharedFileNameInput(event.target.value)}
              placeholder="未入力時は shared-state.json"
            />
          </label>
        </div>
        <div className="overview-nav">
          <button type="button" className="secondary" onClick={handleSaveSharedSettings}>設定を保存</button>
          <button type="button" className="secondary" onClick={handleClearSharedSettings}>設定をクリア</button>
        </div>
      </section>

      <section className="card shared-state-card">
        <h2>チームの進行状況を取り込む</h2>
        <p className="note">Google Drive上の共有用ファイルを読み込み、他端末で保存された進行状況を反映します。Googleドキュメントやスプレッドシートはこの段階では対象外です。</p>
        <p className="note">通常はGoogle認証経由でDrive読取トークンを取得して読み込みます。トークンは保存しません。</p>
        {!hasSharedFileId ? (
          <p className="note">共有ファイルを読み込むには、先にDriveファイルIDを設定してください。</p>
        ) : null}
        <button
          type="button"
          className="secondary"
          disabled={!hasSharedFileId || sharedStateMetadata.syncStatus === 'loading'}
          onClick={() => void handleManualReadWithOAuth()}
        >
          共有ファイルを読み込む（Google認証）
        </button>

        <details className="shared-debug">
          <summary>開発用：アクセストークン手入力で読む</summary>
          <label className="shared-settings-form">
            Driveアクセストークン（保存しません）
            <input
              type="password"
              value={driveAccessToken}
              onChange={(event) => setDriveAccessToken(event.target.value)}
              placeholder="ya29..."
            />
          </label>
          <button
            type="button"
            className="secondary"
            disabled={!hasSharedFileId || sharedStateMetadata.syncStatus === 'loading'}
            onClick={() => void handleManualReadWithDebugToken()}
          >
            開発用トークンで読み込む
          </button>
        </details>
      </section>

        </>
      ) : null}

      {activeSettingsPage === 'backup' ? (
        <>
      <section id="settings-section-backup" className="card backup-actions">
        <h2>この端末の状態を保存</h2>
        <p className="note">現在の進行状況や画面設定を、復元用ファイルとして書き出します。</p>
        <button type="button" className="secondary" onClick={handleExport}>この端末の状態をファイルに保存</button>
      </section>

      <section className="card backup-actions">
        <h2>保存ファイルから復元</h2>
        <p className="note">読み込み後は「上書き復元」を実行するまで保存は変更されません。</p>
        <input
          id="backup-restore-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleSelectBackupFile(file);
            }
          }}
        />

        {candidateBackup ? (
          <div className="backup-preview">
            <p>読み込み済み: {new Date(candidateBackup.exportedAt).toLocaleString()}</p>
            <p>workspaceCode: {candidateBackup.workspace.workspaceCode}</p>
            <p>進行状況: {candidateBackup.taskOverlays.length}件</p>
            <button type="button" className="secondary" onClick={handleRestore}>上書き復元を実行する</button>
          </div>
        ) : null}
      </section>
        </>
      ) : null}
    </main>
  );
};
