const TZ_OFFSET = process.env.APP_TZ_OFFSET ?? '-05:00'; // Ecuador

export function toDateStr(d: Date | string): string {
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

export function getDueAt(dueDate: Date | string, dueTime: string | null): Date | null {
  if (!dueTime) return null;
  const time = dueTime.length === 5 ? `${dueTime}:00` : dueTime.slice(0, 8);
  const dt = new Date(`${toDateStr(dueDate)}T${time}${TZ_OFFSET}`);
  return isNaN(dt.getTime()) ? null : dt;
}