import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { AttackStyle, HeroDef, MonsterDef } from '../types/game';

export interface BattleCanvasHandle {
  triggerHeroAttack: (damage: number, style: AttackStyle, isCrit?: boolean) => void;
  triggerMonsterAttack: (damage: number, shielded?: boolean) => void;
  triggerVictory: () => void;
  triggerDefeat: () => void;
  resetPose: () => void;
}

interface BattleCanvasProps {
  hero: HeroDef;
  equippedAccessory: string | null;
  monster: MonsterDef;
  bgImage: string;
  fallbackGradient: string;
  accentColor: string;
  reducedMotion: boolean;
  animationQuality: 'penuh' | 'hemat';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface Projectile {
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  duration: number;
  style: AttackStyle;
  color: string;
  damage: number;
  isCrit: boolean;
}

interface FloatingNumber {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

type ColorStop = [number, string];

function makeLinearGrad(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stops: ColorStop[]
): CanvasGradient {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const [pos, col] of stops) g.addColorStop(pos, col);
  return g;
}

function makeRadialGrad(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
  stops: ColorStop[]
): CanvasGradient {
  const g = ctx.createRadialGradient(x1, y1, r1, x2, y2, r2);
  for (const [pos, col] of stops) g.addColorStop(pos, col);
  return g;
}

function drawRealisticEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  irisColor: string,
  lookDir: number = 1,
  options: { slit?: boolean; glow?: string; lashes?: boolean; sclera?: string } = {}
) {
  const { slit = false, glow, lashes = false, sclera = '#f8fafc' } = options;
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
  }
  // Eye socket shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y - 0.5, rx + 1.1, ry + 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sclera / glowing orb
  ctx.fillStyle = sclera;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iris
  const irisX = x + lookDir * rx * 0.14;
  ctx.fillStyle = irisColor;
  ctx.beginPath();
  ctx.arc(irisX, y, Math.min(rx, ry) * 0.72, 0, Math.PI * 2);
  ctx.fill();

  // Pupil
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  if (slit) {
    ctx.ellipse(irisX, y, Math.max(0.8, rx * 0.18), ry * 0.72, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(irisX, y, Math.min(rx, ry) * 0.38, 0, Math.PI * 2);
  }
  ctx.fill();

  // Upper eyelid & optional lashes
  ctx.strokeStyle = lashes ? '#1e1b4b' : '#334155';
  ctx.lineWidth = lashes ? 1.5 : 1.1;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();

  if (lashes) {
    ctx.beginPath();
    ctx.moveTo(x - rx * 0.9, y - ry * 0.3);
    ctx.lineTo(x - rx * 1.35, y - ry * 0.85);
    ctx.moveTo(x + rx * 0.9, y - ry * 0.3);
    ctx.lineTo(x + rx * 1.35, y - ry * 0.85);
    ctx.stroke();
  }

  // Specular glint
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(irisX - rx * 0.22, y - ry * 0.28, Math.max(0.8, rx * 0.22), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHumanFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  options: {
    feminine?: boolean;
    irisColor: string;
    browColor: string;
    lipColor?: string;
    skinTone?: 'warm' | 'fair' | 'weathered';
    stern?: boolean;
  }
) {
  const {
    feminine = false,
    irisColor,
    browColor,
    lipColor = feminine ? '#be123c' : '#9a3412',
    skinTone = 'warm',
    stern = false,
  } = options;

  const skinStops: ColorStop[] =
    skinTone === 'fair'
      ? [
          [0, '#fff1e6'],
          [0.55, '#fbd3b6'],
          [1, '#d49a74'],
        ]
      : skinTone === 'weathered'
      ? [
          [0, '#f3cfb2'],
          [0.55, '#dca47c'],
          [1, '#a96f49'],
        ]
      : [
          [0, '#fde2c4'],
          [0.55, '#f2bc91'],
          [1, '#c58152'],
        ];

  const faceW = feminine ? 12.5 : 14;
  const faceH = feminine ? 17 : 18;

  // Neck
  ctx.fillStyle = makeLinearGrad(ctx, cx - 5, cy + 10, cx + 6, cy + 24, [
    [0, '#c58152'],
    [1, '#e8ae82'],
  ]);
  ctx.beginPath();
  ctx.roundRect(cx - (feminine ? 4.5 : 5.5), cy + 11, feminine ? 9 : 11, 12, 3);
  ctx.fill();

  // Sculpted jawline & cheeks
  ctx.fillStyle = makeRadialGrad(ctx, cx - 3, cy - 3, 2, cx, cy, faceH + 2, skinStops);
  ctx.strokeStyle = 'rgba(67, 20, 7, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - faceW, cy - 4);
  ctx.quadraticCurveTo(cx - faceW, cy - faceH, cx, cy - faceH);
  ctx.quadraticCurveTo(cx + faceW, cy - faceH, cx + faceW, cy - 4);
  ctx.quadraticCurveTo(cx + faceW * 0.92, cy + 8, cx + (feminine ? 4 : 6), cy + 14);
  ctx.quadraticCurveTo(cx, cy + (feminine ? 17 : 18), cx - (feminine ? 4 : 6), cy + 14);
  ctx.quadraticCurveTo(cx - faceW * 0.92, cy + 8, cx - faceW, cy - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle cheekbone blush/shading
  if (feminine) {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx - 7, cy + 3, 3.2, 1.8, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 7, cy + 3, 3.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose bridge & tip shadow
  ctx.strokeStyle = 'rgba(154, 52, 18, 0.42)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx + 0.5, cy - 3);
  ctx.lineTo(cx + 1.8, cy + 4);
  ctx.quadraticCurveTo(cx + 0.5, cy + 5.2, cx - 1.2, cy + 4.5);
  ctx.stroke();

  // Eyes (facing slightly right toward monster)
  drawRealisticEye(ctx, cx - 4.6, cy - 2.5, 2.7, feminine ? 2.1 : 1.85, irisColor, 1, {
    lashes: feminine,
  });
  drawRealisticEye(ctx, cx + 5.4, cy - 2.5, 2.6, feminine ? 2.1 : 1.85, irisColor, 1, {
    lashes: feminine,
  });

  // Eyebrows
  ctx.strokeStyle = browColor;
  ctx.lineWidth = feminine ? 1.5 : 2.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (stern) {
    ctx.moveTo(cx - 8, cy - 7.5);
    ctx.lineTo(cx - 2, cy - 5.5);
    ctx.moveTo(cx + 8.5, cy - 7.5);
    ctx.lineTo(cx + 2.5, cy - 5.5);
  } else {
    ctx.moveTo(cx - 7.8, cy - 6.2);
    ctx.quadraticCurveTo(cx - 4.5, cy - 7.8, cx - 2, cy - 6.2);
    ctx.moveTo(cx + 2.5, cy - 6.2);
    ctx.quadraticCurveTo(cx + 5.4, cy - 7.8, cx + 8.4, cy - 6.2);
  }
  ctx.stroke();

  // Mouth
  ctx.strokeStyle = lipColor;
  ctx.lineWidth = feminine ? 1.6 : 1.4;
  ctx.beginPath();
  if (feminine) {
    ctx.moveTo(cx - 3.2, cy + 8.6);
    ctx.quadraticCurveTo(cx + 0.3, cy + 10.2, cx + 3.6, cy + 8.6);
  } else {
    ctx.moveTo(cx - 3.6, cy + 9);
    ctx.quadraticCurveTo(cx + 0.3, stern ? cy + 8.2 : cy + 10, cx + 3.8, cy + 8.8);
  }
  ctx.stroke();
}

function drawFlameTongue(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  phase: number,
  tilt: number = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);

  const sway = Math.sin(phase) * (width * 0.18);
  const sway2 = Math.cos(phase * 1.3) * (width * 0.14);

  // Outer crimson-orange flame
  ctx.fillStyle = makeLinearGrad(ctx, 0, 0, 0, -height, [
    [0, '#b91c1c'],
    [0.45, '#f97316'],
    [0.85, '#facc15'],
    [1, '#fef08a'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-width * 0.5, 0);
  ctx.bezierCurveTo(-width * 0.65, -height * 0.35, -width * 0.25 + sway2, -height * 0.72, sway, -height);
  ctx.bezierCurveTo(width * 0.35 + sway2, -height * 0.7, width * 0.62, -height * 0.32, width * 0.5, 0);
  ctx.closePath();
  ctx.fill();

  // Bright yellow-white hot core
  ctx.fillStyle = makeLinearGrad(ctx, 0, 0, 0, -height * 0.68, [
    [0, '#f59e0b'],
    [0.5, '#fde047'],
    [1, '#ffffff'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-width * 0.24, -1);
  ctx.bezierCurveTo(-width * 0.3, -height * 0.25, sway * 0.4, -height * 0.48, sway * 0.6, -height * 0.66);
  ctx.bezierCurveTo(width * 0.24, -height * 0.42, width * 0.3, -height * 0.2, width * 0.24, -1);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSnowflake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, r * 0.25), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export const BattleCanvas = forwardRef<BattleCanvasHandle, BattleCanvasProps>(
  (
    {
      hero,
      equippedAccessory,
      monster,
      bgImage,
      fallbackGradient,
      accentColor,
      reducedMotion,
      animationQuality,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const propsRef = useRef({ hero, equippedAccessory, monster, accentColor, reducedMotion, animationQuality });
    propsRef.current = { hero, equippedAccessory, monster, accentColor, reducedMotion, animationQuality };

    const stateRef = useRef({
      time: 0,
      heroOffsetX: -120,
      heroDash: 0,
      heroHitFlash: 0,
      heroPose: 'idle' as 'idle' | 'attack' | 'hit' | 'victory' | 'defeat',
      heroPoseTimer: 0,
      monsterOffsetX: 120,
      monsterHitFlash: 0,
      monsterWindup: 0,
      monsterPose: 'idle' as 'idle' | 'attack' | 'hit' | 'defeat',
      monsterPoseTimer: 0,
      shieldTimer: 0,
      hitstop: 0,
      shakeTime: 0,
      shakeIntensity: 0,
      particles: [] as Particle[],
      ambientParticles: [] as Array<{ x: number; y: number; r: number; speed: number; phase: number }>,
      projectiles: [] as Projectile[],
      floatingNumbers: [] as FloatingNumber[],
    });

    const spawnBurst = (x: number, y: number, color: string, count: number) => {
      const s = stateRef.current;
      const actualCount = propsRef.current.animationQuality === 'hemat' ? Math.ceil(count / 2) : count;
      for (let i = 0; i < actualCount; i++) {
        const angle = (Math.PI * 2 * i) / actualCount + Math.random() * 0.4;
        const speed = 70 + Math.random() * 190;
        s.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          size: 3 + Math.random() * 5,
          color,
          alpha: 1,
          life: 0,
          maxLife: 0.45 + Math.random() * 0.3,
        });
      }
    };

    useImperativeHandle(ref, () => ({
      triggerHeroAttack(damage: number, style: AttackStyle, isCrit = false) {
        const s = stateRef.current;
        s.heroPose = 'attack';
        s.heroPoseTimer = 0.45;
        s.heroDash = 1;
        s.projectiles.push({
          x: 270,
          y: 235,
          startX: 270,
          startY: 235,
          targetX: 690,
          targetY: 225,
          progress: 0,
          duration: 0.28,
          style,
          color: propsRef.current.hero.accentColor,
          damage,
          isCrit,
        });
      },
      triggerMonsterAttack(damage: number, shielded = false) {
        const s = stateRef.current;
        s.monsterWindup = 0.25;
        s.monsterPose = 'attack';
        s.monsterPoseTimer = 0.5;
        window.setTimeout(() => {
          const cur = stateRef.current;
          if (shielded) {
            cur.shieldTimer = 0.6;
            spawnBurst(250, 235, '#38bdf8', 16);
            cur.floatingNumbers.push({
              x: 250,
              y: 165,
              vy: -55,
              text: 'PERISAI!',
              color: '#38bdf8',
              life: 0,
              maxLife: 1.0,
              scale: 1.1,
            });
          } else {
            cur.heroPose = 'hit';
            cur.heroPoseTimer = 0.35;
            cur.heroHitFlash = 0.28;
            cur.shakeTime = 0.2;
            cur.shakeIntensity = 6;
            spawnBurst(250, 240, '#f43f5e', 14);
            cur.floatingNumbers.push({
              x: 250,
              y: 165,
              vy: -55,
              text: `-${damage}`,
              color: '#fb7185',
              life: 0,
              maxLife: 1.0,
              scale: 1.15,
            });
          }
        }, 180);
      },
      triggerVictory() {
        const s = stateRef.current;
        s.heroPose = 'victory';
        s.heroPoseTimer = 5;
        s.monsterPose = 'defeat';
        s.monsterPoseTimer = 5;
        spawnBurst(690, 230, '#fbbf24', 28);
      },
      triggerDefeat() {
        const s = stateRef.current;
        s.heroPose = 'defeat';
        s.heroPoseTimer = 5;
      },
      resetPose() {
        const s = stateRef.current;
        s.heroOffsetX = -120;
        s.monsterOffsetX = 120;
        s.heroPose = 'idle';
        s.monsterPose = 'idle';
        s.projectiles = [];
        s.floatingNumbers = [];
      },
    }));

    useEffect(() => {
      const s = stateRef.current;
      s.heroOffsetX = -100;
      s.monsterOffsetX = 100;
      s.heroPose = 'idle';
      s.monsterPose = 'idle';
    }, [monster.id]);

    useEffect(() => {
      const s = stateRef.current;
      if (s.ambientParticles.length === 0) {
        for (let i = 0; i < 24; i++) {
          s.ambientParticles.push({
            x: Math.random() * 960,
            y: 40 + Math.random() * 290,
            r: 1.5 + Math.random() * 2.5,
            speed: 12 + Math.random() * 24,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }

      let rafId = 0;
      let lastTime = performance.now();

      const drawHero = (ctx: CanvasRenderingContext2D, baseX: number, baseY: number) => {
        const { hero: h, equippedAccessory: acc, reducedMotion: rm } = propsRef.current;
        const t = s.time;
        const breath = rm ? 0 : Math.sin(t * 2.8) * 2.2;
        const capeWave = rm ? 0 : Math.sin(t * 3.4) * 5;
        const lunge = s.heroPose === 'attack' ? Math.sin((1 - s.heroPoseTimer / 0.45) * Math.PI) * 50 : 0;
        const recoil = s.heroPose === 'hit' ? -14 : 0;
        const victoryJump = s.heroPose === 'victory' && !rm ? Math.abs(Math.sin(t * 6.5)) * -20 : 0;
        const defeatDrop = s.heroPose === 'defeat' ? 24 : 0;

        const x = baseX + s.heroOffsetX + lunge + recoil;
        const y = baseY + victoryJump + defeatDrop;

        ctx.save();
        ctx.translate(x, y);

        // Ground Contact Shadow
        ctx.fillStyle = makeRadialGrad(ctx, 0, 62 - victoryJump - defeatDrop, 6, 0, 62 - victoryJump - defeatDrop, 52, [
          [0, 'rgba(2, 6, 23, 0.68)'],
          [0.7, 'rgba(2, 6, 23, 0.3)'],
          [1, 'rgba(2, 6, 23, 0)'],
        ]);
        ctx.beginPath();
        ctx.ellipse(0, 62 - victoryJump - defeatDrop, 52, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        // Accessory Aura
        if (acc === 'aura_pelangi' || acc === 'sayap_daun') {
          ctx.save();
          ctx.strokeStyle = acc === 'aura_pelangi' ? '#38bdf8' : '#34d399';
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.45 + 0.25 * Math.sin(t * 4);
          ctx.beginPath();
          ctx.ellipse(0, -14, 54, 72, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        const sx = s.heroPose === 'attack' ? 1.05 : s.heroPose === 'hit' ? 0.94 : 1;
        const sy = s.heroPose === 'attack' ? 0.96 : s.heroPose === 'hit' ? 1.05 : 1;
        ctx.scale(sx, sy);

        const heroVisualId = h.visualId || h.id;
        const swing = s.heroPose === 'attack' ? 0.85 : rm ? 0 : Math.sin(t * 2.4) * 0.06;

        if (heroVisualId === 'ksatria') {
          // === MALE KNIGHT WITH STEEL PLATE ARMOR, CAPE & BROADSWORD ===
          // Flowing Crimson-Royal Cape behind body
          ctx.fillStyle = makeLinearGrad(ctx, -40, -34, 10, 56, [
            [0, '#1e3a8a'],
            [0.5, '#1d4ed8'],
            [1, '#0f172a'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-12, -32 + breath * 0.5);
          ctx.bezierCurveTo(-44, -8, -50 + capeWave, 28, -42 + capeWave, 54);
          ctx.quadraticCurveTo(-18, 50, 6, 46);
          ctx.lineTo(10, -30);
          ctx.closePath();
          ctx.fill();

          // Articulated Armored Legs & Steel Greaves in combat stance
          const legGrad = makeLinearGrad(ctx, -18, 12, 18, 58, [
            [0, '#94a3b8'],
            [0.45, '#e2e8f0'],
            [1, '#334155'],
          ]);
          // Back leg
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.moveTo(-11, 14);
          ctx.lineTo(-19, 36);
          ctx.lineTo(-22, 56);
          ctx.lineTo(-12, 58);
          ctx.lineTo(-7, 36);
          ctx.lineTo(-2, 14);
          ctx.closePath();
          ctx.fill();
          // Front leg + greave highlight
          ctx.fillStyle = legGrad;
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(4, 14);
          ctx.lineTo(14, 34);
          ctx.lineTo(18, 58);
          ctx.lineTo(6, 58);
          ctx.lineTo(3, 36);
          ctx.lineTo(-4, 14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Knee plate & armored sabatons
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.ellipse(9, 35, 6, 4.5, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.ellipse(-16, 57, 9, 4.5, 0, 0, Math.PI * 2);
          ctx.ellipse(15, 58, 10, 4.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Sculpted Steel Breastplate & Chainmail Skirt
          ctx.fillStyle = makeLinearGrad(ctx, -18, -32, 20, 20, [
            [0, '#f8fafc'],
            [0.35, '#94a3b8'],
            [0.75, '#475569'],
            [1, '#1e293b'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-16, -30 + breath * 0.5);
          ctx.lineTo(17, -30 + breath * 0.5);
          ctx.lineTo(15, 6);
          ctx.lineTo(-14, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Armored Tassets & Leather Sword Belt with Gold Buckle
          ctx.fillStyle = '#334155';
          ctx.fillRect(-15, 6, 30, 11);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-15, 2, 30, 5.5);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-4, 1.5, 8, 6.5);

          // Chest Crest Filigree
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0, -24 + breath * 0.5);
          ctx.lineTo(0, -4 + breath * 0.5);
          ctx.moveTo(-7, -18 + breath * 0.5);
          ctx.lineTo(7, -18 + breath * 0.5);
          ctx.stroke();

          // Back Left Pauldron & Shield-Arm
          ctx.fillStyle = makeRadialGrad(ctx, -18, -26, 2, -18, -24, 14, [
            [0, '#f1f5f9'],
            [0.6, '#64748b'],
            [1, '#1e293b'],
          ]);
          ctx.beginPath();
          ctx.ellipse(-18, -24 + breath * 0.5, 11, 9, -0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Male Face + Chiseled Features
          drawHumanFace(ctx, 2, -52 + breath * 0.6, {
            feminine: false,
            irisColor: '#2563eb',
            browColor: '#451a03',
            stern: true,
          });

          // Hair strands under helmet
          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.arc(0, -58 + breath * 0.6, 13, Math.PI * 0.95, Math.PI * 2.05);
          ctx.fill();

          // Steel Open-Faced Knight Barbute Helmet + Gold Rim + Plume
          ctx.fillStyle = makeLinearGrad(ctx, -16, -74, 16, -38, [
            [0, '#f8fafc'],
            [0.45, '#94a3b8'],
            [1, '#334155'],
          ]);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-14, -44 + breath * 0.6);
          ctx.bezierCurveTo(-17, -64 + breath * 0.6, -8, -74 + breath * 0.6, 2, -74 + breath * 0.6);
          ctx.bezierCurveTo(14, -74 + breath * 0.6, 18, -62 + breath * 0.6, 16, -44 + breath * 0.6);
          ctx.lineTo(12, -38 + breath * 0.6);
          ctx.lineTo(10, -56 + breath * 0.6);
          ctx.lineTo(-6, -56 + breath * 0.6);
          ctx.lineTo(-8, -38 + breath * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Helmet gold trim
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-8, -56 + breath * 0.6);
          ctx.lineTo(11, -56 + breath * 0.6);
          ctx.stroke();
          // Swept Golden Helmet Plume
          ctx.fillStyle = makeLinearGrad(ctx, -18, -88, 6, -70, [
            [0, '#fef08a'],
            [0.5, '#f59e0b'],
            [1, '#b45309'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-2, -73 + breath * 0.6);
          ctx.bezierCurveTo(-18, -88 + breath * 0.6, -30, -76 + breath * 0.6, -24, -64 + breath * 0.6);
          ctx.quadraticCurveTo(-12, -68 + breath * 0.6, 2, -72 + breath * 0.6);
          ctx.closePath();
          ctx.fill();

          // Front Right Armored Arm + Gauntlet Gripping Broadsword
          ctx.save();
          ctx.translate(16, -22 + breath * 0.5);
          ctx.rotate(swing * 0.85);
          // Pauldron
          ctx.fillStyle = makeRadialGrad(ctx, -2, -2, 2, 0, 0, 14, [
            [0, '#f8fafc'],
            [0.5, '#94a3b8'],
            [1, '#334155'],
          ]);
          ctx.beginPath();
          ctx.ellipse(0, 0, 10, 8.5, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          // Forearm & Gauntlet
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.roundRect(-4, 5, 9, 18, 4);
          ctx.fill();
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.roundRect(1, 18, 12, 9, 4);
          ctx.fill();
          // Detailed Steel Broadsword in Hand
          ctx.save();
          ctx.translate(12, 22);
          ctx.rotate(0.28);
          // Leather grip & gold pommel
          ctx.fillStyle = '#451a03';
          ctx.fillRect(-2.5, 0, 5, 13);
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, 15, 4.2, 0, Math.PI * 2);
          ctx.fill();
          // Sculpted gold crossguard
          ctx.fillStyle = makeLinearGrad(ctx, -14, -4, 14, 2, [
            [0, '#fef08a'],
            [0.5, '#f59e0b'],
            [1, '#92400e'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-14, -2);
          ctx.quadraticCurveTo(0, -6, 14, -2);
          ctx.lineTo(12, 2);
          ctx.quadraticCurveTo(0, -1, -12, 2);
          ctx.closePath();
          ctx.fill();
          // Beveled steel blade
          ctx.fillStyle = makeLinearGrad(ctx, -5, -72, 5, -72, [
            [0, '#cbd5e1'],
            [0.48, '#ffffff'],
            [0.52, '#64748b'],
            [1, '#e2e8f0'],
          ]);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-4.8, -3);
          ctx.lineTo(-4.2, -62);
          ctx.lineTo(0, -76);
          ctx.lineTo(4.2, -62);
          ctx.lineTo(4.8, -3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Center fuller ridge
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(0, -60);
          ctx.stroke();
          ctx.restore();
          ctx.restore();
        } else if (heroVisualId === 'penyihir') {
          // === FEMALE MAGE WITH LONG FLOWING HAIR, WIZARD HAT & ARCANE STAFF ===
          // Long Wavy Dark-Plum Hair Cascading Down Back
          ctx.fillStyle = makeLinearGrad(ctx, -26, -62, 18, 36, [
            [0, '#581c87'],
            [0.5, '#3b0764'],
            [1, '#1e1b4b'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-14, -56 + breath * 0.5);
          ctx.bezierCurveTo(-30, -28, -34 + capeWave * 0.6, 12, -26 + capeWave * 0.7, 38);
          ctx.quadraticCurveTo(-12, 42, -4, 34);
          ctx.lineTo(16, 36);
          ctx.bezierCurveTo(22, 12, 20, -28, 12, -56 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          // Glossy hair strand highlights
          ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-17, -44);
          ctx.quadraticCurveTo(-26, -6, -21 + capeWave * 0.5, 32);
          ctx.moveTo(13, -44);
          ctx.quadraticCurveTo(18, -6, 13, 30);
          ctx.stroke();

          // Arcane Boots beneath robe hem
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.ellipse(-9, 57, 7, 4, 0, 0, Math.PI * 2);
          ctx.ellipse(10, 58, 8, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          // Layered Flowing Violet Silk Mage Robe
          ctx.fillStyle = makeLinearGrad(ctx, -24, -30, 26, 56, [
            [0, '#6d28d9'],
            [0.45, '#5b21b6'],
            [1, '#2e1065'],
          ]);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-13, -30 + breath * 0.5);
          ctx.lineTo(13, -30 + breath * 0.5);
          ctx.bezierCurveTo(18, -4, 24, 26, 26, 55);
          ctx.quadraticCurveTo(0, 60, -26, 54);
          ctx.bezierCurveTo(-22, 26, -18, -4, -13, -30 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Cyan & Gold Center Tabard / Sash
          ctx.fillStyle = makeLinearGrad(ctx, 0, -26, 0, 54, [
            [0, '#0891b2'],
            [0.5, '#0e7490'],
            [1, '#164e63'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-6, -26 + breath * 0.5);
          ctx.lineTo(6, -26 + breath * 0.5);
          ctx.lineTo(10, 55);
          ctx.lineTo(-10, 55);
          ctx.closePath();
          ctx.fill();
          // Gold belt sash
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.roundRect(-13, -6 + breath * 0.5, 26, 4.5, 2);
          ctx.fill();

          // Feminine Face & Long Side Bangs
          drawHumanFace(ctx, 1, -50 + breath * 0.6, {
            feminine: true,
            irisColor: '#38bdf8',
            browColor: '#581c87',
            skinTone: 'fair',
          });
          // Soft violet front locks framing face
          ctx.fillStyle = '#4c1d95';
          ctx.beginPath();
          ctx.moveTo(-13, -55 + breath * 0.6);
          ctx.quadraticCurveTo(-17, -42, -13, -30);
          ctx.quadraticCurveTo(-9, -42, -8, -56);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(13, -55 + breath * 0.6);
          ctx.quadraticCurveTo(17, -42, 13, -30);
          ctx.quadraticCurveTo(9, -42, 8, -56);
          ctx.closePath();
          ctx.fill();

          // Sculpted Pointed Witch / Wizard Hat
          ctx.fillStyle = makeLinearGrad(ctx, -28, -62, 28, -60, [
            [0, '#3b0764'],
            [0.5, '#6d28d9'],
            [1, '#2e1065'],
          ]);
          ctx.beginPath();
          ctx.ellipse(0, -61 + breath * 0.6, 30, 6.5, -0.04, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          // Crooked dramatic hat cone
          ctx.fillStyle = makeLinearGrad(ctx, -18, -106, 16, -62, [
            [0, '#7c3aed'],
            [0.6, '#4c1d95'],
            [1, '#2e1065'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-18, -62 + breath * 0.6);
          ctx.bezierCurveTo(-12, -80, -4, -96, -12, -108 + breath * 0.6);
          ctx.bezierCurveTo(6, -96, 14, -80, 18, -62 + breath * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
          ctx.stroke();
          // Cyan hat band with buckle
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(-15, -66 + breath * 0.6, 30, 4);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(4, -67 + breath * 0.6, 6, 6);

          // Left Sleeve + Arm Raised Slightly & Right Arm Holding Arcane Staff
          ctx.save();
          ctx.translate(15, -20 + breath * 0.5);
          ctx.rotate(swing * 0.6);
          // Draped bell sleeve
          ctx.fillStyle = '#5b21b6';
          ctx.beginPath();
          ctx.moveTo(-4, -2);
          ctx.lineTo(12, 16);
          ctx.lineTo(2, 24);
          ctx.lineTo(-6, 12);
          ctx.closePath();
          ctx.fill();
          // Hand gripping staff
          ctx.fillStyle = '#fbd3b6';
          ctx.beginPath();
          ctx.arc(10, 18, 4.2, 0, Math.PI * 2);
          ctx.fill();
          // Gnarled Dark Wood & Brass Staff
          ctx.save();
          ctx.translate(12, 16);
          ctx.rotate(0.14);
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 4.6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-4, 48);
          ctx.quadraticCurveTo(2, 4, 0, -48);
          ctx.stroke();
          // Brass prongs cradling orb
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, -56, 10, 0.25 * Math.PI, 0.75 * Math.PI);
          ctx.stroke();
          // Luminous Cyan Faceted Crystal Orb
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 16;
          ctx.fillStyle = makeRadialGrad(ctx, -2, -59, 1, 0, -57, 10, [
            [0, '#ffffff'],
            [0.35, '#67e8f9'],
            [0.75, '#06b6d4'],
            [1, '#0e7490'],
          ]);
          ctx.beginPath();
          ctx.arc(0, -57, 9.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
          ctx.restore();
        } else if (heroVisualId === 'penjelajah') {
          // === FEMALE HOODED ARCHER WITH QUIVER, LEATHER ARMOR & RECURVE BOW ===
          // Quiver strapped diagonally behind back with feathered arrows
          ctx.save();
          ctx.translate(-12, -16 + breath * 0.5);
          ctx.rotate(-0.38);
          ctx.fillStyle = '#78350f';
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.roundRect(-5, -18, 10, 34, 3);
          ctx.fill();
          ctx.stroke();
          // Arrow fletchings sticking out
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-4, -25, 2.5, 8);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, -27, 2.5, 10);
          ctx.fillStyle = '#34d399';
          ctx.fillRect(3, -24, 2.5, 7);
          ctx.restore();

          // Flowing Forest Cloak Back
          ctx.fillStyle = makeLinearGrad(ctx, -32, -32, 4, 48, [
            [0, '#065f46'],
            [0.6, '#064e3b'],
            [1, '#022c22'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-10, -34 + breath * 0.5);
          ctx.bezierCurveTo(-34, -8, -38 + capeWave * 0.8, 24, -30 + capeWave, 50);
          ctx.lineTo(10, 44);
          ctx.lineTo(10, -30);
          ctx.closePath();
          ctx.fill();

          // Agile Ranger Legs & Leather Boots
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(-9, 14);
          ctx.lineTo(-16, 36);
          ctx.lineTo(-18, 56);
          ctx.lineTo(-9, 57);
          ctx.lineTo(-3, 14);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(4, 14);
          ctx.lineTo(12, 36);
          ctx.lineTo(14, 57);
          ctx.lineTo(4, 57);
          ctx.lineTo(-1, 14);
          ctx.closePath();
          ctx.fill();
          // Knee-high brown leather ranger boots
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-18, 42, 10, 15);
          ctx.fillRect(4, 42, 10, 15);

          // Studded Emerald & Leather Ranger Tunic
          ctx.fillStyle = makeLinearGrad(ctx, -14, -30, 14, 20, [
            [0, '#059669'],
            [0.5, '#047857'],
            [1, '#064e3b'],
          ]);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-13, -30 + breath * 0.5);
          ctx.lineTo(13, -30 + breath * 0.5);
          ctx.lineTo(11, 16);
          ctx.lineTo(-12, 16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Diagonal leather harness & waist belt
          ctx.strokeStyle = '#92400e';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-11, -28 + breath * 0.5);
          ctx.lineTo(10, 4 + breath * 0.5);
          ctx.stroke();
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-12, 4, 24, 5);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-3, 4, 6, 5);

          // Deep Hood Outer Silhouette behind face
          ctx.fillStyle = '#022c22';
          ctx.beginPath();
          ctx.ellipse(0, -51 + breath * 0.6, 17, 19, 0, 0, Math.PI * 2);
          ctx.fill();

          // Feminine Archer Face inside Hood
          drawHumanFace(ctx, 2, -50 + breath * 0.6, {
            feminine: true,
            irisColor: '#d97706',
            browColor: '#92400e',
          });
          // Warm auburn hair strands spilling out of hood
          ctx.fillStyle = '#b45309';
          ctx.beginPath();
          ctx.moveTo(-11, -56 + breath * 0.6);
          ctx.quadraticCurveTo(-15, -42, -10, -31);
          ctx.quadraticCurveTo(-6, -42, -6, -54);
          ctx.closePath();
          ctx.fill();

          // Pointed Emerald Ranger Hood Framing Face
          ctx.fillStyle = makeLinearGrad(ctx, -18, -74, 16, -34, [
            [0, '#10b981'],
            [0.45, '#047857'],
            [1, '#064e3b'],
          ]);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-14, -33 + breath * 0.6);
          ctx.bezierCurveTo(-24, -52, -16, -74, 2, -74 + breath * 0.6);
          ctx.bezierCurveTo(16, -74, 20, -56, 14, -44 + breath * 0.6);
          ctx.quadraticCurveTo(4, -62 + breath * 0.6, -10, -52 + breath * 0.6);
          ctx.quadraticCurveTo(-13, -42, -10, -33 + breath * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Pointed trailing hood tail
          ctx.beginPath();
          ctx.moveTo(-12, -64 + breath * 0.6);
          ctx.lineTo(-27, -71 + breath * 0.6);
          ctx.lineTo(-16, -53 + breath * 0.6);
          ctx.closePath();
          ctx.fill();

          // Arm Holding Recurve Bow & Nocked Arrow
          ctx.save();
          ctx.translate(14, -20 + breath * 0.5);
          ctx.rotate(swing * 0.5);
          // Forest sleeve + leather bracer
          ctx.fillStyle = '#047857';
          ctx.beginPath();
          ctx.roundRect(-2, -3, 18, 8, 4);
          ctx.fill();
          ctx.fillStyle = '#78350f';
          ctx.fillRect(10, -3, 9, 7);
          ctx.fillStyle = '#f2bc91';
          ctx.beginPath();
          ctx.arc(20, 0, 4, 0, Math.PI * 2);
          ctx.fill();

          // Carved Horn-and-Wood Recurve Bow
          ctx.save();
          ctx.translate(22, 0);
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-6, -34);
          ctx.bezierCurveTo(14, -22, 14, 22, -6, 34);
          ctx.stroke();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-4, -30);
          ctx.bezierCurveTo(10, -18, 10, 18, -4, 30);
          ctx.stroke();
          // Taut Bowstring
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(-6, -34);
          ctx.lineTo(-13, 0);
          ctx.lineTo(-6, 34);
          ctx.stroke();
          // Nocked Arrow
          ctx.strokeStyle = '#fef3c7';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(-13, 0);
          ctx.lineTo(24, 0);
          ctx.stroke();
          // Steel Broadhead Tip
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(22, -4);
          ctx.lineTo(31, 0);
          ctx.lineTo(22, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.restore();
        } else {
          // === PENJAGA HUTAN: MALE ELF WITH LONG POINTED EARS & BATTLE AXE ===
          // Woodland Cloak Back
          ctx.fillStyle = makeLinearGrad(ctx, -32, -32, 6, 48, [
            [0, '#14532d'],
            [0.6, '#064e3b'],
            [1, '#022c22'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-12, -32 + breath * 0.5);
          ctx.bezierCurveTo(-36, -6, -38 + capeWave * 0.7, 24, -30 + capeWave, 48);
          ctx.lineTo(10, 44);
          ctx.lineTo(10, -30);
          ctx.closePath();
          ctx.fill();

          // Woodland Legs & Leather Greaves
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.moveTo(-10, 14);
          ctx.lineTo(-17, 36);
          ctx.lineTo(-19, 57);
          ctx.lineTo(-9, 57);
          ctx.lineTo(-3, 14);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(4, 14);
          ctx.lineTo(13, 36);
          ctx.lineTo(15, 58);
          ctx.lineTo(5, 58);
          ctx.lineTo(-1, 14);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-19, 41, 11, 16);
          ctx.fillRect(4, 41, 11, 16);

          // Rugged Forest-Green & Brown Leather Tunic
          ctx.fillStyle = makeLinearGrad(ctx, -16, -30, 16, 18, [
            [0, '#15803d'],
            [0.5, '#047857'],
            [1, '#064e3b'],
          ]);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-15, -30 + breath * 0.5);
          ctx.lineTo(15, -30 + breath * 0.5);
          ctx.lineTo(13, 16);
          ctx.lineTo(-14, 16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Leather Shoulder Guard & Belt
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.ellipse(-15, -24 + breath * 0.5, 9, 7, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(-14, 3, 28, 5.5);
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.arc(0, 6, 3.2, 0, Math.PI * 2);
          ctx.fill();

          // Distinctive LONG POINTED MALE ELF EARS (behind head)
          ctx.fillStyle = makeLinearGrad(ctx, -36, -58, -10, -46, [
            [0, '#fde2c4'],
            [1, '#c58152'],
          ]);
          ctx.strokeStyle = 'rgba(67, 20, 7, 0.55)';
          ctx.lineWidth = 1.2;
          // Left long ear
          ctx.beginPath();
          ctx.moveTo(-10, -52 + breath * 0.6);
          ctx.quadraticCurveTo(-26, -58 + breath * 0.6, -39, -63 + breath * 0.6);
          ctx.quadraticCurveTo(-25, -49 + breath * 0.6, -11, -44 + breath * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Right long ear
          ctx.beginPath();
          ctx.moveTo(12, -52 + breath * 0.6);
          ctx.quadraticCurveTo(28, -58 + breath * 0.6, 40, -63 + breath * 0.6);
          ctx.quadraticCurveTo(26, -49 + breath * 0.6, 13, -44 + breath * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Male Elf Sculpted Face
          drawHumanFace(ctx, 2, -50 + breath * 0.6, {
            feminine: false,
            irisColor: '#10b981',
            browColor: '#92400e',
            stern: true,
          });

          // Swept Golden-Amber Male Elf Hair & Leaf Circlet
          ctx.fillStyle = makeLinearGrad(ctx, -14, -70, 14, -42, [
            [0, '#fbbf24'],
            [0.55, '#d97706'],
            [1, '#92400e'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-15, -48 + breath * 0.6);
          ctx.bezierCurveTo(-18, -68 + breath * 0.6, 0, -75 + breath * 0.6, 16, -64 + breath * 0.6);
          ctx.lineTo(16, -50 + breath * 0.6);
          ctx.lineTo(9, -57 + breath * 0.6);
          ctx.lineTo(2, -52 + breath * 0.6);
          ctx.lineTo(-5, -58 + breath * 0.6);
          ctx.lineTo(-12, -51 + breath * 0.6);
          ctx.closePath();
          ctx.fill();

          // Arm & Hand Gripping Heavy Woodland Battle Axe
          ctx.save();
          ctx.translate(16, -20 + breath * 0.5);
          ctx.rotate(swing * 0.9);
          ctx.fillStyle = '#047857';
          ctx.beginPath();
          ctx.roundRect(-3, -2, 9, 18, 4);
          ctx.fill();
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-3, 8, 9, 10);
          ctx.fillStyle = '#f2bc91';
          ctx.beginPath();
          ctx.arc(3, 19, 4.4, 0, Math.PI * 2);
          ctx.fill();

          // Detailed Battle Axe
          ctx.save();
          ctx.translate(5, 19);
          ctx.rotate(0.22);
          // Wooden Ash Haft
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 22);
          ctx.lineTo(0, -60);
          ctx.stroke();
          // Steel Crescent Bearded Axe Blade
          ctx.fillStyle = makeLinearGrad(ctx, 0, -58, 28, -32, [
            [0, '#475569'],
            [0.55, '#cbd5e1'],
            [1, '#ffffff'],
          ]);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, -48);
          ctx.bezierCurveTo(14, -56, 26, -60, 29, -46);
          ctx.bezierCurveTo(32, -32, 24, -22, 12, -22);
          ctx.quadraticCurveTo(6, -32, 0, -34);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Razor bevel edge highlight
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(27, -48);
          ctx.quadraticCurveTo(30, -34, 16, -24);
          ctx.stroke();
          ctx.restore();
          ctx.restore();
        }

        // Head Accessories (Mahkota / Kacamata) positioned accurately on realistic head
        if (acc === 'mahkota_bintang') {
          ctx.fillStyle = makeLinearGrad(ctx, -12, -84, 12, -66, [
            [0, '#fef08a'],
            [0.5, '#fbbf24'],
            [1, '#b45309'],
          ]);
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-11, -68 + breath * 0.6);
          ctx.lineTo(-7, -81 + breath * 0.6);
          ctx.lineTo(0, -73 + breath * 0.6);
          ctx.lineTo(7, -81 + breath * 0.6);
          ctx.lineTo(11, -68 + breath * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (acc === 'kacamata_peneliti') {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(-7, -56 + breath * 0.6, 7, 5.5);
          ctx.strokeRect(3, -56 + breath * 0.6, 7, 5.5);
          ctx.beginPath();
          ctx.moveTo(0, -53 + breath * 0.6);
          ctx.lineTo(3, -53 + breath * 0.6);
          ctx.stroke();
        }

        // Hit Flash Overlay
        if (s.heroHitFlash > 0) {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
          ctx.beginPath();
          ctx.ellipse(0, -12, 42, 68, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Shield Dome
        if (s.shieldTimer > 0) {
          ctx.strokeStyle = '#38bdf8';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, -12, 54, 72, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      };

      const drawMonster = (ctx: CanvasRenderingContext2D, baseX: number, baseY: number) => {
        const { monster: m, reducedMotion: rm } = propsRef.current;
        const t = s.time;
        const isBoss = m.tier === 'boss';
        const scale = isBoss ? 1.15 : 1.0;
        const breath = rm ? 0 : Math.sin(t * 2.5 + 1) * 2.8;
        const bob = rm ? 0 : Math.sin(t * 2.6 + 1) * (isBoss ? 5 : 3.5);
        const lunge = s.monsterPose === 'attack' ? -42 : 0;
        const recoil = s.monsterPose === 'hit' ? 18 : 0;
        const defeatFade = s.monsterPose === 'defeat' ? Math.max(0.15, 1 - (5 - s.monsterPoseTimer) * 0.9) : 1;

        const x = baseX + s.monsterOffsetX + lunge + recoil;
        const y = baseY + bob + (s.monsterPose === 'defeat' ? 28 : 0);

        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = defeatFade;
        ctx.scale(scale, scale);

        // Windup telegraph glow
        if (s.monsterWindup > 0) {
          ctx.fillStyle = makeRadialGrad(ctx, 0, 0, 10, 0, 0, 76, [
            [0, 'rgba(244, 63, 94, 0.45)'],
            [1, 'rgba(244, 63, 94, 0)'],
          ]);
          ctx.beginPath();
          ctx.arc(0, 0, 76, 0, Math.PI * 2);
          ctx.fill();
        }

        // Ground Contact Shadow
        ctx.fillStyle = makeRadialGrad(ctx, 0, 58 - bob, 8, 0, 58 - bob, 60, [
          [0, 'rgba(2, 6, 23, 0.7)'],
          [0.7, 'rgba(2, 6, 23, 0.28)'],
          [1, 'rgba(2, 6, 23, 0)'],
        ]);
        ctx.beginPath();
        ctx.ellipse(0, 58 - bob, 60, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        const sx = s.monsterPose === 'hit' ? 1.1 : 1;
        const sy = s.monsterPose === 'hit' ? 0.9 : 1;
        ctx.scale(sx, sy);

        const arch = m.archetype;
        const flicker = rm ? 0 : Math.sin(t * 12) * 3.5;
        const flap = rm ? 0 : Math.sin(t * 7.5) * 14;

        if (arch === 'penjaga_sudut') {
          // === ULAR KOBRA BESAR BERWARNA HIJAU KUNING ===
          // Heavy coiled emerald serpent base
          const coilGrad = makeLinearGrad(ctx, -45, 22, 48, 56, [
            [0, '#4ade80'],
            [0.35, '#16a34a'],
            [0.8, '#14532d'],
            [1, '#052e16'],
          ]);
          ctx.strokeStyle = 'rgba(5, 46, 22, 0.75)';
          ctx.lineWidth = 1.6;
          // Back coil
          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          ctx.ellipse(8, 36, 48, 15, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Middle yellow-banded coil
          ctx.fillStyle = coilGrad;
          ctx.beginPath();
          ctx.ellipse(4, 43, 52, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Foreground yellow-belly tail tip
          ctx.fillStyle = makeLinearGrad(ctx, -50, 42, 34, 54, [
            [0, '#fde047'],
            [0.5, '#22c55e'],
            [1, '#14532d'],
          ]);
          ctx.beginPath();
          ctx.ellipse(-6, 49, 44, 10, 0.04, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Flared Green-and-Yellow Cobra Hood
          ctx.fillStyle = makeLinearGrad(ctx, -36, -54, 34, 28, [
            [0, '#4ade80'],
            [0.45, '#16a34a'],
            [1, '#14532d'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-18, 36);
          ctx.bezierCurveTo(-48, -4, -38, -56, -8, -58 + breath * 0.5);
          ctx.bezierCurveTo(22, -60, 44, -14, 20, 36);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Golden-Yellow Hood Spectacle Markings & Segmented Ventral Belly Scales
          ctx.fillStyle = makeLinearGrad(ctx, -10, -44, 12, 34, [
            [0, '#fef08a'],
            [0.5, '#facc15'],
            [1, '#ca8a04'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-12, 34);
          ctx.bezierCurveTo(-18, -4, -14, -36, -6, -44 + breath * 0.5);
          ctx.lineTo(8, -42 + breath * 0.5);
          ctx.bezierCurveTo(16, -24, 14, 4, 11, 34);
          ctx.closePath();
          ctx.fill();
          // Ventral scale lines
          ctx.strokeStyle = 'rgba(133, 77, 14, 0.65)';
          ctx.lineWidth = 1.4;
          for (let py = -30; py <= 28; py += 7.5) {
            ctx.beginPath();
            ctx.moveTo(-11, py);
            ctx.quadraticCurveTo(0, py + 2.5, 11, py);
            ctx.stroke();
          }
          // Hood yellow-ringed markings
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(-22, -24, 6, 0.3, Math.PI * 1.7);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(19, -20, 6, Math.PI * 1.3, Math.PI * 0.7);
          ctx.stroke();

          // Sculpted Reptilian Cobra Head facing left
          ctx.fillStyle = makeLinearGrad(ctx, -38, -62, 6, -34, [
            [0, '#4ade80'],
            [0.5, '#15803d'],
            [1, '#052e16'],
          ]);
          ctx.strokeStyle = 'rgba(5, 46, 22, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-40, -44 + breath * 0.5);
          ctx.quadraticCurveTo(-24, -64 + breath * 0.5, 2, -56 + breath * 0.5);
          ctx.quadraticCurveTo(10, -42, -4, -34 + breath * 0.5);
          ctx.lineTo(-34, -36 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Golden crown scales
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.ellipse(-10, -52 + breath * 0.5, 7, 3.2, -0.2, 0, Math.PI * 2);
          ctx.fill();
          // Viper Slit Eye
          drawRealisticEye(ctx, -24, -49 + breath * 0.5, 4.2, 3.4, '#facc15', -1, {
            slit: true,
            sclera: '#fef08a',
            glow: '#facc15',
          });
          // Curved ivory venom fangs & forked red tongue
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-36, -37 + breath * 0.5);
          ctx.lineTo(-34, -27 + breath * 0.5);
          ctx.lineTo(-31, -37 + breath * 0.5);
          ctx.fill();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.9;
          ctx.beginPath();
          ctx.moveTo(-39, -39 + breath * 0.5);
          ctx.quadraticCurveTo(-48, -34 + flicker * 0.4, -55, -36 + flicker * 0.5);
          ctx.lineTo(-61, -40 + flicker * 0.5);
          ctx.moveTo(-55, -36 + flicker * 0.5);
          ctx.lineTo(-60, -31 + flicker * 0.5);
          ctx.stroke();
        } else if (arch === 'naga_geometri') {
          // === NAGA BESAR BERWARNA MERAH DENGAN 4 KAKI DAN 2 SAYAP ===
          // 1. Back Crimson Wing (Sayap Belakang)
          ctx.fillStyle = makeLinearGrad(ctx, -6, -86 + flap * 0.6, 36, -6, [
            [0, '#450a0a'],
            [0.6, '#991b1b'],
            [1, '#7f1d1d'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-6, -12);
          ctx.lineTo(14, -84 + flap * 0.65);
          ctx.quadraticCurveTo(28, -58 + flap * 0.4, 42, -52 + flap * 0.5);
          ctx.quadraticCurveTo(28, -32, 16, -6);
          ctx.closePath();
          ctx.fill();

          // 2. Spiked Crimson Dragon Tail
          ctx.fillStyle = makeLinearGrad(ctx, 22, 12, 74, -24, [
            [0, '#dc2626'],
            [0.6, '#991b1b'],
            [1, '#450a0a'],
          ]);
          ctx.beginPath();
          ctx.moveTo(22, 8);
          ctx.bezierCurveTo(52, 22, 72, 10, 74, -22 + breath);
          ctx.lineTo(66, -16 + breath);
          ctx.bezierCurveTo(60, 4, 44, 10, 22, 20);
          ctx.closePath();
          ctx.fill();

          // 3. Far-side 2 Legs (Back-left & Back-right legs clearly visible = total 4 legs!)
          const drawDragonLeg = (lx: number, ly: number, dark: boolean) => {
            ctx.fillStyle = dark ? '#7f1d1d' : makeLinearGrad(ctx, lx - 6, ly, lx + 8, ly + 36, [
              [0, '#ef4444'],
              [0.5, '#b91c1c'],
              [1, '#7f1d1d'],
            ]);
            ctx.strokeStyle = 'rgba(69, 10, 10, 0.75)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(lx - 6, ly);
            ctx.lineTo(lx - 10, ly + 18);
            ctx.lineTo(lx - 6, ly + 34);
            ctx.lineTo(lx + 4, ly + 34);
            ctx.lineTo(lx + 8, ly + 16);
            ctx.lineTo(lx + 6, ly);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Ivory talons
            ctx.fillStyle = '#fef3c7';
            for (const cxOff of [-8, -2, 3]) {
              ctx.beginPath();
              ctx.moveTo(lx + cxOff, ly + 33);
              ctx.lineTo(lx + cxOff - 4, ly + 39);
              ctx.lineTo(lx + cxOff + 2, ly + 35);
              ctx.closePath();
              ctx.fill();
            }
          };
          drawDragonLeg(-18, 22, true); // Fore far leg
          drawDragonLeg(14, 22, true); // Hind far leg

          // 4. Muscular Red Dragon Torso + Golden Belly Plates
          ctx.fillStyle = makeLinearGrad(ctx, -30, -10, 28, 30, [
            [0, '#ef4444'],
            [0.5, '#dc2626'],
            [1, '#7f1d1d'],
          ]);
          ctx.strokeStyle = 'rgba(69, 10, 10, 0.8)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(2, 12, 36, 20, -0.06, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Golden segmented belly scales
          ctx.fillStyle = makeLinearGrad(ctx, -18, 16, 18, 30, [
            [0, '#fef08a'],
            [0.5, '#f59e0b'],
            [1, '#b45309'],
          ]);
          ctx.beginPath();
          ctx.ellipse(0, 22, 24, 9, -0.05, 0, Math.PI * 2);
          ctx.fill();

          // 5. Near-side 2 Legs (Total 4 clearly visible legs!)
          drawDragonLeg(-8, 22, false); // Fore near leg
          drawDragonLeg(25, 21, false); // Hind near leg

          // 6. Foreground Large Crimson Dragon Wing (Sayap Depan dengan tulang sayap)
          ctx.fillStyle = makeLinearGrad(ctx, 2, -16, 66, -72 + flap, [
            [0, '#b91c1c'],
            [0.55, '#ef4444'],
            [1, '#991b1b'],
          ]);
          ctx.beginPath();
          ctx.moveTo(2, -4);
          ctx.lineTo(38, -76 + flap);
          ctx.quadraticCurveTo(54, -52 + flap * 0.8, 70, -48 + flap * 0.7);
          ctx.quadraticCurveTo(54, -26 + flap * 0.4, 62, -12 + flap * 0.3);
          ctx.quadraticCurveTo(36, -6, 18, 6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#450a0a';
          ctx.lineWidth = 2;
          ctx.stroke();
          // Articulated Wing Finger Bones
          ctx.strokeStyle = '#7f1d1d';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(4, -3);
          ctx.lineTo(38, -76 + flap);
          ctx.moveTo(24, -44 + flap * 0.6);
          ctx.lineTo(68, -48 + flap * 0.7);
          ctx.moveTo(20, -30 + flap * 0.4);
          ctx.lineTo(60, -12 + flap * 0.3);
          ctx.stroke();

          // 7. Arched Neck & Sculpted Horned Dragon Skull facing left
          ctx.fillStyle = makeLinearGrad(ctx, -38, -48, -6, 8, [
            [0, '#ef4444'],
            [0.55, '#b91c1c'],
            [1, '#7f1d1d'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-20, 6);
          ctx.bezierCurveTo(-34, -12, -36, -30, -28, -42 + breath * 0.6);
          ctx.lineTo(-10, -34 + breath * 0.6);
          ctx.bezierCurveTo(-14, -18, -10, -4, -4, 6);
          ctx.closePath();
          ctx.fill();
          // Sculpted dragon head & jaw
          ctx.beginPath();
          ctx.moveTo(-58, -32 + breath * 0.6);
          ctx.lineTo(-42, -46 + breath * 0.6);
          ctx.lineTo(-22, -48 + breath * 0.6);
          ctx.lineTo(-12, -36 + breath * 0.6);
          ctx.lineTo(-22, -24 + breath * 0.6);
          ctx.lineTo(-52, -25 + breath * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(69, 10, 10, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Swept Ivory-Gold Dragon Horns
          ctx.fillStyle = makeLinearGrad(ctx, -24, -68, -14, -44, [
            [0, '#fef9c3'],
            [0.6, '#f59e0b'],
            [1, '#78350f'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-24, -46 + breath * 0.6);
          ctx.lineTo(-4, -68 + breath * 0.6);
          ctx.lineTo(-14, -42 + breath * 0.6);
          ctx.closePath();
          ctx.fill();
          // Glowing Slit Dragon Eye & Fangs
          drawRealisticEye(ctx, -34, -39 + breath * 0.6, 4, 3, '#f59e0b', -1, {
            slit: true,
            sclera: '#fef08a',
            glow: '#f59e0b',
          });
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-50, -25 + breath * 0.6);
          ctx.lineTo(-48, -19 + breath * 0.6);
          ctx.lineTo(-45, -25 + breath * 0.6);
          ctx.fill();
        } else if (arch === 'slime_angka') {
          // === MACAN TUTUL DENGAN EKOR YANG DIUJUNGNYA ADA APINYA ===
          // Long sinuous feline tail with blazing fire at the tip
          ctx.strokeStyle = makeLinearGrad(ctx, 28, 14, 58, -34, [
            [0, '#d97706'],
            [0.7, '#f59e0b'],
            [1, '#9a3412'],
          ]);
          ctx.lineWidth = 6.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(28, 12);
          ctx.bezierCurveTo(56, 14, 62, -6, 54, -32 + breath * 0.5);
          ctx.stroke();
          // Flame at the tip of the tail
          drawFlameTongue(ctx, 54, -30 + breath * 0.5, 18, 28 + flicker * 0.5, t * 9, 0.12);

          // 4 Muscular Leopard Legs (far & near)
          const drawLeopardLeg = (lx: number, ly: number, dark: boolean) => {
            ctx.fillStyle = dark ? '#b45309' : makeLinearGrad(ctx, lx - 5, ly, lx + 5, ly + 32, [
              [0, '#fbbf24'],
              [0.6, '#d97706'],
              [1, '#92400e'],
            ]);
            ctx.beginPath();
            ctx.moveTo(lx - 5, ly);
            ctx.lineTo(lx - 6, ly + 18);
            ctx.lineTo(lx - 4, ly + 31);
            ctx.lineTo(lx + 4, ly + 31);
            ctx.lineTo(lx + 6, ly + 16);
            ctx.lineTo(lx + 5, ly);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(lx - 1, ly + 31, 6, 3.2, 0, 0, Math.PI * 2);
            ctx.fill();
          };
          drawLeopardLeg(-16, 20, true);
          drawLeopardLeg(16, 20, true);

          // Sleek Muscular Leopard Torso
          ctx.fillStyle = makeLinearGrad(ctx, -28, -4, 28, 26, [
            [0, '#fcd34d'],
            [0.5, '#f59e0b'],
            [1, '#b45309'],
          ]);
          ctx.strokeStyle = 'rgba(69, 26, 3, 0.7)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(3, 12, 34, 17, -0.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Cream belly highlight
          ctx.fillStyle = 'rgba(254, 243, 199, 0.55)';
          ctx.beginPath();
          ctx.ellipse(2, 22, 22, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Near legs
          drawLeopardLeg(-6, 20, false);
          drawLeopardLeg(25, 19, false);

          // Authentic Leopard Rosette Spots (dark ring + tawny center)
          for (const [rx, ry] of [
            [-12, 6],
            [-2, 13],
            [8, 5],
            [17, 13],
            [24, 6],
            [4, 18],
            [-18, 14],
          ]) {
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(rx, ry, 3.6, 0, Math.PI * 1.65);
            ctx.stroke();
            ctx.fillStyle = '#92400e';
            ctx.beginPath();
            ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Sculpted Leopard Neck & Feline Head facing left
          ctx.fillStyle = makeRadialGrad(ctx, -28, -16, 3, -24, -12, 22, [
            [0, '#fde68a'],
            [0.6, '#f59e0b'],
            [1, '#b45309'],
          ]);
          // Ears
          ctx.beginPath();
          ctx.ellipse(-34, -27 + breath * 0.5, 4.5, 5.5, -0.4, 0, Math.PI * 2);
          ctx.ellipse(-18, -28 + breath * 0.5, 4.5, 5.5, 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Cranium & Muzzle
          ctx.beginPath();
          ctx.ellipse(-27, -12 + breath * 0.5, 17, 14.5, -0.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.ellipse(-36, -7 + breath * 0.5, 8.5, 6.2, 0, 0, Math.PI * 2);
          ctx.fill();
          // Predator eyes, dark nose & whiskers
          drawRealisticEye(ctx, -35, -16 + breath * 0.5, 3.2, 2.5, '#d97706', -1, { slit: true, sclera: '#fef08a' });
          drawRealisticEye(ctx, -24, -16 + breath * 0.5, 3.2, 2.5, '#d97706', -1, { slit: true, sclera: '#fef08a' });
          ctx.fillStyle = '#451a03';
          ctx.beginPath();
          ctx.moveTo(-42, -9 + breath * 0.5);
          ctx.lineTo(-37, -9 + breath * 0.5);
          ctx.lineTo(-39.5, -6 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-41, -7 + breath * 0.5);
          ctx.lineTo(-52, -9 + breath * 0.5);
          ctx.moveTo(-41, -5 + breath * 0.5);
          ctx.lineTo(-51, -3 + breath * 0.5);
          ctx.stroke();
        } else if (arch === 'raja_slime') {
          // === SINGA YANG BULU-BULUNYA BERBENTUK SEPERTI API ===
          // Lion Tail with Fiery Tuft
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 4.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(28, 12);
          ctx.quadraticCurveTo(54, 6, 52, -18);
          ctx.stroke();
          drawFlameTongue(ctx, 52, -16, 14, 22 + flicker * 0.4, t * 10);

          // 4 Lion Legs (far & near)
          const drawLionLeg = (lx: number, ly: number, dark: boolean) => {
            ctx.fillStyle = dark ? '#b45309' : makeLinearGrad(ctx, lx - 6, ly, lx + 6, ly + 32, [
              [0, '#fcd34d'],
              [0.6, '#d97706'],
              [1, '#78350f'],
            ]);
            ctx.beginPath();
            ctx.roundRect(lx - 5.5, ly, 11, 30, 4);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(lx - 1, ly + 30, 7, 3.8, 0, 0, Math.PI * 2);
            ctx.fill();
          };
          drawLionLeg(-16, 20, true);
          drawLionLeg(16, 20, true);

          // Muscular Golden Lion Body
          ctx.fillStyle = makeLinearGrad(ctx, -28, -4, 28, 28, [
            [0, '#fde68a'],
            [0.45, '#f59e0b'],
            [1, '#92400e'],
          ]);
          ctx.strokeStyle = 'rgba(69, 26, 3, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(4, 12, 34, 19, -0.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          drawLionLeg(-6, 20, false);
          drawLionLeg(25, 20, false);

          // Blazing Multi-Layered Fire Mane (bulu-bulunya berbentuk seperti api)
          const maneCx = -24;
          const maneCy = -14 + breath * 0.5;
          for (let i = 0; i < 14; i++) {
            const ang = (i * Math.PI * 2) / 14;
            const fx = maneCx + Math.cos(ang) * 20;
            const fy = maneCy + Math.sin(ang) * 20;
            drawFlameTongue(ctx, fx, fy, 16, 22 + ((i % 2) * 5 + flicker * 0.4), t * 8 + i, ang + Math.PI / 2);
          }
          // Glowing ember core under lion face
          ctx.fillStyle = makeRadialGrad(ctx, maneCx, maneCy, 8, maneCx, maneCy, 26, [
            [0, '#fde047'],
            [0.55, '#f97316'],
            [1, '#b91c1c'],
          ]);
          ctx.beginPath();
          ctx.arc(maneCx, maneCy, 24, 0, Math.PI * 2);
          ctx.fill();

          // Lion Head & Snout facing left
          ctx.fillStyle = makeRadialGrad(ctx, maneCx - 3, maneCy - 3, 2, maneCx, maneCy, 18, [
            [0, '#fde68a'],
            [0.65, '#f59e0b'],
            [1, '#b45309'],
          ]);
          ctx.beginPath();
          ctx.arc(maneCx, maneCy, 16.5, 0, Math.PI * 2);
          ctx.fill();
          // Muzzle & roaring fangs
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.ellipse(maneCx - 6, maneCy + 5, 9, 6.5, 0, 0, Math.PI * 2);
          ctx.fill();
          drawRealisticEye(ctx, maneCx - 9, maneCy - 4, 3.2, 2.5, '#d97706', -1, { sclera: '#fef9c3', glow: '#f59e0b' });
          drawRealisticEye(ctx, maneCx + 3, maneCy - 4, 3.2, 2.5, '#d97706', -1, { sclera: '#fef9c3', glow: '#f59e0b' });
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.moveTo(maneCx - 9, maneCy + 2);
          ctx.lineTo(maneCx - 3, maneCy + 2);
          ctx.lineTo(maneCx - 6, maneCy + 5);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(maneCx - 11, maneCy + 8);
          ctx.lineTo(maneCx - 9, maneCy + 14);
          ctx.lineTo(maneCx - 7, maneCy + 8);
          ctx.moveTo(maneCx - 3, maneCy + 8);
          ctx.lineTo(maneCx - 1, maneCy + 14);
          ctx.lineTo(maneCx + 1, maneCy + 8);
          ctx.fill();
        } else if (arch === 'kelelawar_pecahan') {
          // === KELELAWAR UNGU TERBANG SAYAPNYA & GIGI BERTARING PANJANG ===
          ctx.save();
          ctx.translate(0, -14 + breath * 1.4);

          const drawBatWing = (dir: number) => {
            ctx.fillStyle = makeLinearGrad(ctx, dir * 10, -10, dir * 74, -20 + flap, [
              [0, '#581c87'],
              [0.55, '#7e22ce'],
              [1, '#3b0764'],
            ]);
            ctx.strokeStyle = '#1e1b4b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(dir * 12, -8);
            ctx.lineTo(dir * 42, -38 + flap * 0.7);
            ctx.lineTo(dir * 74, -22 + flap);
            ctx.quadraticCurveTo(dir * 54, 4 + flap * 0.4, dir * 48, 22 + flap * 0.3);
            ctx.quadraticCurveTo(dir * 34, 8 + flap * 0.2, dir * 28, 20);
            ctx.quadraticCurveTo(dir * 18, 10, dir * 12, 16);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Articulated wing bones
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(dir * 12, -6);
            ctx.lineTo(dir * 42, -38 + flap * 0.7);
            ctx.lineTo(dir * 74, -22 + flap);
            ctx.moveTo(dir * 42, -38 + flap * 0.7);
            ctx.lineTo(dir * 48, 21 + flap * 0.3);
            ctx.moveTo(dir * 42, -38 + flap * 0.7);
            ctx.lineTo(dir * 28, 19);
            ctx.stroke();
          };

          drawBatWing(-1);
          drawBatWing(1);

          // Furred Purple Bat Torso & Clawed Feet
          ctx.fillStyle = makeRadialGrad(ctx, -4, -4, 4, 0, 2, 28, [
            [0, '#a855f7'],
            [0.55, '#7e22ce'],
            [1, '#3b0764'],
          ]);
          ctx.strokeStyle = '#1e1b4b';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(0, 4, 20, 25, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Sculpted Large Bat Ears
          ctx.beginPath();
          ctx.moveTo(-14, -14);
          ctx.lineTo(-22, -44);
          ctx.lineTo(-4, -20);
          ctx.closePath();
          ctx.moveTo(14, -14);
          ctx.lineTo(22, -44);
          ctx.lineTo(4, -20);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Pinkish-plum inner ear
          ctx.fillStyle = '#c084fc';
          ctx.beginPath();
          ctx.moveTo(-13, -18);
          ctx.lineTo(-19, -37);
          ctx.lineTo(-7, -21);
          ctx.closePath();
          ctx.moveTo(13, -18);
          ctx.lineTo(19, -37);
          ctx.lineTo(7, -21);
          ctx.closePath();
          ctx.fill();

          // Glowing Predator Eyes
          drawRealisticEye(ctx, -8, -8, 3.8, 3, '#f59e0b', -1, { slit: true, sclera: '#fef08a', glow: '#facc15' });
          drawRealisticEye(ctx, 8, -8, 3.8, 3, '#f59e0b', -1, { slit: true, sclera: '#fef08a', glow: '#facc15' });

          // Bat nose-leaf & Open Jaw with LONG SHARP WHITE FANGS (bertaring panjang)
          ctx.fillStyle = '#4c1d95';
          ctx.beginPath();
          ctx.moveTo(-3, -2);
          ctx.lineTo(0, -7);
          ctx.lineTo(3, -2);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.ellipse(0, 8, 12, 7.5, 0, 0, Math.PI);
          ctx.fill();
          // Long glossy fangs
          ctx.fillStyle = makeLinearGrad(ctx, 0, 5, 0, 23, [
            [0, '#ffffff'],
            [1, '#cbd5e1'],
          ]);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(-10, 6);
          ctx.lineTo(-6.5, 24);
          ctx.lineTo(-3, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(3, 6);
          ctx.lineTo(6.5, 24);
          ctx.lineTo(10, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if (arch === 'golem_pecahan') {
          // === MONSTER BERBENTUK MANUSIA TAPI TUBUHNYA TERBUAT DARI BATU ===
          const stoneGrad = makeLinearGrad(ctx, -38, -56, 38, 52, [
            [0, '#94a3b8'],
            [0.45, '#64748b'],
            [1, '#334155'],
          ]);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.8;

          // Muscular Stone Legs
          ctx.fillStyle = stoneGrad;
          ctx.beginPath();
          ctx.moveTo(-22, 18);
          ctx.lineTo(-26, 54);
          ctx.lineTo(-8, 55);
          ctx.lineTo(-4, 22);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(4, 22);
          ctx.lineTo(8, 55);
          ctx.lineTo(26, 54);
          ctx.lineTo(22, 18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Broad Chiseled Humanoid Stone Torso
          ctx.beginPath();
          ctx.moveTo(-34, -28 + breath * 0.4);
          ctx.lineTo(34, -28 + breath * 0.4);
          ctx.lineTo(24, 20);
          ctx.lineTo(-24, 20);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Craggy Stone Shoulder Boulders & Articulated Arms + Stone Fists
          const drawStoneArm = (dir: number) => {
            ctx.fillStyle = stoneGrad;
            ctx.beginPath();
            ctx.ellipse(dir * 38, -22 + breath * 0.4, 14, 12, dir * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.roundRect(dir === -1 ? -52 : 34, -14 + breath * 0.4, 18, 24, 4);
            ctx.fill();
            ctx.stroke();
            // Clenched boulder fist
            ctx.beginPath();
            ctx.roundRect(dir === -1 ? -54 : 33, 8 + breath * 0.4, 20, 18, 5);
            ctx.fill();
            ctx.stroke();
          };
          drawStoneArm(-1);
          drawStoneArm(1);

          // Sculpted Stone Humanoid Head
          ctx.fillStyle = makeLinearGrad(ctx, -16, -62, 16, -30, [
            [0, '#cbd5e1'],
            [0.5, '#64748b'],
            [1, '#334155'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-16, -54 + breath * 0.5);
          ctx.lineTo(-8, -62 + breath * 0.5);
          ctx.lineTo(8, -62 + breath * 0.5);
          ctx.lineTo(16, -54 + breath * 0.5);
          ctx.lineTo(14, -30 + breath * 0.5);
          ctx.lineTo(-14, -30 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Glowing Cyan Arcane Fissures & Core + Eyes
          ctx.strokeStyle = '#38bdf8';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-22, -16);
          ctx.lineTo(-6, -2);
          ctx.lineTo(-12, 14);
          ctx.moveTo(20, -18);
          ctx.lineTo(6, -4);
          ctx.stroke();
          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.arc(0, -2, 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.ellipse(-6.5, -45 + breath * 0.5, 3.6, 2.2, 0.1, 0, Math.PI * 2);
          ctx.ellipse(6.5, -45 + breath * 0.5, 3.6, 2.2, -0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (arch === 'serigala_persamaan') {
          // === SERIGALA ABU-ABU GIGI TARING & KUKU TAJAM, BULU DISELIMUTI SALJU ===
          // Bushy Ash-Gray Tail with White Snow Mantle
          ctx.fillStyle = makeLinearGrad(ctx, 26, 8, 62, 16, [
            [0, '#64748b'],
            [0.65, '#94a3b8'],
            [1, '#f8fafc'],
          ]);
          ctx.beginPath();
          ctx.moveTo(28, 6);
          ctx.bezierCurveTo(56, -8, 66, 8, 56, 24);
          ctx.quadraticCurveTo(40, 26, 26, 18);
          ctx.closePath();
          ctx.fill();
          // Snow cap on tail
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(46, 4, 14, 5, 0.25, 0, Math.PI * 2);
          ctx.fill();

          // 4 Wolf Legs with LONG SHARP WHITE CLAWS (kuku-kuku tajam)
          const drawWolfLeg = (lx: number, ly: number, dark: boolean) => {
            ctx.fillStyle = dark ? '#475569' : makeLinearGrad(ctx, lx - 5, ly, lx + 5, ly + 31, [
              [0, '#94a3b8'],
              [0.6, '#64748b'],
              [1, '#334155'],
            ]);
            ctx.beginPath();
            ctx.moveTo(lx - 5, ly);
            ctx.lineTo(lx - 7, ly + 17);
            ctx.lineTo(lx - 4, ly + 30);
            ctx.lineTo(lx + 4, ly + 30);
            ctx.lineTo(lx + 6, ly + 15);
            ctx.lineTo(lx + 5, ly);
            ctx.closePath();
            ctx.fill();
            // Sharp gleaming white claws
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 0.8;
            for (const cOff of [-7, -2, 3]) {
              ctx.beginPath();
              ctx.moveTo(lx + cOff, ly + 29);
              ctx.lineTo(lx + cOff - 6, ly + 35);
              ctx.lineTo(lx + cOff + 2, ly + 31);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
          };
          drawWolfLeg(-16, 20, true);
          drawWolfLeg(16, 20, true);

          // Muscular Gray Wolf Body
          ctx.fillStyle = makeLinearGrad(ctx, -30, -4, 30, 26, [
            [0, '#cbd5e1'],
            [0.45, '#64748b'],
            [1, '#334155'],
          ]);
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(4, 12, 35, 18, -0.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Near Wolf Legs
          drawWolfLeg(-6, 20, false);
          drawWolfLeg(25, 19, false);

          // Thick Snow Mantle Covering Back & Neck Ruff (bulunya diselimuti salju)
          ctx.fillStyle = makeLinearGrad(ctx, -20, -10, 32, 12, [
            [0, '#ffffff'],
            [0.65, '#e0f2fe'],
            [1, '#cbd5e1'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-22, 0);
          ctx.bezierCurveTo(-10, -10, 14, -12, 34, 2);
          ctx.quadraticCurveTo(22, 13, 12, 8);
          ctx.quadraticCurveTo(2, 15, -8, 9);
          ctx.quadraticCurveTo(-18, 12, -22, 0);
          ctx.closePath();
          ctx.fill();

          // Fierce Gray Wolf Head, Pointed Ears & Elongated Snout
          ctx.fillStyle = makeLinearGrad(ctx, -46, -24, -10, -2, [
            [0, '#cbd5e1'],
            [0.5, '#64748b'],
            [1, '#475569'],
          ]);
          // Pointed furred ears
          ctx.beginPath();
          ctx.moveTo(-28, -22 + breath * 0.5);
          ctx.lineTo(-32, -44 + breath * 0.5);
          ctx.lineTo(-18, -28 + breath * 0.5);
          ctx.closePath();
          ctx.moveTo(-16, -22 + breath * 0.5);
          ctx.lineTo(-10, -43 + breath * 0.5);
          ctx.lineTo(-4, -22 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Cranium & Elongated Snout
          ctx.beginPath();
          ctx.moveTo(-50, -10 + breath * 0.5);
          ctx.lineTo(-36, -18 + breath * 0.5);
          ctx.quadraticCurveTo(-24, -32 + breath * 0.5, -10, -24 + breath * 0.5);
          ctx.quadraticCurveTo(-4, -8, -18, 0 + breath * 0.5);
          ctx.lineTo(-46, -3 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Snow crown on head
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(-22, -25 + breath * 0.5, 9, 4, -0.1, 0, Math.PI * 2);
          ctx.fill();
          // Wet Black Nose & Ice-Blue Eyes
          ctx.fillStyle = '#020617';
          ctx.beginPath();
          ctx.ellipse(-49, -10 + breath * 0.5, 3, 2.2, 0, 0, Math.PI * 2);
          ctx.fill();
          drawRealisticEye(ctx, -29, -18 + breath * 0.5, 3.2, 2.4, '#0284c7', -1, {
            sclera: '#e0f2fe',
            glow: '#38bdf8',
          });
          // Sharp White Wolf Fangs (gigi taring tajam)
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-45, -3 + breath * 0.5);
          ctx.lineTo(-43, 5 + breath * 0.5);
          ctx.lineTo(-40, -3 + breath * 0.5);
          ctx.moveTo(-36, -3 + breath * 0.5);
          ctx.lineTo(-34, 4 + breath * 0.5);
          ctx.lineTo(-31, -3 + breath * 0.5);
          ctx.fill();
        } else if (arch === 'raksasa_aljabar') {
          // === MANUSIA BERTUBUH BESAR BERJUBAH PUTIH & TONGKAT SALJU ===
          // Towering Broad-Shouldered White Robe Silhouette
          ctx.fillStyle = makeLinearGrad(ctx, -36, -36, 36, 56, [
            [0, '#ffffff'],
            [0.55, '#e2e8f0'],
            [1, '#94a3b8'],
          ]);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-24, -36 + breath * 0.4);
          ctx.lineTo(24, -36 + breath * 0.4);
          ctx.bezierCurveTo(32, -4, 38, 26, 40, 56);
          ctx.quadraticCurveTo(0, 62, -40, 56);
          ctx.bezierCurveTo(-38, 26, -32, -4, -24, -36 + breath * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Draped Ice-Blue Ceremonial Stole & Fur Shoulder Mantle
          ctx.fillStyle = makeLinearGrad(ctx, 0, -34, 0, 56, [
            [0, '#38bdf8'],
            [0.6, '#0284c7'],
            [1, '#0369a1'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-9, -34 + breath * 0.4);
          ctx.lineTo(9, -34 + breath * 0.4);
          ctx.lineTo(13, 57);
          ctx.lineTo(-13, 57);
          ctx.closePath();
          ctx.fill();
          // Fur shoulder mantle
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.ellipse(0, -34 + breath * 0.4, 28, 8.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#cbd5e1';
          ctx.stroke();

          // Giant Weathered Human Face & Flowing Frost Beard
          drawHumanFace(ctx, -1, -55 + breath * 0.5, {
            feminine: false,
            irisColor: '#0284c7',
            browColor: '#e2e8f0',
            skinTone: 'weathered',
            stern: true,
          });
          // Full sculpted white beard
          ctx.fillStyle = makeLinearGrad(ctx, 0, -44, 0, -14, [
            [0, '#ffffff'],
            [0.6, '#e0f2fe'],
            [1, '#94a3b8'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-13, -44 + breath * 0.5);
          ctx.quadraticCurveTo(-14, -24, 0, -14 + breath * 0.5);
          ctx.quadraticCurveTo(14, -24, 13, -44 + breath * 0.5);
          ctx.quadraticCurveTo(0, -38, -13, -44 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          // White brows & hair
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(0, -63 + breath * 0.5, 14, Math.PI, 0);
          ctx.fill();

          // Broad Arm Holding Frost-Crystal Staff Emitting Swirling Snow
          ctx.fillStyle = '#f1f5f9';
          ctx.beginPath();
          ctx.roundRect(-40, -24 + breath * 0.4, 18, 12, 5);
          ctx.fill();
          ctx.fillStyle = '#dca47c';
          ctx.beginPath();
          ctx.arc(-40, -18 + breath * 0.4, 4.5, 0, Math.PI * 2);
          ctx.fill();
          // Frost Staff
          ctx.strokeStyle = makeLinearGrad(ctx, -40, -68, -40, 56, [
            [0, '#bae6fd'],
            [0.5, '#38bdf8'],
            [1, '#0c4a6e'],
          ]);
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-42, 54);
          ctx.lineTo(-40, -60);
          ctx.stroke();
          // Crystalline Snow Orb at Top
          ctx.shadowColor = '#7dd3fc';
          ctx.shadowBlur = 16;
          ctx.fillStyle = makeRadialGrad(ctx, -40, -66, 2, -40, -66, 12, [
            [0, '#ffffff'],
            [0.5, '#7dd3fc'],
            [1, '#0284c7'],
          ]);
          ctx.beginPath();
          ctx.arc(-40, -66, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Swirling Snowflakes Released from Staff (tongkat mengeluarkan salju)
          for (let i = 0; i < 7; i++) {
            const ang = t * 2.2 + i * 0.9;
            const rad = 18 + (i % 3) * 11;
            const sxPos = -40 + Math.cos(ang) * rad;
            const syPos = -58 + Math.sin(ang * 1.1) * (rad * 0.85) + (i % 2) * 14;
            drawSnowflake(ctx, sxPos, syPos, 4.5, 0.78);
          }
        } else if (arch === 'burung_teka_teki') {
          // === BURUNG PHOENIX MERAH DENGAN EKOR BERBENTUK API ===
          ctx.save();
          ctx.translate(0, -10 + breath);

          // Flowing Multi-Plume Flame Tail (ekor berbentuk api)
          drawFlameTongue(ctx, 26, 22, 24, 52 + flicker * 0.7, t * 7, 1.05);
          drawFlameTongue(ctx, 24, 28, 20, 44 + flicker * 0.6, t * 8 + 1.5, 1.32);
          drawFlameTongue(ctx, 22, 16, 18, 42 + flicker * 0.5, t * 9 + 3, 0.78);

          // Back Red Feathered Wing
          ctx.fillStyle = makeLinearGrad(ctx, 6, -4, 58, -46 + flap, [
            [0, '#991b1b'],
            [0.6, '#dc2626'],
            [1, '#f97316'],
          ]);
          ctx.beginPath();
          ctx.moveTo(6, -6);
          ctx.bezierCurveTo(28, -44 + flap * 0.8, 56, -50 + flap, 64, -26 + flap * 0.7);
          ctx.lineTo(44, -8 + flap * 0.4);
          ctx.lineTo(52, 4 + flap * 0.2);
          ctx.lineTo(22, 12);
          ctx.closePath();
          ctx.fill();

          // Feathered Crimson Phoenix Body
          ctx.fillStyle = makeLinearGrad(ctx, -18, -24, 20, 26, [
            [0, '#ef4444'],
            [0.55, '#dc2626'],
            [1, '#7f1d1d'],
          ]);
          ctx.beginPath();
          ctx.ellipse(0, 6, 18, 25, 0.15, 0, Math.PI * 2);
          ctx.fill();

          // Front Scarlet Feathered Wing
          ctx.fillStyle = makeLinearGrad(ctx, -4, -4, -64, -40 + flap, [
            [0, '#dc2626'],
            [0.55, '#ef4444'],
            [1, '#f59e0b'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-6, -4);
          ctx.bezierCurveTo(-28, -40 + flap * 0.8, -58, -44 + flap, -66, -20 + flap * 0.7);
          ctx.lineTo(-46, -4 + flap * 0.4);
          ctx.lineTo(-52, 10 + flap * 0.2);
          ctx.lineTo(-18, 14);
          ctx.closePath();
          ctx.fill();

          // Sculpted Raptor Head, Crown Plumes & Sharp Golden Beak
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(-6, -24, 13.5, 0, Math.PI * 2);
          ctx.fill();
          // Golden crest feathers
          ctx.fillStyle = makeLinearGrad(ctx, -4, -36, 16, -54, [
            [0, '#fef08a'],
            [0.6, '#f59e0b'],
            [1, '#dc2626'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-6, -34);
          ctx.quadraticCurveTo(4, -56, 16, -50);
          ctx.quadraticCurveTo(6, -38, 4, -30);
          ctx.closePath();
          ctx.fill();
          // Curved Golden Eagle Beak
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(-17, -26);
          ctx.quadraticCurveTo(-30, -25, -33, -16);
          ctx.quadraticCurveTo(-24, -19, -17, -18);
          ctx.closePath();
          ctx.fill();
          // Fierce Golden Eye & Talons
          drawRealisticEye(ctx, -12, -25, 3.2, 2.6, '#f59e0b', -1, { sclera: '#fef08a', glow: '#facc15' });
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(-6, 28);
          ctx.lineTo(-10, 40);
          ctx.moveTo(4, 28);
          ctx.lineTo(2, 40);
          ctx.stroke();
          ctx.restore();
        } else if (arch === 'penyihir_logika') {
          // === PENYIHIR DENGAN JUBAH HITAM YANG MEMEGANG TONGKAT SIHIR ===
          // Obsidian Black Flowing Wizard Robe with Dramatic Folds
          ctx.fillStyle = makeLinearGrad(ctx, -32, -32, 32, 56, [
            [0, '#1e293b'],
            [0.4, '#0f172a'],
            [1, '#020617'],
          ]);
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-14, -32 + breath * 0.5);
          ctx.lineTo(14, -32 + breath * 0.5);
          ctx.bezierCurveTo(22, -4, 30, 26, 34, 56);
          ctx.quadraticCurveTo(0, 62, -34, 56);
          ctx.bezierCurveTo(-30, 26, -22, -4, -14, -32 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Deep velvet mantle folds
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-6, -20);
          ctx.quadraticCurveTo(-14, 18, -16, 52);
          ctx.moveTo(6, -20);
          ctx.quadraticCurveTo(14, 18, 16, 52);
          ctx.stroke();

          // Pale Shadowed Face under Dark Sorcerer Hood/Hat
          ctx.fillStyle = makeRadialGrad(ctx, -2, -48, 2, 0, -46, 16, [
            [0, '#e2e8f0'],
            [0.6, '#94a3b8'],
            [1, '#334155'],
          ]);
          ctx.beginPath();
          ctx.ellipse(0, -47 + breath * 0.5, 11.5, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          // Glowing Amethyst Eyes
          drawRealisticEye(ctx, -4.5, -48 + breath * 0.5, 2.7, 2, '#9333ea', -1, {
            sclera: '#e9d5ff',
            glow: '#c084fc',
          });
          drawRealisticEye(ctx, 4.5, -48 + breath * 0.5, 2.7, 2, '#9333ea', -1, {
            sclera: '#e9d5ff',
            glow: '#c084fc',
          });

          // Black Pointed Sorcerer Hat & Brim
          ctx.fillStyle = '#020617';
          ctx.strokeStyle = '#9333ea';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(0, -56 + breath * 0.5, 27, 5.5, 0.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-16, -57 + breath * 0.5);
          ctx.bezierCurveTo(-10, -76, -2, -92, 6, -100 + breath * 0.5);
          ctx.lineTo(16, -57 + breath * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Dark Robed Arm Gripping Twisted Magic Wand / Staff
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(-34, -22 + breath * 0.5, 18, 11, 4);
          ctx.fill();
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(-34, -16 + breath * 0.5, 4, 0, Math.PI * 2);
          ctx.fill();
          // Ebony Magic Staff & Crackling Violet Crystal
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 4.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-36, 52);
          ctx.lineTo(-34, -46);
          ctx.stroke();
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 16;
          ctx.fillStyle = makeRadialGrad(ctx, -34, -53, 1, -34, -52, 11, [
            [0, '#ffffff'],
            [0.45, '#c084fc'],
            [1, '#6b21a8'],
          ]);
          ctx.beginPath();
          ctx.moveTo(-34, -65);
          ctx.lineTo(-26, -52);
          ctx.lineTo(-34, -42);
          ctx.lineTo(-42, -52);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // === RAJA MATEMATIKA: MALAIKAT BERSAYAP BERWARNA PUTIH ===
          // Radiant Golden Halo
          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 14;
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, -78 + breath * 0.5, 17, 4.5, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Expansive Layered Pure-White Feathered Angel Wings
          const drawAngelWing = (dir: number) => {
            ctx.fillStyle = makeLinearGrad(ctx, dir * 10, -34, dir * 74, 24, [
              [0, '#ffffff'],
              [0.65, '#f1f5f9'],
              [1, '#bae6fd'],
            ]);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(dir * 10, -24);
            ctx.bezierCurveTo(dir * 38, -68 + flap * 0.45, dir * 76, -54 + flap * 0.55, dir * 78, -10 + flap * 0.35);
            ctx.lineTo(dir * 66, 2 + flap * 0.25);
            ctx.lineTo(dir * 68, 16 + flap * 0.2);
            ctx.lineTo(dir * 52, 22 + flap * 0.15);
            ctx.quadraticCurveTo(dir * 30, 26, dir * 10, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Sculpted individual plumage arcs
            ctx.strokeStyle = 'rgba(125, 211, 252, 0.5)';
            ctx.lineWidth = 1.2;
            for (let f = 0; f < 4; f++) {
              ctx.beginPath();
              ctx.moveTo(dir * (20 + f * 9), -18 + f * 6);
              ctx.quadraticCurveTo(dir * (48 + f * 5), -14 + f * 9 + flap * 0.25, dir * (62 - f * 4), 10 + f * 4);
              ctx.stroke();
            }
          };

          drawAngelWing(-1);
          drawAngelWing(1);

          // Pure White & Gold Celestial Robes
          ctx.fillStyle = makeLinearGrad(ctx, -22, -32, 24, 58, [
            [0, '#ffffff'],
            [0.6, '#f8fafc'],
            [1, '#cbd5e1'],
          ]);
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(-14, -32 + breath * 0.4);
          ctx.lineTo(14, -32 + breath * 0.4);
          ctx.bezierCurveTo(20, -4, 24, 26, 27, 56);
          ctx.quadraticCurveTo(0, 62, -27, 56);
          ctx.bezierCurveTo(-24, 26, -20, -4, -14, -32 + breath * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Gold celestial sash & collar
          ctx.fillStyle = makeLinearGrad(ctx, 0, -32, 0, 56, [
            [0, '#fef08a'],
            [0.5, '#f59e0b'],
            [1, '#b45309'],
          ]);
          ctx.fillRect(-5, -32 + breath * 0.4, 10, 89);

          // Serene Angel Face & Golden Hair
          drawHumanFace(ctx, 0, -52 + breath * 0.5, {
            feminine: false,
            irisColor: '#0284c7',
            browColor: '#b45309',
            skinTone: 'fair',
          });
          ctx.fillStyle = makeLinearGrad(ctx, -14, -70, 14, -50, [
            [0, '#fef08a'],
            [0.6, '#f59e0b'],
            [1, '#b45309'],
          ]);
          ctx.beginPath();
          ctx.arc(0, -57 + breath * 0.5, 13.5, Math.PI, 0);
          ctx.fill();
        }

        // Hit Flash
        if (s.monsterHitFlash > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.beginPath();
          ctx.arc(0, -10, 56, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      };

      const render = (now: number) => {
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(rawDt, 0.05);

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            if (s.hitstop > 0) {
              s.hitstop -= dt;
            } else {
              s.time += dt;
              s.heroOffsetX += (0 - s.heroOffsetX) * Math.min(1, dt * 8);
              s.monsterOffsetX += (0 - s.monsterOffsetX) * Math.min(1, dt * 8);

              if (s.heroPoseTimer > 0) {
                s.heroPoseTimer -= dt;
                if (s.heroPoseTimer <= 0 && s.heroPose !== 'victory' && s.heroPose !== 'defeat') {
                  s.heroPose = 'idle';
                }
              }
              if (s.monsterPoseTimer > 0) {
                s.monsterPoseTimer -= dt;
                if (s.monsterPoseTimer <= 0 && s.monsterPose !== 'defeat') {
                  s.monsterPose = 'idle';
                }
              }
              if (s.heroHitFlash > 0) s.heroHitFlash -= dt;
              if (s.monsterHitFlash > 0) s.monsterHitFlash -= dt;
              if (s.monsterWindup > 0) s.monsterWindup -= dt;
              if (s.shieldTimer > 0) s.shieldTimer -= dt;
              if (s.shakeTime > 0) s.shakeTime -= dt;

              // Update Projectiles
              for (let i = s.projectiles.length - 1; i >= 0; i--) {
                const p = s.projectiles[i];
                p.progress += dt / p.duration;
                p.x = p.startX + (p.targetX - p.startX) * Math.min(1, p.progress);
                p.y =
                  p.startY +
                  (p.targetY - p.startY) * Math.min(1, p.progress) -
                  Math.sin(Math.min(1, p.progress) * Math.PI) * 32;
                if (p.progress >= 1) {
                  s.monsterPose = 'hit';
                  s.monsterPoseTimer = 0.35;
                  s.monsterHitFlash = 0.22;
                  s.hitstop = p.isCrit ? 0.065 : 0.04;
                  s.shakeTime = 0.22;
                  s.shakeIntensity = p.isCrit ? 10 : 6;
                  spawnBurst(p.targetX, p.targetY, p.color, p.isCrit ? 26 : 16);
                  s.floatingNumbers.push({
                    x: p.targetX,
                    y: p.targetY - 60,
                    vy: -65,
                    text: p.isCrit ? `KRITIS! -${p.damage}` : `-${p.damage}`,
                    color: p.isCrit ? '#fde047' : '#ffffff',
                    life: 0,
                    maxLife: 1.05,
                    scale: p.isCrit ? 1.3 : 1.05,
                  });
                  s.projectiles.splice(i, 1);
                }
              }

              // Update Particles
              for (let i = s.particles.length - 1; i >= 0; i--) {
                const pt = s.particles[i];
                pt.life += dt;
                pt.x += pt.vx * dt;
                pt.y += pt.vy * dt;
                pt.vy += 240 * dt;
                pt.alpha = Math.max(0, 1 - pt.life / pt.maxLife);
                if (pt.life >= pt.maxLife) s.particles.splice(i, 1);
              }

              // Update Floating Numbers
              for (let i = s.floatingNumbers.length - 1; i >= 0; i--) {
                const fn = s.floatingNumbers[i];
                fn.life += dt;
                fn.y += fn.vy * dt;
                fn.vy *= 0.96;
                if (fn.life >= fn.maxLife) s.floatingNumbers.splice(i, 1);
              }
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            if (s.shakeTime > 0 && !propsRef.current.reducedMotion) {
              const mag = s.shakeIntensity * (s.shakeTime / 0.22);
              ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
            }

            if (propsRef.current.animationQuality === 'penuh' && !propsRef.current.reducedMotion) {
              for (const m of s.ambientParticles) {
                const py = m.y + Math.sin(s.time * 1.4 + m.phase) * 14;
                const px = (m.x + s.time * m.speed) % canvas.width;
                ctx.fillStyle = propsRef.current.accentColor;
                ctx.globalAlpha = 0.28 + 0.2 * Math.sin(s.time * 2 + m.phase);
                ctx.beginPath();
                ctx.arc(px, py, m.r, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.globalAlpha = 1;
            }

            // Draw Characters with Grounded Proportion
            drawHero(ctx, 235, 250);
            drawMonster(ctx, 725, 242);

            // Draw Projectiles
            for (const p of s.projectiles) {
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.fillStyle = p.color;
              ctx.shadowColor = p.color;
              ctx.shadowBlur = 16;
              if (p.style === 'tebasan') {
                ctx.strokeStyle = '#fef08a';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(0, 0, 24, -Math.PI * 0.45, Math.PI * 0.45);
                ctx.stroke();
              } else if (p.style === 'panah_cahaya') {
                ctx.fillStyle = '#34d399';
                ctx.beginPath();
                ctx.moveTo(22, 0);
                ctx.lineTo(-14, -8);
                ctx.lineTo(-14, 8);
                ctx.closePath();
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            }

            // Draw Particles
            for (const pt of s.particles) {
              ctx.save();
              ctx.globalAlpha = pt.alpha;
              ctx.fillStyle = pt.color;
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }

            // Draw Floating Numbers
            for (const fn of s.floatingNumbers) {
              ctx.save();
              ctx.globalAlpha = Math.max(0, 1 - fn.life / fn.maxLife);
              ctx.font = `800 ${Math.round(24 * fn.scale)}px "JetBrains Mono", monospace`;
              ctx.textAlign = 'center';
              ctx.lineWidth = 5;
              ctx.strokeStyle = '#020617';
              ctx.strokeText(fn.text, fn.x, fn.y);
              ctx.fillStyle = fn.color;
              ctx.fillText(fn.text, fn.x, fn.y);
              ctx.restore();
            }

            ctx.restore();
          }
        }
        rafId = requestAnimationFrame(render);
      };

      rafId = requestAnimationFrame(render);
      return () => cancelAnimationFrame(rafId);
    }, []);

    return (
      <div
        className="relative w-full h-full overflow-hidden select-none"
        style={{ background: fallbackGradient }}
      >
        <img
          src={bgImage}
          alt="Latar Arena Pertarungan"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-90"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(2,6,23,0.45) 0%, rgba(2,6,23,0.08) 45%, rgba(2,6,23,0.55) 100%)',
          }}
        />
        <canvas
          ref={canvasRef}
          width={960}
          height={340}
          className="relative z-10 w-full h-full object-contain pointer-events-none"
        />
      </div>
    );
  }
);

BattleCanvas.displayName = 'BattleCanvas';
