import { useMemo, useState } from 'react';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
  type TaskViewModel,
} from '../../domain/taskTypes';
import type { WorkflowStage } from '../../domain/workflowTypes';
import type { Member, Workspace } from '../../domain/workspaceTypes';
import { CalendarMaintenancePanel } from '../calendar/CalendarMaintenancePanel';
import { CommonNav } from '../navigation/CommonNav';
import { resolveProjectWorkflowStages } from '../workflow/customWorkflowStore';
import { calculateReviewFixSummary, sortReviewFixTasks } from './reviewFixUtils';

type TaskDetailPatch = {
  assignee: string;
  taskName: string;
  priority: TaskPriority;
  stageId?: string;
  stageName?: string;
};

type Props = {
  workspace: Workspace;
  projectId: string;
  tasks: TaskViewModel[];
  storageWarning?: string;
  onBackHome: () => void;
  onOpenProjects: () => void;
  onBackProject: () => void;
  onOpenToday: () => void;
  onOpenWorkflow: () => void;
  onOpenBoard: () => void;
  onOpenCalendarSettings: () => void;
  onOpenBackup: () => void;
  onOpenSettings: () => void;
  onChangeStatus: (task: TaskViewModel, status: TaskStatus) => void;
  onUpdateTaskDetails: (task: TaskViewModel, patch: TaskDetailPatch) => void;
  onCalendarWriteBackComplete: () => void;
};

const formatCompactDateTime = (value?: string): string => {
  if (!value) return '未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hasTime = value.includes('T') || /\d{1,2}:\d{2}/.test(value);
  return hasTime
    ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
};

const formatDueLabel = (task: TaskViewModel): string => {
  if (task.dueDate) return formatCompactDateTime(task.dueDate);
  if (task.endDateTime) return formatCompactDateTime(task.endDateTime);
  if (task.startDateTime) return formatCompactDateTime(task.startDateTime);
  return '未設定';
};

const resolveAssigneeOptions = (members: Member[], currentAssignee?: string): string[] => {
  const options = members.map((member) => member.displayName).filter(Boolean);
  if (currentAssignee && !options.includes(currentAssignee)) {
    options.push(currentAssignee);
  }
  return options;
};

const isBulkEditableTask = (task: TaskViewModel): boolean =>
  task.status === '確認待ち'
  || task.status === '修正待ち'
  || task.isDelayed
  || Boolean(task.parseError)
  || task.isUnclassifiedProject
  || !task.assignee
  || task.assignee === '未設定'
  || !task.stageId;

const ReviewFixTaskCard = ({
  task,
  stages,
  members,
  selected,
  onOpenBoard,
  onToggleSelected,
  onChangeStatus,
  onUpdateTaskDetails,
}: {
  task: TaskViewModel;
  stages: WorkflowStage[];
  members: Member[];
  selected: boolean;
  onOpenBoard: () => void;
  onToggleSelected: (taskId: string, selected: boolean) => void;
  onChangeStatus: (target: TaskViewModel, status: TaskStatus) => void;
  onUpdateTaskDetails: (target: TaskViewModel, patch: TaskDetailPatch) => void;
}) => {
  const [assignee, setAssignee] = useState(task.assignee);
  const [taskName, setTaskName] = useState(task.taskName);
  const [priority, setPriority] = useState<TaskPriority>(task.priority ?? '中');
  const [stageId, setStageId] = useState(task.stageId ?? '');

  const assigneeOptions = resolveAssigneeOptions(members, task.assignee);
  const selectedStage = stages.find((stage) => stage.stageId === stageId);

  return (
    <article className="review-fix-task-card">
      <div className="review-fix-task-header">
        <label className="review-fix-select-task">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onToggleSelected(task.taskId, event.target.checked)}
          />
          <span>選択</span>
        </label>
        <p className="review-fix-task-title">{task.taskName}</p>
        <span className="pill">{task.status}</span>
      </div>
      <p className="meta">
        担当: {task.assignee} / 工程: {task.stageName ?? '未設定'} / 期限: {formatDueLabel(task)}
      </p>
      <p className="meta">優先度: {task.priority ?? '中'}</p>
      <div className="status-row">
        {task.isDelayed ? <span className="warning">遅延</span> : null}
        {task.parseError ? <span className="warning">解析エラー</span> : null}
        {task.isUnclassifiedProject ? <span className="warning">未分類</span> : null}
      </div>

      <details className="task-edit-panel">
        <summary>担当者・優先度・依存工程を修正</summary>
        <div className="task-edit-grid">
          <label>
            担当者
            <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">未設定</option>
              {assigneeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            優先度
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              {TASK_PRIORITIES.map((nextPriority) => (
                <option key={nextPriority} value={nextPriority}>
                  {nextPriority}
                </option>
              ))}
            </select>
          </label>
          <label>
            依存する工程
            <select value={stageId} onChange={(event) => setStageId(event.target.value)}>
              <option value="">未設定</option>
              {stages.map((stage) => (
                <option key={stage.stageId} value={stage.stageId}>
                  {stage.order}. {stage.stageName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="task-edit-secondary">
          <label>
            タスク名（必要な場合だけ修正）
            <input value={taskName} onChange={(event) => setTaskName(event.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => onUpdateTaskDetails(task, {
            assignee,
            taskName,
            priority,
            stageId: stageId || undefined,
            stageName: selectedStage?.stageName,
          })}
        >
          修正を保存
        </button>
      </details>

      <details className="board-status-menu">
        <summary>状態を変える</summary>
        <div className="status-buttons">
          {TASK_STATUSES.map((nextStatus) => (
            <button
              key={nextStatus}
              type="button"
              className={`status-button ${task.status === nextStatus ? 'active' : ''}`}
              onClick={() => onChangeStatus(task, nextStatus)}
            >
              {nextStatus}
            </button>
          ))}
        </div>
      </details>

      <button type="button" className="secondary" onClick={onOpenBoard}>
        タスクボードで見る
      </button>
    </article>
  );
};

export const ReviewFixView = ({
  workspace,
  projectId,
  tasks,
  storageWarning,
  onBackHome,
  onOpenProjects,
  onBackProject,
  onOpenToday,
  onOpenWorkflow,
  onOpenBoard,
  onOpenCalendarSettings,
  onOpenBackup,
  onOpenSettings,
  onChangeStatus,
  onUpdateTaskDetails,
  onCalendarWriteBackComplete,
}: Props) => {
  const project = workspace.projects.find((item) => item.projectId === projectId);
  const stages = useMemo(() => (project ? resolveProjectWorkflowStages(project) : []), [project]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkPriority, setBulkPriority] = useState<TaskPriority | ''>('');
  const [bulkStageId, setBulkStageId] = useState('');
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const editableTasks = useMemo(() => {
    const seen = new Set<string>();
    return sortReviewFixTasks(tasks.filter(isBulkEditableTask)).filter((task) => {
      if (seen.has(task.taskId)) return false;
      seen.add(task.taskId);
      return true;
    });
  }, [tasks]);
  if (!project) return null;

  const today = new Date();
  const summary = calculateReviewFixSummary(tasks, today);
  const selectedTasks = editableTasks.filter((task) => selectedTaskIds.includes(task.taskId));
  const selectedBulkStage = stages.find((stage) => stage.stageId === bulkStageId);
  const hasBulkPatch = bulkAssignee !== '' || bulkPriority !== '' || bulkStageId !== '';
  const assigneeOptions = Array.from(
    new Set([
      ...workspace.members.map((member) => member.displayName).filter((name): name is string => Boolean(name)),
      ...editableTasks.map((task) => task.assignee).filter((name): name is string => Boolean(name)),
    ]),
  );

  const handleToggleSelectedTask = (taskId: string, isSelected: boolean) => {
    setBulkMessage(null);
    setSelectedTaskIds((current) => {
      if (isSelected) {
        return current.includes(taskId) ? current : [...current, taskId];
      }
      return current.filter((id) => id !== taskId);
    });
  };

  const handleToggleAllEditableTasks = (isSelected: boolean) => {
    setBulkMessage(null);
    setSelectedTaskIds(isSelected ? editableTasks.map((task) => task.taskId) : []);
  };

  const handleApplyBulkUpdate = () => {
    if (selectedTasks.length === 0) {
      setBulkMessage('変更するタスクを選択してください。');
      return;
    }

    if (!hasBulkPatch) {
      setBulkMessage('変更する項目を選択してください。');
      return;
    }

    selectedTasks.forEach((task) => {
      onUpdateTaskDetails(task, {
        assignee: bulkAssignee || task.assignee,
        taskName: task.taskName,
        priority: (bulkPriority || task.priority || '中') as TaskPriority,
        stageId: bulkStageId || task.stageId,
        stageName: bulkStageId ? selectedBulkStage?.stageName : task.stageName,
      });
    });

    setBulkMessage(`${selectedTasks.length}件のタスクを一括変更しました。`);
    setSelectedTaskIds([]);
  };

  return (
    <main className="page review-fix-page">
      <section className="card board-header">
        <CommonNav
          workspaceName={workspace.workspaceName}
          projectName={project.projectName}
          primaryItems={[
            { label: '概要', onClick: onBackProject },
            { label: '今日', onClick: onOpenToday },
            { label: '工程', onClick: onOpenWorkflow },
            { label: 'タスク', onClick: onOpenBoard },
            { label: '確認・修正', onClick: () => undefined, active: true },
          ]}
          secondaryItems={[
            { label: 'ワークスペースホームへ戻る', onClick: onBackHome },
            { label: '設定・バックアップ', onClick: onOpenBackup },
          ]}
          onOpenProjects={onOpenProjects}
          onOpenCalendar={onOpenCalendarSettings}
          onOpenBackup={onOpenBackup}
          onOpenSettings={onOpenSettings}
        />
        <div className="page-title-row">
          <h1>{project.projectName}</h1>
          <span className="pill">確認・修正</span>
        </div>
        <p>{workspace.workspaceName} / {project.projectName}</p>
        <p className="meta">確認待ち・修正待ちのタスクを確認し、必要に応じて担当者・タスク名・工程を修正できます。</p>
        {storageWarning ? <p className="warning-text">{storageWarning}</p> : null}
      </section>

      <section className="card review-fix-bulk-card">
        <div>
          <h2>選択したタスクをまとめて変更</h2>
          <p className="meta">遅延、解析エラー、確認待ち、修正待ちなど整備が必要なタスクを選び、担当者・優先度・工程をまとめて更新します。</p>
        </div>
        <div className="review-fix-selectable-list">
          <div className="review-fix-selectable-heading">
            <strong>選択できるタスク</strong>
            <span className="pill">{editableTasks.length}件</span>
          </div>
          {editableTasks.length === 0 ? (
            <p className="empty-state">一括変更できる整備対象タスクはありません。</p>
          ) : null}
          {editableTasks.map((task) => (
            <label key={task.taskId} className="review-fix-selectable-item">
              <input
                type="checkbox"
                checked={selectedTaskIds.includes(task.taskId)}
                onChange={(event) => handleToggleSelectedTask(task.taskId, event.target.checked)}
              />
              <span className="review-fix-selectable-main">
                <strong>{task.taskName}</strong>
                <small>
                  担当: {task.assignee || '未設定'} / 工程: {task.stageName ?? '未設定'} / 期限: {formatDueLabel(task)}
                </small>
              </span>
              <span className="status-row review-fix-selectable-tags">
                {task.isDelayed ? <span className="warning">遅延</span> : null}
                {task.parseError ? <span className="warning">解析エラー</span> : null}
                {task.isUnclassifiedProject ? <span className="warning">未分類</span> : null}
                {task.status === '確認待ち' || task.status === '修正待ち' ? <span className="pill">{task.status}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <div className="review-fix-bulk-grid">
          <label>
            担当者
            <select value={bulkAssignee} onChange={(event) => setBulkAssignee(event.target.value)}>
              <option value="">変更しない</option>
              {assigneeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            優先度
            <select value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value as TaskPriority | '')}>
              <option value="">変更しない</option>
              {TASK_PRIORITIES.map((nextPriority) => (
                <option key={nextPriority} value={nextPriority}>
                  {nextPriority}
                </option>
              ))}
            </select>
          </label>
          <label>
            工程
            <select value={bulkStageId} onChange={(event) => setBulkStageId(event.target.value)}>
              <option value="">変更しない</option>
              {stages.map((stage) => (
                <option key={stage.stageId} value={stage.stageId}>
                  {stage.order}. {stage.stageName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="review-fix-bulk-actions">
          <label className="review-fix-select-all">
            <input
              type="checkbox"
              checked={editableTasks.length > 0 && selectedTasks.length === editableTasks.length}
              disabled={editableTasks.length === 0}
              onChange={(event) => handleToggleAllEditableTasks(event.target.checked)}
            />
            <span>表示中の整備対象タスクをすべて選択</span>
          </label>
          <button
            type="button"
            className="primary"
            disabled={selectedTasks.length === 0 || !hasBulkPatch}
            onClick={handleApplyBulkUpdate}
          >
            選択した{selectedTasks.length}件を変更
          </button>
        </div>
        {bulkMessage ? (
          <p className={bulkMessage.includes('しました') ? 'success-text' : 'warning-text'}>{bulkMessage}</p>
        ) : null}
      </section>

      <section className="review-fix-dashboard">
        <div className="review-fix-main-grid">
          <article className="card review-fix-column review-fix-column-review">
            <div className="review-fix-column-heading">
              <h2>確認待ち</h2>
              <span className="pill">{summary.reviewWaiting.length}件</span>
            </div>
            <div className="review-fix-task-list">
              {summary.reviewWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.reviewWaiting.map((task) => (
                <ReviewFixTaskCard
                  key={task.taskId}
                  task={task}
                  stages={stages}
                  members={workspace.members}
                  selected={selectedTaskIds.includes(task.taskId)}
                  onOpenBoard={onOpenBoard}
                  onToggleSelected={handleToggleSelectedTask}
                  onChangeStatus={onChangeStatus}
                  onUpdateTaskDetails={onUpdateTaskDetails}
                />
              ))}
            </div>
          </article>

          <article className="card review-fix-column review-fix-column-fix">
            <div className="review-fix-column-heading">
              <h2>修正待ち</h2>
              <span className="pill">{summary.fixWaiting.length}件</span>
            </div>
            <div className="review-fix-task-list">
              {summary.fixWaiting.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.fixWaiting.map((task) => (
                <ReviewFixTaskCard
                  key={task.taskId}
                  task={task}
                  stages={stages}
                  members={workspace.members}
                  selected={selectedTaskIds.includes(task.taskId)}
                  onOpenBoard={onOpenBoard}
                  onToggleSelected={handleToggleSelectedTask}
                  onChangeStatus={onChangeStatus}
                  onUpdateTaskDetails={onUpdateTaskDetails}
                />
              ))}
            </div>
          </article>
        </div>

        <aside className="card review-fix-sidebar">
          <h2>状況サマリー</h2>
          <div className="review-fix-stat-list">
            <div className="review-fix-stat"><span>確認待ち</span><strong>{summary.reviewWaiting.length}</strong><small>件</small></div>
            <div className="review-fix-stat"><span>修正待ち</span><strong>{summary.fixWaiting.length}</strong><small>件</small></div>
            <div className="review-fix-stat"><span>期限超過</span><strong>{summary.delayedCount}</strong><small>件</small></div>
            <div className="review-fix-stat"><span>今日対応</span><strong>{summary.todayCount}</strong><small>件</small></div>
          </div>
        </aside>
      </section>

      {summary.reviewWaiting.length === 0 && summary.fixWaiting.length === 0 ? (
        <section className="card review-fix-next-actions">
          <div>
            <h2>今できる確認</h2>
            <p className="meta">確認待ち・修正待ちがない場合は、遅延や今日の作業から次の対応を確認します。</p>
          </div>
          <div className="today-empty-actions">
            <button type="button" className="card-link-button" onClick={onOpenBoard}>遅延タスクを見る</button>
            <button type="button" className="card-link-button" onClick={onOpenToday}>今日画面を見る</button>
            <button type="button" className="card-link-button" onClick={onOpenCalendarSettings}>カレンダー整備へ</button>
          </div>
        </section>
      ) : null}

      <section className="card review-fix-insight-card">
        <h2>集計</h2>
        <div className="review-fix-insight-grid">
          <article>
            <h3>担当者別件数</h3>
            <div className="status-row">
              {summary.assigneeGroups.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.assigneeGroups.map((item) => (
                <span key={item.assignee} className="pill">{item.assignee}: {item.count}件</span>
              ))}
            </div>
          </article>
          <article>
            <h3>工程別件数</h3>
            <div className="status-row">
              {summary.stageGroups.length === 0 ? <p className="empty-state">該当タスクなし</p> : null}
              {summary.stageGroups.map((item) => (
                <span key={item.stageName} className="pill">{item.stageName}: {item.count}件</span>
              ))}
            </div>
          </article>
        </div>
      </section>

      <CalendarMaintenancePanel
        project={project}
        tasks={tasks}
        onWriteBackComplete={onCalendarWriteBackComplete}
      />
    </main>
  );
};
