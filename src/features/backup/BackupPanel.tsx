import { useMemo, useState } from 'react';
import { WORKFLOW_TEMPLATES } from '../../config/workflowTemplates';
import type { Workspace } from '../../domain/workspaceTypes';
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
  storageWarning?: string;
  sharedStateMetadata: SharedStateMetadata;
  onBackHome: () => void;
  onBackProject?: () => void;
  onRestored: (message: string, warning?: string) => void;
  onSharedStateMetadataUpdated: (metadata: SharedStateMetadata, warning?: string) => void;
  onSharedStateApplied: (message: string, warning?: string) => void;
};

const formatDateTime = (value: string | null): string => (value ? new Date(value).toLocaleString() : '未記録');

const sourceLabelMap: Record<SharedStateMetadata['source'], string> = {
  local: 'ローカル',
  'shared-json': '共有ファイル',
  'shared-json-read-failed': '共有ファイル読み取り失敗',
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
  storageWarning,
  sharedStateMetadata,
  onBackHome,
  onBackProject,
  onRestored,
  onSharedStateMetadataUpdated,
  onSharedStateApplied,
}: Props) => {
  const [panelMessage, setPanelMessage] = useState<string | undefined>();
  const [panelError, setPanelError] = useState<string | undefined>();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(loadLastBackupAt());
  const [candidateBackup, setCandidateBackup] = useState<BackupPackage | null>(null);
  const [sharedFileIdInput, setSharedFileIdInput] = useState(sharedStateMetadata.sharedFileId ?? '');
  const [sharedFileNameInput, setSharedFileNameInput] = useState(sharedStateMetadata.sharedFileName ?? '');
  const [driveAccessToken, setDriveAccessToken] = useState('');
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  const overlayCount = useMemo(() => getAllTaskOverlays().length, [lastBackupAt, panelMessage]);
  const hasSharedFileId = Boolean(sharedStateMetadata.sharedFileId);

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
      const failedMessage = `保存用SharedStatePackageの検証に失敗しました。\n${validation.errors.join('\n')}`;
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

    const message = `共有ファイルへ保存しました（revision: ${sharedPackage.revision}）。`;
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

  return (
    <main className="page">
      <section className="card board-header">
        <div className="settings-topbar">
          <div className="workspace-brand">
            <span className="app-mark" aria-hidden="true" />
            <strong>制作PM</strong>
          </div>
          <div className="common-nav-secondary">
            <button className="common-nav-action" onClick={onBackHome}>ワークスペースホーム</button>
            {onBackProject ? <button className="common-nav-action" onClick={onBackProject}>プロジェクト画面へ戻る</button> : null}
          </div>
        </div>
        <div className="page-title-row">
          <h1>設定・バックアップ</h1>
          <span className="pill">設定</span>
        </div>
        <p>ローカル保存された状態を、復元用ファイルとして書き出し・復元します。</p>
        <p>現在のワークスペース: {workspace.workspaceName}</p>
        <p>保存済みの進行状況: {overlayCount}件</p>
        <p>最終バックアップ日時: {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : '未実施'}</p>
        <p>最終同期日時: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : '未記録'}</p>
        <p className="note">Googleカレンダー予定そのものは復元対象ではありません。</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
        {panelMessage ? <p className="note">{panelMessage}</p> : null}
        {panelError ? <p className="error preserve-line-break">{panelError}</p> : null}
      </section>

      <section className="card shared-state-card">
        <h2>共有データの状態</h2>
        <p className="note">Google Drive上の共有ファイルを手動で読み書きします。自動保存、ポーリング同期、Driveファイル作成は未実装です。OAuthトークンは保存しません。</p>
        <div className="shared-state-grid">
          <p>状態ソース: <strong>{sourceLabelMap[sharedStateMetadata.source]}</strong></p>
          <p>同期状態: <strong>{sharedStateMetadata.syncStatus}</strong></p>
          <p>共有ファイル: <strong>{sharedStateMetadata.sharedFileName ?? '未設定'}</strong></p>
          <p>共有ファイルID: <strong>{sharedStateMetadata.sharedFileId ?? '未設定'}</strong></p>
          <p>revision: <strong>{sharedStateMetadata.revision}</strong></p>
          <p>最終共有読取日時: <strong>{formatDateTime(sharedStateMetadata.lastReadAt)}</strong></p>
          <p>最終共有保存日時: <strong>{formatDateTime(sharedStateMetadata.lastSaveAt)}</strong></p>
          <p>savedBy: <strong>{sharedStateMetadata.savedBy ?? '未記録'}</strong></p>
          <p>deviceId: <strong>{sharedStateMetadata.deviceId ?? '未記録'}</strong></p>
          <p>
            入室時の読み込み:
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
              <li>ローカルrevision: {conflictState.localRevision}</li>
              <li>Drive側revision: {conflictState.remoteRevision}</li>
              <li>Drive側savedAt: {formatDateTime(conflictState.remoteSavedAt ?? null)}</li>
              <li>Drive側savedBy: {conflictState.remoteSavedBy ?? '未記録'}</li>
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
        <h2>入室時に共有データを読む</h2>
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
        <h2>共有ファイルの設定</h2>
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
        <h2>共有ファイルを読み込む</h2>
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

      <section className="card backup-actions">
        <h2>この端末の状態を保存</h2>
        <p className="note">現在の進行状況や画面設定を、復元用ファイルとして書き出します。</p>
        <button type="button" className="secondary" onClick={handleExport}>復元用ファイルを書き出す</button>
      </section>

      <section className="card backup-actions">
        <h2>保存ファイルから復元</h2>
        <p className="note">読み込み後は「上書き復元」を実行するまで保存は変更されません。</p>
        <input
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
    </main>
  );
};
