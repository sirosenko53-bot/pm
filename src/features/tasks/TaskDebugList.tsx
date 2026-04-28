import { TASK_STATUSES, type TaskStatus, type TaskViewModel } from '../../domain/taskTypes';

type Props = {
  tasks: TaskViewModel[];
  onChangeStatus?: (task: TaskViewModel, status: TaskStatus) => void;
};

export const TaskDebugList = ({ tasks, onChangeStatus }: Props) => {
  if (tasks.length === 0) return <p className="empty-state">タスクがありません。</p>;

  return (
    <div className="table-wrap">
      <table className="task-table">
        <thead>
          <tr>
            <th>タスク名</th>
            <th>担当者</th>
            <th>プロジェクト</th>
            <th>工程</th>
            <th>開始日時</th>
            <th>終了日時</th>
            <th>status</th>
            <th>状態変更</th>
            <th>遅延</th>
            <th>警告</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.taskId}>
              <td>{task.taskName}</td>
              <td>{task.assignee}</td>
              <td>{task.projectName}</td>
              <td>{task.stageName}</td>
              <td>{task.startDateTime || '-'}</td>
              <td>{task.endDateTime || '-'}</td>
              <td>
                <span className="pill">{task.status}</span>
                <div className="meta">{task.overlayUpdatedAt ? `更新: ${new Date(task.overlayUpdatedAt).toLocaleString()}` : '保存済み: 未作成'}</div>
              </td>
              <td>
                <div className="status-buttons">
                  {TASK_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`status-button ${task.status === status ? 'active' : ''}`}
                      onClick={() => onChangeStatus?.(task, status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </td>
              <td>{task.isDelayed ? <span className="warning">遅延</span> : '-'}</td>
              <td>
                {task.parseError ? <span className="warning">解析エラー</span> : null}
                {task.isUnclassifiedProject ? <span className="warning">未分類</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
