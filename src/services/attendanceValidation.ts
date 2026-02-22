export const buildAttendanceCompositeId = (studentId: string, date: string, session: string): string => {
  return `${studentId}:${date}:${session}`;
};

export const isDuplicateAttendance = (
  existingCompositeIds: Set<string>,
  studentId: string,
  date: string,
  session: string,
): boolean => {
  const key = buildAttendanceCompositeId(studentId, date, session);
  return existingCompositeIds.has(key);
};


export interface ParsedAttendanceSessionValue {
  time: string;
  meta: string | null;
}

export const formatAttendanceSessionValue = (time: string, meta?: string | null): string => {
  if (!meta) return time;
  return `${time} | ${meta}`;
};

export const parseAttendanceSessionValue = (value: string | null | undefined): ParsedAttendanceSessionValue | null => {
  if (!value) return null;

  const [rawTime, rawMeta] = value.split('|').map((v) => v.trim());
  if (!rawTime) return null;

  return {
    time: rawTime,
    meta: rawMeta || null,
  };
};
