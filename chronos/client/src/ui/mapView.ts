import type { WorldLayout } from "@chronos/shared";
import { miniMarker, worldToMap } from "./mapMath";

export interface MapMarker {
  x: number;
  z: number;
  kind: "objective" | "story" | "job" | "guard";
  label?: string;
}

export interface MapState {
  player: { x: number; z: number; facing: number };
  markers: MapMarker[];
}

const COLORS = { objective: "#ffbf5e", story: "#ffd76a", job: "#c9c2b0", guard: "#ff6a5a" } as const;
const BASE_PX = 1024;

/** The village map: a base image drawn once from the layout, plus live markers. */
export class MapView {
  private readonly base: HTMLCanvasElement;
  private readonly world: number;

  constructor(private readonly layout: WorldLayout, private readonly spotNames: ReadonlyMap<string, { name: string; pos: [number, number] }>) {
    this.world = layout.size + 20;
    this.base = document.createElement("canvas");
    this.base.width = this.base.height = BASE_PX;
    this.drawBase();
  }

  private p(x: number, z: number): { x: number; y: number } {
    return worldToMap(x, z, this.world, BASE_PX);
  }

  private drawBase(): void {
    const c = this.base.getContext("2d");
    if (!c) return;
    const k = BASE_PX / this.world;
    c.fillStyle = "#3d4a2c";
    c.fillRect(0, 0, BASE_PX, BASE_PX);
    // Inside the walls.
    const o = this.p(0, 0);
    c.fillStyle = "#566a3a";
    c.beginPath();
    c.arc(o.x, o.y, this.layout.wallRadius * k, 0, Math.PI * 2);
    c.fill();
    const DISTRICT: Record<string, string> = { cobble: "#8d8168", dirt: "#7d6a4c", mud: "#5f5039", templeLawn: "#6f8a45", meadow: "#75894a", grass: "#5f7a3d" };
    for (const d of this.layout.districts) {
      const a = this.p(d.rect[0], d.rect[1]);
      const b = this.p(d.rect[2], d.rect[3]);
      c.fillStyle = DISTRICT[d.groundColor] ?? "#667a44";
      c.globalAlpha = 0.85;
      c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    c.globalAlpha = 1;
    c.strokeStyle = "#b7a680";
    c.lineCap = "round";
    for (const r of this.layout.roads) {
      const a = this.p(r.from[0], r.from[1]);
      const b = this.p(r.to[0], r.to[1]);
      c.lineWidth = Math.max(3, r.width * k);
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
      c.stroke();
    }
    // The wall.
    c.strokeStyle = "#2c2a26";
    c.lineWidth = 7;
    c.beginPath();
    c.arc(o.x, o.y, this.layout.wallRadius * k, 0, Math.PI * 2);
    c.stroke();
    // Buildings.
    for (const b of this.layout.buildings) {
      const turned = (b.rot ?? 0) % 2 === 1;
      const w = (turned ? b.size[1] : b.size[0]) * k;
      const h = (turned ? b.size[0] : b.size[1]) * k;
      const q = this.p(b.pos[0], b.pos[1]);
      c.fillStyle = b.kind === "ruin" ? "#5b554c" : "#7a4b35";
      c.strokeStyle = "#241a14";
      c.lineWidth = 2;
      c.fillRect(q.x - w / 2, q.y - h / 2, w, h);
      c.strokeRect(q.x - w / 2, q.y - h / 2, w, h);
    }
  }

  /** Round, north-up, centred on the player. */
  drawMini(canvas: HTMLCanvasElement, s: MapState, radiusMeters = 48): void {
    const c = canvas.getContext("2d");
    if (!c) return;
    const size = canvas.width;
    const R = size / 2;
    const k = BASE_PX / this.world;
    const zoom = R / (radiusMeters * k);
    c.clearRect(0, 0, size, size);
    c.save();
    c.beginPath();
    c.arc(R, R, R - 2, 0, Math.PI * 2);
    c.clip();
    const pp = this.p(s.player.x, s.player.z);
    c.drawImage(this.base, R - pp.x * zoom, R - pp.y * zoom, BASE_PX * zoom, BASE_PX * zoom);
    for (const m of s.markers) {
      const q = miniMarker(m.x - s.player.x, m.z - s.player.z, radiusMeters, R - 4);
      this.marker(c, R + q.x, R + q.y, m.kind, q.pinned ? 4 : 5.5, q.pinned);
    }
    this.arrow(c, R, R, s.player.facing, 7);
    c.restore();
    c.strokeStyle = "rgba(255, 191, 94, 0.75)";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(R, R, R - 2, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#f4ead6";
    c.font = "600 11px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText("N", R, 13);
  }

  /** The whole village with names. */
  drawFull(canvas: HTMLCanvasElement, s: MapState): void {
    const c = canvas.getContext("2d");
    if (!c) return;
    const size = canvas.width;
    const f = size / BASE_PX;
    c.clearRect(0, 0, size, size);
    c.drawImage(this.base, 0, 0, size, size);
    c.textAlign = "center";
    c.font = `600 ${Math.round(size / 52)}px Georgia, serif`;
    c.fillStyle = "rgba(244, 234, 214, 0.9)";
    c.strokeStyle = "rgba(0, 0, 0, 0.75)";
    c.lineWidth = 3;
    for (const d of this.layout.districts) {
      const q = this.p((d.rect[0] + d.rect[2]) / 2, (d.rect[1] + d.rect[3]) / 2);
      c.strokeText(d.name.toUpperCase(), q.x * f, q.y * f);
      c.fillText(d.name.toUpperCase(), q.x * f, q.y * f);
    }
    c.font = `${Math.round(size / 64)}px system-ui, sans-serif`;
    for (const b of this.layout.buildings) {
      if (b.kind === "house" || b.kind === "shack" || b.kind === "ruin" || b.kind === "stall") continue;
      const q = this.p(b.pos[0], b.pos[1]);
      c.strokeText(b.name, q.x * f, q.y * f - 4);
      c.fillText(b.name, q.x * f, q.y * f - 4);
    }
    for (const m of s.markers) {
      const q = this.p(m.x, m.z);
      this.marker(c, q.x * f, q.y * f, m.kind, 8, false);
      if (m.label) {
        c.font = `600 ${Math.round(size / 58)}px system-ui, sans-serif`;
        c.fillStyle = COLORS[m.kind];
        c.strokeText(m.label, q.x * f, q.y * f - 13);
        c.fillText(m.label, q.x * f, q.y * f - 13);
      }
    }
    const pp = this.p(s.player.x, s.player.z);
    this.arrow(c, pp.x * f, pp.y * f, s.player.facing, 11);
  }

  private marker(c: CanvasRenderingContext2D, x: number, y: number, kind: MapMarker["kind"], r: number, hollow: boolean): void {
    c.beginPath();
    if (kind === "objective") {
      c.moveTo(x, y - r * 1.4);
      c.lineTo(x + r, y);
      c.lineTo(x, y + r * 1.4);
      c.lineTo(x - r, y);
      c.closePath();
    } else c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = COLORS[kind];
    c.strokeStyle = "#1a1410";
    c.lineWidth = 2;
    if (!hollow) c.fill();
    c.stroke();
    if (hollow) {
      c.strokeStyle = COLORS[kind];
      c.lineWidth = 1.5;
      c.stroke();
    }
    if (kind === "story" || kind === "job") {
      c.fillStyle = "#1a1410";
      c.font = `700 ${Math.round(r * 1.5)}px system-ui, sans-serif`;
      c.textAlign = "center";
      c.fillText("!", x, y + r * 0.55);
    }
  }

  /** The hero: an arrow pointing where he faces (facing 0 = +z = south on the map). */
  private arrow(c: CanvasRenderingContext2D, x: number, y: number, facing: number, r: number): void {
    c.save();
    c.translate(x, y);
    c.rotate(Math.PI - facing);
    c.beginPath();
    c.moveTo(0, -r * 1.3);
    c.lineTo(r * 0.85, r);
    c.lineTo(0, r * 0.45);
    c.lineTo(-r * 0.85, r);
    c.closePath();
    c.fillStyle = "#ffffff";
    c.strokeStyle = "#1a1410";
    c.lineWidth = 2;
    c.fill();
    c.stroke();
    c.restore();
  }
}
