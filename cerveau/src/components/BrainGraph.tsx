"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { forceX, forceY } from "d3-force";
import { TYPE_META, type GraphNode, type GraphPayload, type NodeType } from "@/lib/types";

type GNode = GraphNode & { x?: number; y?: number; vx?: number; vy?: number; fx?: number; fy?: number };
type GLink = { id: string; source: string | GNode; target: string | GNode; label: string };

export interface BrainGraphProps {
  data: GraphPayload;
  hiddenTypes: Set<NodeType>;
  searchMatches: Set<string> | null; // null = pas de recherche
  highlight: Set<string>; // neurones cités par une réponse
  born: Map<string, number>; // id (nœud ou lien) → instant d'apparition
  selectedId: string | null;
  focusId: string | null;
  focusTick: number;
  onNodeClick: (n: GraphNode) => void;
  onBackgroundClick: () => void;
}

const BIRTH_MS = 2200;
const LINK_DRAW_MS = 1400;

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const RGB = Object.fromEntries(Object.entries(TYPE_META).map(([k, v]) => [k, hexToRgb(v.color)])) as Record<NodeType, number[]>;
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
const radius = (n: GraphNode) => Math.min(20, 3.2 + Math.sqrt(n.degree) * 2.3);
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

export default function BrainGraph(props: BrainGraphProps) {
  const { data, hiddenTypes, searchMatches, highlight, born, selectedId, focusId, focusTick, onNodeClick, onBackgroundClick } = props;
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const nodeCache = useRef(new Map<string, GNode>());
  const fittedOnce = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Garde les mêmes objets nœuds d'un rafraîchissement à l'autre (positions conservées).
  const graphData = useMemo(() => {
    const cache = nodeCache.current;
    const visible = data.nodes.filter((n) => !hiddenTypes.has(n.type));
    const ids = new Set(visible.map((n) => n.id));
    const links = data.links.filter((l) => ids.has(l.source) && ids.has(l.target));
    const nodes: GNode[] = visible.map((n) => {
      const prev = cache.get(n.id);
      if (prev) return Object.assign(prev, n);
      // Un nouveau neurone naît près d'un voisin déjà placé.
      const neighborId = links.find((l) => l.source === n.id || l.target === n.id);
      const nb = neighborId ? cache.get(neighborId.source === n.id ? neighborId.target : neighborId.source) : undefined;
      const fresh: GNode = { ...n };
      if (nb?.x !== undefined && nb.y !== undefined) {
        fresh.x = nb.x + (Math.random() - 0.5) * 30;
        fresh.y = nb.y + (Math.random() - 0.5) * 30;
      }
      cache.set(n.id, fresh);
      return fresh;
    });
    for (const id of [...cache.keys()]) if (!ids.has(id)) cache.delete(id);
    return { nodes, links: links.map((l) => ({ id: l.id, source: l.source, target: l.target, label: l.label })) as GLink[] };
  }, [data, hiddenTypes]);

  const neighborsOfSelected = useMemo(() => {
    const s = new Set<string>();
    if (!selectedId) return s;
    for (const l of data.links) {
      if (l.source === selectedId) s.add(l.target);
      if (l.target === selectedId) s.add(l.source);
    }
    return s;
  }, [data.links, selectedId]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength?.(-75);
    fg.d3Force("link")?.distance?.(42);
    // Légère gravité vers le centre : les neurones isolés ne s'éloignent pas.
    fg.d3Force("x", forceX(0).strength(0.045));
    fg.d3Force("y", forceY(0).strength(0.045));
  }, [size.w]);

  // Centrage sur un neurone demandé.
  useEffect(() => {
    if (!focusId) return;
    const n = nodeCache.current.get(focusId);
    const fg = fgRef.current;
    if (!n || !fg) return;
    const go = () => {
      if (n.x === undefined || n.y === undefined) return;
      fg.centerAt(n.x, n.y, 800);
      fg.zoom(Math.max(fg.zoom(), 2.4), 800);
    };
    // Un neurone tout juste né n'a pas encore de position : on attend un peu.
    const t = setTimeout(go, n.x === undefined ? 600 : 0);
    return () => clearTimeout(t);
  }, [focusId, focusTick]);

  const searchActive = searchMatches !== null;

  const drawNode = useCallback(
    (node: GNode, ctx: CanvasRenderingContext2D, scale: number) => {
      if (node.x === undefined || node.y === undefined) return;
      const now = performance.now();
      const c = RGB[node.type] ?? [148, 163, 184];
      const r0 = radius(node);
      const isSel = node.id === selectedId;
      const isHi = highlight.has(node.id);
      const isMatch = searchMatches?.has(node.id) ?? false;
      const dimmed = (searchActive && !isMatch) || (selectedId && !isSel && !neighborsOfSelected.has(node.id) && !isHi);
      let glow = node.glow;
      if (isHi || isSel || isMatch) glow = 1;
      const alpha = dimmed ? 0.12 : 0.3 + 0.7 * glow;

      // Animation de naissance
      const b = born.get(node.id);
      const age = b ? now - b : Infinity;
      const t = Math.min(1, age / BIRTH_MS);
      const birthScale = age < BIRTH_MS ? Math.max(0.2, easeOutBack(Math.min(1, t * 1.6))) : 1;
      const r = r0 * birthScale;

      // Halo
      if (!dimmed) {
        const haloR = r * (2.2 + 2.6 * glow) + (isHi ? 6 + 3 * Math.sin(now / 260) : 0);
        const g = ctx.createRadialGradient(node.x, node.y, r * 0.4, node.x, node.y, haloR);
        g.addColorStop(0, rgba(c, 0.55 * glow));
        g.addColorStop(0.45, rgba(c, 0.16 * glow));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(node.x, node.y, haloR, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (age < BIRTH_MS) {
        // Onde lumineuse + flash blanc
        ctx.strokeStyle = rgba([255, 255, 255], 0.9 * (1 - t));
        ctx.lineWidth = 2 / scale;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r0 * (1 + 5 * t), 0, 2 * Math.PI);
        ctx.stroke();
        const flash = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r0 * 4);
        flash.addColorStop(0, rgba([255, 255, 255], 0.8 * (1 - t)));
        flash.addColorStop(1, rgba([255, 255, 255], 0));
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r0 * 4, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Cœur
      const core = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, r * 0.1, node.x, node.y, r);
      core.addColorStop(0, rgba([255, 255, 255], alpha * (0.35 + 0.5 * glow)));
      core.addColorStop(0.35, rgba(c, alpha));
      core.addColorStop(1, rgba(c.map((v) => v * 0.55), alpha));
      ctx.fillStyle = core;
      ctx.beginPath();
      if (node.type === "document") {
        // Les documents sont des losanges.
        ctx.moveTo(node.x, node.y - r * 1.2);
        ctx.lineTo(node.x + r * 1.2, node.y);
        ctx.lineTo(node.x, node.y + r * 1.2);
        ctx.lineTo(node.x - r * 1.2, node.y);
        ctx.closePath();
      } else {
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      }
      ctx.fill();

      if (isHi) {
        ctx.strokeStyle = rgba([180, 245, 255], 0.6 + 0.4 * Math.sin(now / 200));
        ctx.lineWidth = 2.2 / scale;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4 / scale + 2, 0, 2 * Math.PI);
        ctx.stroke();
      }
      if (isSel) {
        ctx.save();
        ctx.setLineDash([3 / scale, 3 / scale]);
        ctx.lineDashOffset = -now / 60 / scale;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 1.6 / scale;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 5 / scale + 2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }

      // Libellé
      const showLabel = isSel || isHi || isMatch || (!dimmed && (scale > 1.5 || node.degree >= 7 || age < BIRTH_MS * 2));
      if (showLabel) {
        const fs = Math.max(10 / scale, 2.4);
        ctx.font = `${isSel || isHi ? 600 : 500} ${fs}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = node.title.length > 34 ? node.title.slice(0, 32) + "…" : node.title;
        ctx.fillStyle = `rgba(3,5,11,${dimmed ? 0.2 : 0.65})`;
        const w = ctx.measureText(label).width;
        ctx.fillRect(node.x - w / 2 - 2 / scale, node.y + r + 3 / scale, w + 4 / scale, fs + 3 / scale);
        ctx.fillStyle = dimmed ? "rgba(219,234,254,0.25)" : `rgba(226,240,255,${0.55 + 0.45 * glow})`;
        ctx.fillText(label, node.x, node.y + r + 4 / scale);
      }
    },
    [born, highlight, neighborsOfSelected, searchActive, searchMatches, selectedId],
  );

  const drawLink = useCallback(
    (link: GLink, ctx: CanvasRenderingContext2D, scale: number) => {
      const s = link.source as GNode;
      const t = link.target as GNode;
      if (s.x === undefined || s.y === undefined || t.x === undefined || t.y === undefined) return;
      const now = performance.now();
      const touchesSel = selectedId && (s.id === selectedId || t.id === selectedId);
      const hi = highlight.has(s.id) && highlight.has(t.id);
      const dim = (searchActive && !(searchMatches?.has(s.id) || searchMatches?.has(t.id))) || (selectedId && !touchesSel);
      const g = (s.glow + t.glow) / 2;
      const b = born.get(link.id);
      const age = b ? now - b : Infinity;
      let x2 = t.x;
      let y2 = t.y;
      if (age < LINK_DRAW_MS) {
        const p = Math.min(1, age / LINK_DRAW_MS);
        const e = 1 - Math.pow(1 - p, 3);
        x2 = s.x + (t.x - s.x) * e;
        y2 = s.y + (t.y - s.y) * e;
      }
      ctx.lineWidth = (touchesSel || hi || age < LINK_DRAW_MS ? 1.6 : 0.8) / scale + 0.15;
      ctx.strokeStyle =
        age < LINK_DRAW_MS
          ? "rgba(190,250,255,0.95)"
          : touchesSel || hi
            ? "rgba(120,230,255,0.75)"
            : dim
              ? "rgba(120,170,230,0.05)"
              : `rgba(120,180,240,${0.1 + 0.28 * g})`;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (age < LINK_DRAW_MS) {
        // Tête lumineuse qui trace le lien
        const head = ctx.createRadialGradient(x2, y2, 0, x2, y2, 6);
        head.addColorStop(0, "rgba(255,255,255,0.95)");
        head.addColorStop(1, "rgba(120,230,255,0)");
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.arc(x2, y2, 6, 0, 2 * Math.PI);
        ctx.fill();
      }
      if ((touchesSel || hi) && scale > 1.8 && link.label) {
        ctx.font = `${Math.max(8 / scale, 1.8)}px Inter, sans-serif`;
        ctx.fillStyle = "rgba(160,220,255,0.75)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(link.label, (s.x + t.x) / 2, (s.y + t.y) / 2);
      }
    },
    [born, highlight, searchActive, searchMatches, selectedId],
  );

  const particles = useCallback(
    (l: GLink) => {
      const s = (l.source as GNode).id ?? l.source;
      const t = (l.target as GNode).id ?? l.target;
      if (highlight.has(s as string) && highlight.has(t as string)) return 3;
      if (selectedId && (s === selectedId || t === selectedId)) return 2;
      return 0;
    },
    [highlight, selectedId],
  );

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {size.w > 0 && (
        <ForceGraph2D<GNode, GLink>
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeId="id"
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node, color, ctx) => {
            if (node.x === undefined || node.y === undefined) return;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius(node) + 4, 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkCanvasObject={drawLink}
          linkCanvasObjectMode={() => "replace"}
          linkDirectionalParticles={particles}
          linkDirectionalParticleWidth={2.2}
          linkDirectionalParticleSpeed={0.008}
          linkDirectionalParticleColor={() => "#a5f3fc"}
          autoPauseRedraw={false}
          cooldownTicks={180}
          d3VelocityDecay={0.32}
          minZoom={0.3}
          maxZoom={8}
          onNodeClick={(n) => onNodeClick(n as GraphNode)}
          onBackgroundClick={onBackgroundClick}
          onEngineStop={() => {
            if (!fittedOnce.current) {
              fittedOnce.current = true;
              fgRef.current?.zoomToFit(700, 70);
            }
          }}
        />
      )}
    </div>
  );
}
