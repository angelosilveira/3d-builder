import { SCHEDULE_LABEL, type ScheduleStatus } from '../../lib/progress'

export function StatusBadge({ status }: { status: ScheduleStatus }) {
  return <span className={`badge badge-${status}`}>{SCHEDULE_LABEL[status]}</span>
}
