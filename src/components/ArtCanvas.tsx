import { useEffect, useRef } from 'react';

export type ArtMode = 'constellation' | 'flow' | 'still';

interface ArtCanvasProps {
  theme: 'dark' | 'light';
  mode: ArtMode;
}

interface NodeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  accent: boolean;
  phase: number;
}

interface FlowRibbon {
  x: number;
  y: number;
  px: number;
  py: number;
  speed: number;
  life: number;
  maxLife: number;
  accent: boolean;
}

interface PulseWave {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

/**
 * 60fps 互動式生成數位藝術背景（Canvas 2D）
 * 支援星軌共振（constellation）、流場絲線（flow）、靜謐構圖（still），
 * 並完整遵守 prefers-reduced-motion 與分頁隱藏暫停機制。
 */
export function ArtCanvas({ theme, mode }: ArtCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const mediaReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = mediaReduce.matches;
    const onReduceChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    mediaReduce.addEventListener?.('change', onReduceChange);

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const palette =
      theme === 'dark'
        ? {
            bgFade: 'rgba(10, 10, 11, 0.14)',
            ink: 'rgba(244, 240, 232, 0.42)',
            inkSoft: 'rgba(244, 240, 232, 0.11)',
            accent: 'rgba(200, 255, 46, 0.72)',
            accentSoft: 'rgba(200, 255, 46, 0.18)',
            warm: 'rgba(255, 90, 54, 0.55)',
            ring: 'rgba(244, 240, 232, 0.06)',
          }
        : {
            bgFade: 'rgba(245, 242, 235, 0.16)',
            ink: 'rgba(17, 17, 19, 0.34)',
            inkSoft: 'rgba(17, 17, 19, 0.09)',
            accent: 'rgba(217, 56, 30, 0.65)',
            accentSoft: 'rgba(217, 56, 30, 0.16)',
            warm: 'rgba(29, 78, 216, 0.48)',
            ring: 'rgba(17, 17, 19, 0.06)',
          };

    const pointer = { x: -9999, y: -9999, active: false };
    const pulses: PulseWave[] = [];
    let nodes: NodeParticle[] = [];
    let ribbons: FlowRibbon[] = [];

    const initEntities = () => {
      const count = Math.max(36, Math.min(82, Math.floor((width * height) / 21000)));
      nodes = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.42,
        vy: (Math.random() - 0.5) * 0.42,
        radius: i % 7 === 0 ? 2.6 : 1.45,
        accent: i % 6 === 0,
        phase: Math.random() * Math.PI * 2,
      }));

      const ribbonCount = Math.max(55, Math.min(120, Math.floor(width / 12)));
      ribbons = Array.from({ length: ribbonCount }, (_, i) => {
        const x = Math.random() * width;
        const y = Math.random() * height;
        return {
          x,
          y,
          px: x,
          py: y,
          speed: 0.75 + Math.random() * 1.15,
          life: Math.random() * 140,
          maxLife: 130 + Math.random() * 140,
          accent: i % 5 === 0,
        };
      });
    };

    const drawStaticComposition = () => {
      ctx.clearRect(0, 0, width, height);
      // 建築感同心圓與黃金分割細線
      const cx = width * 0.78;
      const cy = height * 0.24;
      const baseR = Math.min(width, height) * 0.32;

      ctx.strokeStyle = palette.ring;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * (0.45 + i * 0.34), 0, Math.PI * 2);
        ctx.stroke();
      }

      // 靜態星點與微距連線
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        ctx.fillStyle = a.accent ? palette.accent : palette.ink;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 130) {
            ctx.strokeStyle = a.accent && b.accent ? palette.accentSoft : palette.inkSoft;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initEntities();
      if (mode === 'still' || reducedMotion) {
        drawStaticComposition();
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (reducedMotion || mode === 'still') return;
      pulses.push({ x: e.clientX, y: e.clientY, r: 8, alpha: 0.45 });
      if (pulses.length > 5) pulses.shift();
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });

    if (mode === 'still' || reducedMotion) {
      drawStaticComposition();
      return () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('pointerdown', onPointerDown);
        mediaReduce.removeEventListener?.('change', onReduceChange);
      };
    }

    let rafId = 0;
    let tick = 0;

    const renderConstellation = () => {
      ctx.clearRect(0, 0, width, height);
      tick += 0.008;

      // 背景極細建築軌道圈
      ctx.strokeStyle = palette.ring;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(width * 0.82, height * 0.22, Math.min(width, height) * 0.36, 0, Math.PI * 2);
      ctx.stroke();

      // 點擊擴散波紋
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.r += 4.2;
        p.alpha *= 0.96;
        ctx.strokeStyle = theme === 'dark'
          ? `rgba(200, 255, 46, ${p.alpha.toFixed(3)})`
          : `rgba(217, 56, 30, ${p.alpha.toFixed(3)})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        if (p.alpha < 0.015) pulses.splice(i, 1);
      }

      // 更新節點位置與游標磁場互動
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx + Math.sin(tick + n.phase) * 0.08;
        n.y += n.vy + Math.cos(tick + n.phase) * 0.08;

        if (pointer.active) {
          const dx = n.x - pointer.x;
          const dy = n.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 175 && dist > 1) {
            // 近距輕柔排斥 + 切向微旋，創造星圖呼吸感
            const force = (1 - dist / 175) * 0.22;
            n.vx += (dx / dist) * force * 0.45 - (dy / dist) * force * 0.14;
            n.vy += (dy / dist) * force * 0.45 + (dx / dist) * force * 0.14;
          }
        }

        // 速度阻尼與邊界環繞
        n.vx *= 0.985;
        n.vy *= 0.985;
        const speed = Math.hypot(n.vx, n.vy);
        if (speed < 0.16) {
          n.vx += (Math.random() - 0.5) * 0.05;
          n.vy += (Math.random() - 0.5) * 0.05;
        }
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      // 繪製節點連線
      const maxDist = 148;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (theme === 'dark' ? 0.22 : 0.16);
            ctx.strokeStyle =
              a.accent || b.accent
                ? theme === 'dark'
                  ? `rgba(200, 255, 46, ${(alpha * 1.1).toFixed(3)})`
                  : `rgba(217, 56, 30, ${(alpha * 1.1).toFixed(3)})`
                : theme === 'dark'
                  ? `rgba(244, 240, 232, ${alpha.toFixed(3)})`
                  : `rgba(17, 17, 19, ${alpha.toFixed(3)})`;
            ctx.lineWidth = a.accent && b.accent ? 1.05 : 0.7;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        // 游標共振連線
        if (pointer.active) {
          const distP = Math.hypot(a.x - pointer.x, a.y - pointer.y);
          if (distP < 185) {
            const alpha = (1 - distP / 185) * 0.34;
            ctx.strokeStyle = theme === 'dark'
              ? `rgba(200, 255, 46, ${alpha.toFixed(3)})`
              : `rgba(217, 56, 30, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.85;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = a.accent ? palette.accent : palette.ink;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const renderFlowField = () => {
      tick += 0.0045;
      // 柔和殘影淡出，形成數位絲線拖尾
      ctx.fillStyle = palette.bgFade;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < ribbons.length; i++) {
        const r = ribbons[i];
        r.px = r.x;
        r.py = r.y;

        // 簡潔諧波旋度流場（免依賴外部 noise 函式庫）
        const nx = r.x * 0.0032;
        const ny = r.y * 0.0032;
        let angle =
          Math.sin(nx * 1.9 + tick) * Math.cos(ny * 1.6 - tick * 0.8) * Math.PI * 2 +
          Math.sin((nx + ny) * 0.9 + tick * 0.6);

        if (pointer.active) {
          const dx = r.x - pointer.x;
          const dy = r.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 220 && dist > 1) {
            const swirl = (1 - dist / 220) * 1.35;
            angle += Math.atan2(dy, dx) * 0.35 + swirl;
          }
        }

        r.x += Math.cos(angle) * r.speed;
        r.y += Math.sin(angle) * r.speed;
        r.life += 1;

        ctx.strokeStyle = r.accent ? palette.accentSoft : palette.inkSoft;
        ctx.lineWidth = r.accent ? 1.35 : 0.9;
        ctx.beginPath();
        ctx.moveTo(r.px, r.py);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();

        if (r.life > r.maxLife || r.x < -10 || r.x > width + 10 || r.y < -10 || r.y > height + 10) {
          r.x = Math.random() * width;
          r.y = Math.random() * height;
          r.px = r.x;
          r.py = r.y;
          r.life = 0;
        }
      }

      // 輕微點擊波紋
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.r += 3.5;
        p.alpha *= 0.95;
        ctx.strokeStyle = palette.warm;
        ctx.globalAlpha = p.alpha;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (p.alpha < 0.02) pulses.splice(i, 1);
      }
    };

    const loop = () => {
      if (document.visibilityState === 'visible') {
        if (mode === 'constellation') renderConstellation();
        else if (mode === 'flow') renderFlowField();
      }
      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerdown', onPointerDown);
      mediaReduce.removeEventListener?.('change', onReduceChange);
    };
  }, [theme, mode]);

  return <canvas ref={canvasRef} className="art-canvas" aria-hidden="true" />;
}
