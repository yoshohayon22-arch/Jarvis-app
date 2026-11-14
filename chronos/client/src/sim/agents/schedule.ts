import type { ScheduleBlock } from "@chronos/shared";

/**
 * Block active at a given hour (0..24). Blocks are sorted by `from`; before the
 * first block of the day, the last block of the previous day is still running.
 */
export function blockAt(schedule: readonly ScheduleBlock[], hour: number): ScheduleBlock {
  if (schedule.length === 0) throw new Error("empty schedule");
  let current = schedule[schedule.length - 1] as ScheduleBlock;
  for (const b of schedule) {
    if (b.from <= hour) current = b;
    else break;
  }
  return current;
}

/** Shifts a schedule by a number of minutes, keeping hours in [0, 24) and sorted. */
export function shiftSchedule(schedule: readonly ScheduleBlock[], minutes: number): ScheduleBlock[] {
  return schedule
    .map((b) => ({ ...b, from: (((b.from + minutes / 60) % 24) + 24) % 24 }))
    .sort((a, b) => a.from - b.from);
}

export function validateSchedule(schedule: readonly ScheduleBlock[]): string[] {
  const errors: string[] = [];
  if (schedule.length === 0) errors.push("schedule is empty");
  for (let i = 0; i < schedule.length; i++) {
    const b = schedule[i] as ScheduleBlock;
    if (b.from < 0 || b.from >= 24) errors.push(`block ${i}: from ${b.from} out of range`);
    if (i > 0 && b.from <= (schedule[i - 1] as ScheduleBlock).from) errors.push(`block ${i}: not sorted`);
  }
  if (!schedule.some((b) => b.do === "sleep")) errors.push("no sleep block");
  return errors;
}
