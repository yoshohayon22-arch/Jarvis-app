export const PLAYER_ID = "player";

/** Something that happened in the world. The log is the ground truth (read by Echo of the Past in J6). */
export interface WorldEvent {
  id: number;
  /** Game minutes since day 1, 00:00. */
  t: number;
  act: string;
  /** Who really did it. */
  actorId: string;
  /** Who witnesses believe did it (differs under a false face, J6). */
  apparentActorId: string;
  targetId: string | null;
  x: number;
  z: number;
  districtId: string | null;
  importance: number;
  tags: string[];
  witnessIds: string[];
  /** Set when a rewind erased the event (J5). */
  undone?: boolean;
}

export interface EventQuery {
  near?: { x: number; z: number; radius: number };
  since?: number;
  until?: number;
  actorId?: string;
  targetId?: string;
  districtId?: string;
  includeUndone?: boolean;
}

export class EventLog {
  events: WorldEvent[] = [];
  nextId = 1;

  constructor(readonly capacity = 2000) {}

  add(e: Omit<WorldEvent, "id">): WorldEvent {
    const event = { ...e, id: this.nextId++ };
    this.events.push(event);
    if (this.events.length > this.capacity) this.events.splice(0, this.events.length - this.capacity);
    return event;
  }

  get(id: number): WorldEvent | undefined {
    return this.events.find((e) => e.id === id);
  }

  /** Matching events, oldest first. */
  query(q: EventQuery): WorldEvent[] {
    return this.events.filter((e) => {
      if (e.undone && !q.includeUndone) return false;
      if (q.since !== undefined && e.t < q.since) return false;
      if (q.until !== undefined && e.t > q.until) return false;
      if (q.actorId !== undefined && e.actorId !== q.actorId) return false;
      if (q.targetId !== undefined && e.targetId !== q.targetId) return false;
      if (q.districtId !== undefined && e.districtId !== q.districtId) return false;
      if (q.near && (e.x - q.near.x) ** 2 + (e.z - q.near.z) ** 2 > q.near.radius ** 2) return false;
      return true;
    });
  }
}
