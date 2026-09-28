import { useEffect, useRef } from "react";

interface Block {
  kind: "paragraph" | "heading" | "list-item" | "code";
  text: string;
  level?: number;
  ordered?: boolean;
}

const BODY_FONT = '"Noto Sans", "Noto Sans SC", system-ui, sans-serif';
const CODE_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let code: string[] | null = null;

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (code) {
        blocks.push({ kind: "code", text: code.join("\n") });
        code = null;
      } else {
        flush();
        code = [];
      }
      continue;
    }
    if (code) { code.push(line); continue; }
    if (!trimmed) { flush(); continue; }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flush(); blocks.push({ kind: "heading", text: heading[2], level: Math.min(6, heading[1].length) }); continue; }

    const ul = trimmed.match(/^[-*]\s+(.+)$/);
    if (ul) { flush(); blocks.push({ kind: "list-item", text: ul[1], ordered: false }); continue; }

    const ol = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (ol) { flush(); blocks.push({ kind: "list-item", text: ol[1], ordered: true }); continue; }

    paragraph.push(trimmed);
  }
  flush();
  if (code) blocks.push({ kind: "code", text: code.join("\n") });
  return blocks;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const src of text.split("\n")) {
    let cur = "";
    for (const ch of src) {
      if (ctx.measureText(cur + ch).width > maxW && cur) {
        const brk = cur.lastIndexOf(" ");
        if (brk > 0) { out.push(cur.slice(0, brk)); cur = cur.slice(brk + 1) + ch; }
        else { out.push(cur); cur = ch; }
      } else { cur += ch; }
    }
    out.push(cur);
  }
  return out;
}

export default function ProtectedText({ content, className }: { content: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const width = Math.max(240, container.clientWidth);
      const scale = Math.min(3, window.devicePixelRatio || 1);
      const blocks = parseBlocks(content);
      const work = document.createElement("canvas").getContext("2d");
      if (!work) return;

      const measured = blocks.map((b) => {
        const isCode = b.kind === "code";
        const font = isCode ? `13px ${CODE_FONT}` : b.kind === "heading" ? `600 ${b.level! <= 2 ? 19 : b.level === 3 ? 17 : 15}px ${BODY_FONT}` : `15px ${BODY_FONT}`;
        const lh = isCode ? 20 : b.kind === "heading" ? Math.round((b.level! <= 2 ? 19 : b.level === 3 ? 17 : 15) * 1.4) : 25;
        work.font = font;
        const text = isCode ? b.text : b.text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
        return { block: b, text, font, lh, lines: wrapText(work, text, width - 34) };
      });

      let height = 12;
      for (const m of measured) {
        height += m.block.kind === "code" ? m.lines.length * m.lh + 28 : m.lines.length * m.lh + (height === 12 ? 0 : 9);
      }
      height += 10;

      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.width = "100%";
      canvas.style.height = `${height}px`;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const color = window.getComputedStyle(container).color || "#1f2329";
      let y = 12;
      for (const m of measured) {
        ctx.font = m.font;
        if (m.block.kind === "code") {
          const ch = m.lines.length * m.lh + 24;
          ctx.fillStyle = "#f6f8fb";
          ctx.fillRect(0, y, width, ch);
          ctx.strokeStyle = "#cbd5e1";
          ctx.strokeRect(0.5, y + 0.5, width - 1, ch - 1);
          ctx.fillStyle = "#1f2329";
          m.lines.forEach((ln, i) => ctx.fillText(ln, 12, y + 18 + i * m.lh));
          y += ch + 10;
        } else {
          ctx.fillStyle = color;
          const x = m.block.kind === "list-item" ? 18 : 0;
          m.lines.forEach((ln, i) => ctx.fillText(x ? `• ${ln}` : ln, x, y + 15 + i * m.lh));
          y += m.lines.length * m.lh + 9;
        }
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [content]);

  return (
    <div className={`protected-text ${className ?? ""}`} ref={containerRef}>
      <canvas ref={canvasRef} role="img" aria-label="Protected content" />
    </div>
  );
}
