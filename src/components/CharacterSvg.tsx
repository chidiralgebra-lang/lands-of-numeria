import React, { useId } from 'react';
import { HeroId, MonsterArchetype } from '../types/game';

export const TitleCrestSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 640 210"
    className={className}
    role="img"
    aria-label="LANDS of NUMERIA: Math Monster Adventure"
  >
    <defs>
      <linearGradient id="goldTitleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="cyanRuneGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="50%" stopColor="#a7f3d0" />
        <stop offset="100%" stopColor="#38bdf8" />
      </linearGradient>
      <filter id="titleDrop" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#020617" floodOpacity="0.85" />
      </filter>
    </defs>

    {/* Crest Shield Emblem */}
    <g transform="translate(26, 20)" filter="url(#titleDrop)">
      <path
        d="M44 4 L84 18 L78 68 C74 96 44 114 44 114 C44 114 14 96 10 68 L4 18 Z"
        fill="#1e293b"
        stroke="url(#goldTitleGrad)"
        strokeWidth="4"
      />
      <path
        d="M44 16 L72 26 L67 64 C64 84 44 98 44 98 C44 98 24 84 21 64 L16 26 Z"
        fill="#0f172a"
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeOpacity="0.6"
      />
      {/* Crossed Sword & Pi Rune */}
      <path d="M26 78 L64 32" stroke="#e2e8f0" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M58 28 L66 30 L64 38" fill="#fbbf24" />
      <text
        x="44"
        y="68"
        textAnchor="middle"
        fill="url(#goldTitleGrad)"
        fontSize="36"
        fontWeight="800"
        fontFamily="Cinzel, Georgia, serif"
      >
        π
      </text>
    </g>

    {/* Title Typography */}
    <g filter="url(#titleDrop)">
      <text
        x="130"
        y="64"
        fill="#e0f2fe"
        fontSize="16"
        fontWeight="700"
        letterSpacing="4.5"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        PETUALANGAN EDUKASI FANTASI
      </text>
      <text
        x="128"
        y="112"
        fill="url(#goldTitleGrad)"
        fontSize="44"
        fontWeight="800"
        letterSpacing="2"
        fontFamily="Cinzel, Georgia, serif"
      >
        LANDS of NUMERIA
      </text>
      <line x1="130" y1="128" x2="595" y2="128" stroke="url(#cyanRuneGrad)" strokeWidth="2" strokeOpacity="0.7" />
      <text
        x="130"
        y="162"
        fill="#f8fafc"
        fontSize="24"
        fontWeight="700"
        letterSpacing="3"
        fontFamily="Cinzel, Georgia, serif"
      >
        MATH MONSTER ADVENTURE
      </text>
    </g>
  </svg>
);

export const HeroPortraitSvg: React.FC<{ heroId: HeroId; className?: string }> = ({
  heroId,
  className = 'w-16 h-16',
}) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `hero-clip-${uid}`;
  const skinId = `hero-skin-${uid}`;
  const metalId = `hero-metal-${uid}`;
  const accentId = `hero-accent-${uid}`;
  const bgId = `hero-bg-${uid}`;

  if (heroId === 'ksatria') {
    return (
      <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <circle cx="60" cy="60" r="52" />
          </clipPath>
          <radialGradient id={bgId} cx="42%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="65%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
          <linearGradient id={metalId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="45%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id={skinId} x1="25%" y1="15%" x2="80%" y2="90%">
            <stop offset="0%" stopColor="#fde2c4" />
            <stop offset="58%" stopColor="#f0b789" />
            <stop offset="100%" stopColor="#c47e50" />
          </linearGradient>
          <linearGradient id={accentId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="55" fill={`url(#${bgId})`} stroke={`url(#${accentId})`} strokeWidth="4" />
        <g clipPath={`url(#${clipId})`}>
          {/* Royal cape behind shoulders */}
          <path d="M16 116 C20 76 96 76 104 116 Z" fill="#1d4ed8" />
          {/* Gleaming Steel Knight Broadsword at right */}
          <g transform="translate(93, 66) rotate(12)">
            <polygon points="-4,-52 0,-64 4,-52 4,0 -4,0" fill={`url(#${metalId})`} stroke="#1e293b" strokeWidth="1.2" />
            <line x1="0" y1="-50" x2="0" y2="-4" stroke="#475569" strokeWidth="1" />
            <path d="M-11 -1 Q0 -5 11 -1 L9 3 Q0 0 -9 3 Z" fill={`url(#${accentId})`} />
            <rect x="-2.2" y="3" width="4.4" height="12" fill="#451a03" />
            <circle cx="0" cy="17" r="3.5" fill="#fbbf24" />
          </g>
          {/* Sculpted Knight Breastplate & Pauldrons */}
          <path d="M22 116 L28 76 L56 68 L84 76 L90 116 Z" fill={`url(#${metalId})`} stroke="#1e293b" strokeWidth="1.5" />
          <path d="M56 70 L56 114" stroke="#475569" strokeWidth="1.4" />
          <path d="M44 84 L68 84" stroke="#f59e0b" strokeWidth="2" />
          <ellipse cx="28" cy="78" rx="13" ry="8" transform="rotate(-14 28 78)" fill={`url(#${metalId})`} stroke="#f59e0b" strokeWidth="1.6" />
          <ellipse cx="84" cy="78" rx="13" ry="8" transform="rotate(14 84 78)" fill={`url(#${metalId})`} stroke="#f59e0b" strokeWidth="1.6" />
          {/* Neck */}
          <rect x="48" y="60" width="16" height="14" rx="4" fill="#c47e50" />
          {/* Male Face (Chiseled Jaw, Nose, Realistic Eyes) */}
          <path d="M39 38 C39 23 73 23 73 38 L71 56 C70 63 63 67 56 67 C49 67 42 63 41 56 Z" fill={`url(#${skinId})`} stroke="#7c2d12" strokeWidth="1.1" />
          <path d="M41 37 C46 30 66 30 71 37 C66 28 46 28 41 37 Z" fill="#451a03" />
          {/* Determined brows */}
          <path d="M44 43 L52 45 M68 43 L60 45" stroke="#451a03" strokeWidth="2.4" strokeLinecap="round" />
          {/* Realistic eyes */}
          <ellipse cx="48.5" cy="48.5" rx="3.4" ry="2.2" fill="#f8fafc" />
          <circle cx="49" cy="48.5" r="1.9" fill="#2563eb" />
          <circle cx="49" cy="48.5" r="1" fill="#020617" />
          <circle cx="48.2" cy="47.8" r="0.6" fill="#ffffff" />
          <ellipse cx="63.5" cy="48.5" rx="3.4" ry="2.2" fill="#f8fafc" />
          <circle cx="64" cy="48.5" r="1.9" fill="#2563eb" />
          <circle cx="64" cy="48.5" r="1" fill="#020617" />
          <circle cx="63.2" cy="47.8" r="0.6" fill="#ffffff" />
          {/* Nose & firm mouth */}
          <path d="M56 47 L57.5 54 Q56 55.5 54 54.5" fill="none" stroke="#9a3412" strokeWidth="1.2" strokeOpacity="0.6" />
          <path d="M51 59.5 Q56 61 61 59.5" fill="none" stroke="#9a3412" strokeWidth="1.5" strokeLinecap="round" />
          {/* Open Steel Knight Helm + Gold Plume */}
          <path d="M52 12 C42 8 36 16 40 24 L56 24 Z" fill={`url(#${accentId})`} />
          <path d="M36 44 C35 20 77 20 76 44 L73 42 L70 62 L65 62 L66 37 L46 37 L47 62 L42 62 L39 42 Z" fill={`url(#${metalId})`} stroke="#1e293b" strokeWidth="1.5" />
          <path d="M46 37 L66 37" stroke="#f59e0b" strokeWidth="2" />
        </g>
      </svg>
    );
  }

  if (heroId === 'penyihir') {
    return (
      <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <circle cx="60" cy="60" r="52" />
          </clipPath>
          <radialGradient id={bgId} cx="45%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#581c87" />
            <stop offset="65%" stopColor="#2e1065" />
            <stop offset="100%" stopColor="#090418" />
          </radialGradient>
          <linearGradient id={skinId} x1="25%" y1="15%" x2="80%" y2="90%">
            <stop offset="0%" stopColor="#fff1e6" />
            <stop offset="55%" stopColor="#fbd3b6" />
            <stop offset="100%" stopColor="#d49a74" />
          </linearGradient>
          <linearGradient id={accentId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="60%" stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
          <radialGradient id={metalId} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#0891b2" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="55" fill={`url(#${bgId})`} stroke="#22d3ee" strokeWidth="4" />
        <g clipPath={`url(#${clipId})`}>
          {/* Long Flowing Female Hair */}
          <path d="M35 42 C22 62 20 92 26 116 L88 116 C94 92 92 62 79 42 Z" fill="#3b0764" />
          <path d="M34 48 C27 68 27 92 32 110 M80 48 C87 68 87 92 82 110" stroke="#a855f7" strokeWidth="2.2" fill="none" strokeOpacity="0.6" />
          {/* Layered Silk Mage Robe */}
          <path d="M29 116 C34 76 80 76 85 116 Z" fill={`url(#${accentId})`} stroke="#1e1b4b" strokeWidth="1.5" />
          <path d="M49 77 L57 98 L65 77 Z" fill="#0891b2" />
          <path d="M47 77 L57 99 L67 77" fill="none" stroke="#fbbf24" strokeWidth="1.6" />
          {/* Neck */}
          <rect x="51" y="61" width="12" height="14" rx="4" fill="#d49a74" />
          {/* Feminine Face */}
          <path d="M41 44 C41 31 73 31 73 44 C73 57 66 66 57 66 C48 66 41 57 41 44 Z" fill={`url(#${skinId})`} stroke="#9a3412" strokeWidth="1" strokeOpacity="0.5" />
          {/* Front side hair framing cheeks */}
          <path d="M40 42 Q47 38 57 42 Q67 38 74 42 Q71 31 57 31 Q43 31 40 42 Z" fill="#4c1d95" />
          <path d="M40 42 Q37 56 41 66 Q45 55 44 43 Z" fill="#4c1d95" />
          <path d="M74 42 Q77 56 73 66 Q69 55 70 43 Z" fill="#4c1d95" />
          {/* Expressive Female Eyes with Lashes & Blush */}
          <ellipse cx="49.5" cy="49.5" rx="3.4" ry="2.4" fill="#f8fafc" />
          <circle cx="50" cy="49.5" r="2" fill="#06b6d4" />
          <circle cx="50" cy="49.5" r="1" fill="#020617" />
          <circle cx="49.2" cy="48.7" r="0.65" fill="#ffffff" />
          <path d="M45.5 47.6 Q49.5 46 53 47.8" fill="none" stroke="#1e1b4b" strokeWidth="1.4" />
          <ellipse cx="64.5" cy="49.5" rx="3.4" ry="2.4" fill="#f8fafc" />
          <circle cx="65" cy="49.5" r="2" fill="#06b6d4" />
          <circle cx="65" cy="49.5" r="1" fill="#020617" />
          <circle cx="64.2" cy="48.7" r="0.65" fill="#ffffff" />
          <path d="M61 47.8 Q64.5 46 68.5 47.6" fill="none" stroke="#1e1b4b" strokeWidth="1.4" />
          <ellipse cx="46" cy="54.5" rx="3.2" ry="1.8" fill="#fb7185" fillOpacity="0.28" />
          <ellipse cx="68" cy="54.5" rx="3.2" ry="1.8" fill="#fb7185" fillOpacity="0.28" />
          <path d="M53.5 59.5 Q57 61.8 60.5 59.5" fill="none" stroke="#be123c" strokeWidth="1.6" strokeLinecap="round" />
          {/* Pointed Wizard Hat */}
          <ellipse cx="57" cy="39" rx="31" ry="6.5" fill="#4c1d95" stroke="#22d3ee" strokeWidth="1.3" />
          <path d="M36 39 C40 24 47 14 55 6 C63 14 70 24 78 39 Z" fill={`url(#${accentId})`} stroke="#1e1b4b" strokeWidth="1.3" />
          <rect x="40" y="34" width="34" height="4.5" rx="1" fill="#22d3ee" />
          {/* Ornate Arcane Staff + Crystal Orb */}
          <line x1="94" y1="38" x2="90" y2="112" stroke="#78350f" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="94" cy="34" r="10.5" fill={`url(#${metalId})`} stroke="#cffafe" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  if (heroId === 'penjelajah') {
    return (
      <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <circle cx="60" cy="60" r="52" />
          </clipPath>
          <radialGradient id={bgId} cx="45%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#065f46" />
            <stop offset="65%" stopColor="#022c22" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
          <linearGradient id={skinId} x1="25%" y1="15%" x2="80%" y2="90%">
            <stop offset="0%" stopColor="#fde2c4" />
            <stop offset="58%" stopColor="#f0b789" />
            <stop offset="100%" stopColor="#c47e50" />
          </linearGradient>
          <linearGradient id={accentId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="55%" stopColor="#047857" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="55" fill={`url(#${bgId})`} stroke="#fbbf24" strokeWidth="4" />
        <g clipPath={`url(#${clipId})`}>
          {/* Quiver behind shoulder */}
          <g transform="translate(26, 62) rotate(-22)">
            <rect x="-6" y="-12" width="12" height="36" rx="3" fill="#78350f" stroke="#1e293b" strokeWidth="1.2" />
            <rect x="-4" y="-20" width="3" height="9" fill="#fbbf24" />
            <rect x="1" y="-22" width="3" height="11" fill="#f8fafc" />
          </g>
          {/* Cloak & Studded Leather Ranger Tunic */}
          <path d="M24 116 C28 74 84 74 88 116 Z" fill={`url(#${accentId})`} stroke="#022c22" strokeWidth="1.5" />
          <path d="M36 77 L68 114" stroke="#92400e" strokeWidth="5.5" strokeLinecap="round" />
          {/* Deep Emerald Hood Backdrop */}
          <path d="M30 72 C28 24 84 24 82 72 L72 80 L40 80 Z" fill="#022c22" />
          {/* Feminine Archer Face inside Hood */}
          <path d="M41 50 C41 37 71 37 71 50 C71 62 64 69 56 69 C48 69 41 62 41 50 Z" fill={`url(#${skinId})`} stroke="#7c2d12" strokeWidth="1" strokeOpacity="0.45" />
          {/* Auburn hair locks */}
          <path d="M40 48 Q48 40 56 44 Q64 40 72 48 Q69 37 56 37 Q43 37 40 48 Z" fill="#b45309" />
          <path d="M39 50 Q37 60 41 68" stroke="#b45309" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M73 50 Q75 60 71 68" stroke="#b45309" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          {/* Keen Hazel Eyes */}
          <ellipse cx="49" cy="54" rx="3.2" ry="2.2" fill="#f8fafc" />
          <circle cx="49.5" cy="54" r="1.9" fill="#d97706" />
          <circle cx="49.5" cy="54" r="0.95" fill="#020617" />
          <circle cx="48.8" cy="53.3" r="0.6" fill="#ffffff" />
          <ellipse cx="63" cy="54" rx="3.2" ry="2.2" fill="#f8fafc" />
          <circle cx="63.5" cy="54" r="1.9" fill="#d97706" />
          <circle cx="63.5" cy="54" r="0.95" fill="#020617" />
          <circle cx="62.8" cy="53.3" r="0.6" fill="#ffffff" />
          <path d="M52.5 63 Q56 65 59.5 63" fill="none" stroke="#be123c" strokeWidth="1.5" strokeLinecap="round" />
          {/* Pointed Emerald Hood Framing Face */}
          <path d="M32 74 C24 44 36 20 56 16 C76 20 88 44 80 74 C76 58 70 42 56 40 C42 42 36 58 32 74 Z" fill={`url(#${accentId})`} stroke="#022c22" strokeWidth="1.5" />
          <path d="M44 20 L56 8 L68 20 Z" fill="#059669" />
          {/* Recurve Bow & Nocked Arrow */}
          <path d="M84 26 Q106 60 84 96" fill="none" stroke="#f59e0b" strokeWidth="4.2" strokeLinecap="round" />
          <line x1="84" y1="26" x2="77" y2="61" stroke="#e2e8f0" strokeWidth="1.5" />
          <line x1="77" y1="61" x2="84" y2="96" stroke="#e2e8f0" strokeWidth="1.5" />
          <line x1="77" y1="61" x2="104" y2="61" stroke="#fef3c7" strokeWidth="2.4" />
          <polygon points="103,57 111,61 103,65" fill="#e2e8f0" />
        </g>
      </svg>
    );
  }

  // Penjaga Hutan -> Male Elf with Long Ears & Battle Axe
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx="60" cy="60" r="52" />
        </clipPath>
        <radialGradient id={bgId} cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#365314" />
          <stop offset="65%" stopColor="#1a2e05" />
          <stop offset="100%" stopColor="#090f02" />
        </radialGradient>
        <linearGradient id={skinId} x1="25%" y1="15%" x2="80%" y2="90%">
          <stop offset="0%" stopColor="#fde2c4" />
          <stop offset="58%" stopColor="#f0b789" />
          <stop offset="100%" stopColor="#c47e50" />
        </linearGradient>
        <linearGradient id={metalId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id={accentId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="60%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="55" fill={`url(#${bgId})`} stroke="#34d399" strokeWidth="4" />
      <g clipPath={`url(#${clipId})`}>
        {/* Woodland Tunic & Leather Shoulder */}
        <path d="M24 116 C28 74 84 74 88 116 Z" fill="#047857" stroke="#022c22" strokeWidth="1.5" />
        <path d="M40 76 L56 96 L72 76" fill="#78350f" />
        {/* Neck */}
        <rect x="49" y="61" width="14" height="15" rx="4" fill="#c47e50" />
        {/* Long Pointed Male Elf Ears */}
        <path d="M40 48 Q24 42 12 37 Q24 51 39 56 Z" fill={`url(#${skinId})`} stroke="#7c2d12" strokeWidth="1.2" />
        <path d="M72 48 Q88 42 100 37 Q88 51 73 56 Z" fill={`url(#${skinId})`} stroke="#7c2d12" strokeWidth="1.2" />
        {/* Male Elf Chiseled Face */}
        <path d="M39 44 C39 29 73 29 73 44 C73 59 64 68 56 68 C48 68 39 59 39 44 Z" fill={`url(#${skinId})`} stroke="#7c2d12" strokeWidth="1.1" />
        {/* Swept Male Golden-Amber Elf Hair */}
        <path d="M37 46 C36 22 76 22 75 46 L68 38 L60 44 L52 37 L44 43 Z" fill={`url(#${accentId})`} stroke="#78350f" strokeWidth="1.2" />
        {/* Stern Brows & Emerald Eyes */}
        <path d="M44 46 L52 48 M68 46 L60 48" stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" />
        <ellipse cx="48.5" cy="51.5" rx="3.3" ry="2.2" fill="#f8fafc" />
        <circle cx="49" cy="51.5" r="1.9" fill="#10b981" />
        <circle cx="49" cy="51.5" r="0.95" fill="#020617" />
        <circle cx="48.3" cy="50.8" r="0.6" fill="#ffffff" />
        <ellipse cx="63.5" cy="51.5" rx="3.3" ry="2.2" fill="#f8fafc" />
        <circle cx="64" cy="51.5" r="1.9" fill="#10b981" />
        <circle cx="64" cy="51.5" r="0.95" fill="#020617" />
        <circle cx="63.3" cy="50.8" r="0.6" fill="#ffffff" />
        <path d="M51.5 61 Q56 62.5 60.5 61" fill="none" stroke="#9a3412" strokeWidth="1.4" strokeLinecap="round" />
        {/* Woodland Steel Battle Axe */}
        <g transform="translate(88, 66) rotate(12)">
          <line x1="0" y1="-44" x2="0" y2="42" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
          <path d="M0,-38 C14,-44 24,-34 22,-18 C14,-11 6,-14 0,-19 Z" fill={`url(#${metalId})`} stroke="#1e293b" strokeWidth="1.4" />
          <path d="M18,-36 C22,-28 21,-21 16,-15" fill="none" stroke="#ffffff" strokeWidth="1.8" />
        </g>
      </g>
    </svg>
  );
};

export const MonsterBadgeSvg: React.FC<{ archetype: MonsterArchetype; className?: string }> = ({
  archetype,
  className = 'w-12 h-12',
}) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `mon-clip-${uid}`;
  const bgId = `mon-bg-${uid}`;
  const g1 = `mon-g1-${uid}`;
  const g2 = `mon-g2-${uid}`;

  const isBoss =
    archetype === 'raja_slime' ||
    archetype === 'golem_pecahan' ||
    archetype === 'naga_geometri' ||
    archetype === 'raksasa_aljabar' ||
    archetype === 'penyihir_logika' ||
    archetype === 'raja_matematika';

  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx="60" cy="60" r="52" />
        </clipPath>
        <radialGradient id={bgId} cx="45%" cy="35%" r="72%">
          <stop offset="0%" stopColor={isBoss ? '#4c0519' : '#1e293b'} />
          <stop offset="70%" stopColor={isBoss ? '#25040d' : '#0f172a'} />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <linearGradient id={g1} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop
            offset="0%"
            stopColor={
              archetype === 'penjaga_sudut'
                ? '#4ade80'
                : archetype === 'naga_geometri' || archetype === 'burung_teka_teki'
                ? '#ef4444'
                : archetype === 'slime_angka' || archetype === 'raja_slime'
                ? '#fde047'
                : archetype === 'kelelawar_pecahan'
                ? '#a855f7'
                : archetype === 'golem_pecahan' || archetype === 'serigala_persamaan'
                ? '#cbd5e1'
                : archetype === 'raksasa_aljabar' || archetype === 'raja_matematika'
                ? '#ffffff'
                : '#334155'
            }
          />
          <stop
            offset="100%"
            stopColor={
              archetype === 'penjaga_sudut'
                ? '#14532d'
                : archetype === 'naga_geometri' || archetype === 'burung_teka_teki'
                ? '#7f1d1d'
                : archetype === 'slime_angka' || archetype === 'raja_slime'
                ? '#b45309'
                : archetype === 'kelelawar_pecahan'
                ? '#4c1d95'
                : archetype === 'golem_pecahan' || archetype === 'serigala_persamaan'
                ? '#334155'
                : archetype === 'raksasa_aljabar' || archetype === 'raja_matematika'
                ? '#94a3b8'
                : '#020617'
            }
          />
        </linearGradient>
        <linearGradient id={g2} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#b91c1c" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fef08a" />
        </linearGradient>
      </defs>

      <circle
        cx="60"
        cy="60"
        r="55"
        fill={`url(#${bgId})`}
        stroke={isBoss ? '#f59e0b' : '#38bdf8'}
        strokeWidth="4"
      />

      <g clipPath={`url(#${clipId})`}>
        {/* Slime Angka -> Macan tutul ekor api */}
        {archetype === 'slime_angka' && (
          <g>
            {/* Curved leopard tail with flame tip */}
            <path d="M74 82 Q102 74 96 46" fill="none" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
            <path d="M88 46 Q86 28 97 18 Q108 30 102 48 Z" fill={`url(#${g2})`} />
            <ellipse cx="52" cy="79" rx="26" ry="14" fill={`url(#${g1})`} stroke="#451a03" strokeWidth="1.4" />
            {/* Rosette spots */}
            <circle cx="42" cy="76" r="3.4" fill="none" stroke="#451a03" strokeWidth="2" />
            <circle cx="56" cy="82" r="3.4" fill="none" stroke="#451a03" strokeWidth="2" />
            <circle cx="67" cy="74" r="3.4" fill="none" stroke="#451a03" strokeWidth="2" />
            {/* Leopard head & ears */}
            <ellipse cx="36" cy="36" rx="5.5" ry="6.5" fill="#d97706" stroke="#451a03" strokeWidth="1.2" />
            <ellipse cx="64" cy="36" rx="5.5" ry="6.5" fill="#d97706" stroke="#451a03" strokeWidth="1.2" />
            <ellipse cx="50" cy="52" rx="18" ry="16" fill={`url(#${g1})`} stroke="#451a03" strokeWidth="1.4" />
            <ellipse cx="50" cy="58" rx="9" ry="6" fill="#fef3c7" />
            <ellipse cx="43" cy="49" rx="3" ry="2.2" fill="#fef08a" />
            <ellipse cx="43" cy="49" rx="0.9" ry="2" fill="#0f172a" />
            <ellipse cx="57" cy="49" rx="3" ry="2.2" fill="#fef08a" />
            <ellipse cx="57" cy="49" rx="0.9" ry="2" fill="#0f172a" />
            <polygon points="47,55 53,55 50,59" fill="#451a03" />
          </g>
        )}

        {/* Raja Slime -> Singa bersurai api */}
        {archetype === 'raja_slime' && (
          <g>
            {/* Flame-shaped lion mane */}
            <path
              d="M60,12 L68,26 L84,18 L80,36 L98,42 L84,56 L96,74 L76,76 L72,94 L60,82 L48,94 L44,76 L24,74 L36,56 L22,42 L40,36 L36,18 L52,26 Z"
              fill={`url(#${g2})`}
              stroke="#fde047"
              strokeWidth="1.6"
            />
            <circle cx="60" cy="58" r="22" fill={`url(#${g1})`} stroke="#78350f" strokeWidth="1.4" />
            <ellipse cx="60" cy="65" rx="11" ry="7" fill="#fef3c7" />
            <ellipse cx="51" cy="54" rx="3.4" ry="2.5" fill="#fef08a" />
            <circle cx="51" cy="54" r="1.4" fill="#0f172a" />
            <ellipse cx="69" cy="54" rx="3.4" ry="2.5" fill="#fef08a" />
            <circle cx="69" cy="54" r="1.4" fill="#0f172a" />
            <polygon points="56,61 64,61 60,65" fill="#78350f" />
            <polygon points="53,68 55,75 57,68" fill="#ffffff" />
            <polygon points="63,68 65,75 67,68" fill="#ffffff" />
          </g>
        )}

        {/* Kelelawar Pecahan -> Kelelawar ungu terbang bertaring panjang */}
        {archetype === 'kelelawar_pecahan' && (
          <g>
            <path d="M46 56 L10 34 L22 70 L36 62 L46 66 Z" fill="#6b21a8" stroke="#1e1b4b" strokeWidth="1.5" />
            <path d="M74 56 L110 34 L98 70 L84 62 L74 66 Z" fill="#6b21a8" stroke="#1e1b4b" strokeWidth="1.5" />
            <polygon points="44,40 38,18 54,36" fill="#9333ea" stroke="#1e1b4b" strokeWidth="1.3" />
            <polygon points="76,40 82,18 66,36" fill="#9333ea" stroke="#1e1b4b" strokeWidth="1.3" />
            <ellipse cx="60" cy="58" rx="18" ry="22" fill={`url(#${g1})`} stroke="#1e1b4b" strokeWidth="1.5" />
            <ellipse cx="52" cy="51" rx="3.5" ry="2.6" fill="#fef08a" />
            <ellipse cx="52" cy="51" rx="1" ry="2.2" fill="#0f172a" />
            <ellipse cx="68" cy="51" rx="3.5" ry="2.6" fill="#fef08a" />
            <ellipse cx="68" cy="51" rx="1" ry="2.2" fill="#0f172a" />
            {/* Long fangs */}
            <path d="M48 63 A12 7 0 0 0 72 63 Z" fill="#1e1b4b" />
            <polygon points="50,63 53,79 56,63" fill="#ffffff" />
            <polygon points="64,63 67,79 70,63" fill="#ffffff" />
          </g>
        )}

        {/* Golem Pecahan -> Manusia batu */}
        {archetype === 'golem_pecahan' && (
          <g>
            <path d="M32 54 L88 54 L80 100 L40 100 Z" fill={`url(#${g1})`} stroke="#0f172a" strokeWidth="1.6" />
            <rect x="18" y="56" width="14" height="36" rx="4" fill="#475569" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="88" y="56" width="14" height="36" rx="4" fill="#475569" stroke="#0f172a" strokeWidth="1.5" />
            <polygon points="45,26 75,26 78,52 42,52" fill={`url(#${g1})`} stroke="#0f172a" strokeWidth="1.6" />
            <ellipse cx="52" cy="39" rx="4" ry="2.4" fill="#38bdf8" />
            <ellipse cx="68" cy="39" rx="4" ry="2.4" fill="#38bdf8" />
            <path d="M42 66 L58 76 L50 94" stroke="#38bdf8" strokeWidth="2.2" fill="none" />
            <circle cx="60" cy="76" r="6" fill="#38bdf8" />
          </g>
        )}

        {/* Penjaga Sudut -> Ular kobra besar hijau kuning */}
        {archetype === 'penjaga_sudut' && (
          <g>
            <ellipse cx="60" cy="92" rx="34" ry="11" fill="#15803d" stroke="#052e16" strokeWidth="1.5" />
            <path d="M38 88 C22 50 32 24 60 24 C88 24 98 50 82 88 Z" fill={`url(#${g1})`} stroke="#052e16" strokeWidth="1.6" />
            <path d="M49 86 L53 38 L67 38 L71 86 Z" fill="#facc15" />
            <path d="M51 50 L69 50 M50 62 L70 62 M49 74 L71 74" stroke="#a16207" strokeWidth="1.6" />
            <ellipse cx="60" cy="36" rx="15" ry="11" fill="#16a34a" stroke="#052e16" strokeWidth="1.5" />
            <ellipse cx="53" cy="35" rx="3.2" ry="2.4" fill="#fef08a" />
            <rect x="52.3" y="32.5" width="1.4" height="5" fill="#052e16" />
            <ellipse cx="67" cy="35" rx="3.2" ry="2.4" fill="#fef08a" />
            <rect x="66.3" y="32.5" width="1.4" height="5" fill="#052e16" />
            <path d="M60 46 L60 56 L56 60 M60 56 L64 60" stroke="#ef4444" strokeWidth="2.2" fill="none" />
          </g>
        )}

        {/* Naga Geometri -> Naga merah besar berkaki 4 dan bersayap 2 */}
        {archetype === 'naga_geometri' && (
          <g>
            <path d="M48 52 L14 24 L26 62 Z" fill="#991b1b" stroke="#450a0a" strokeWidth="1.4" />
            <path d="M72 52 L106 24 L94 62 Z" fill="#991b1b" stroke="#450a0a" strokeWidth="1.4" />
            <ellipse cx="60" cy="68" rx="26" ry="17" fill={`url(#${g1})`} stroke="#450a0a" strokeWidth="1.5" />
            <ellipse cx="60" cy="75" rx="17" ry="7" fill="#fbbf24" />
            {/* 4 Dragon legs */}
            <rect x="37" y="80" width="7" height="16" rx="2" fill="#991b1b" />
            <rect x="48" y="81" width="7" height="16" rx="2" fill="#991b1b" />
            <rect x="65" y="81" width="7" height="16" rx="2" fill="#991b1b" />
            <rect x="76" y="80" width="7" height="16" rx="2" fill="#991b1b" />
            {/* Horns & dragon head */}
            <polygon points="48,32 38,14 54,28" fill="#fbbf24" />
            <polygon points="72,32 82,14 66,28" fill="#fbbf24" />
            <ellipse cx="60" cy="42" rx="15" ry="12" fill={`url(#${g1})`} stroke="#450a0a" strokeWidth="1.5" />
            <ellipse cx="53" cy="40" rx="3" ry="2.2" fill="#fef08a" />
            <ellipse cx="53" cy="40" rx="0.9" ry="2" fill="#0f172a" />
            <ellipse cx="67" cy="40" rx="3" ry="2.2" fill="#fef08a" />
            <ellipse cx="67" cy="40" rx="0.9" ry="2" fill="#0f172a" />
          </g>
        )}

        {/* Serigala Persamaan -> Serigala abu-abu berselimut salju, taring & cakar tajam */}
        {archetype === 'serigala_persamaan' && (
          <g>
            <ellipse cx="64" cy="76" rx="26" ry="15" fill={`url(#${g1})`} stroke="#1e293b" strokeWidth="1.4" />
            {/* Snow mantle */}
            <path d="M40 66 Q64 56 88 68 Q68 74 40 66 Z" fill="#f8fafc" />
            {/* Sharp claws */}
            <polygon points="40,94 36,102 43,96" fill="#ffffff" />
            <polygon points="74,94 70,102 77,96" fill="#ffffff" />
            {/* Wolf head & snout */}
            <polygon points="36,36 33,16 48,32" fill="#64748b" stroke="#1e293b" strokeWidth="1.3" />
            <polygon points="56,34 65,16 68,36" fill="#64748b" stroke="#1e293b" strokeWidth="1.3" />
            <ellipse cx="50" cy="49" rx="17" ry="15" fill={`url(#${g1})`} stroke="#1e293b" strokeWidth="1.5" />
            <ellipse cx="44" cy="45" rx="3.1" ry="2.2" fill="#e0f2fe" />
            <circle cx="44" cy="45" r="1.4" fill="#0284c7" />
            <ellipse cx="56" cy="45" rx="3.1" ry="2.2" fill="#e0f2fe" />
            <circle cx="56" cy="45" r="1.4" fill="#0284c7" />
            <polygon points="43,60 46,68 49,60" fill="#ffffff" />
            <polygon points="52,60 55,68 58,60" fill="#ffffff" />
          </g>
        )}

        {/* Raksasa Aljabar -> Manusia besar berjubah putih & tongkat salju */}
        {archetype === 'raksasa_aljabar' && (
          <g>
            <path d="M30 98 L42 46 L74 46 L86 98 Z" fill={`url(#${g1})`} stroke="#38bdf8" strokeWidth="1.8" />
            <rect x="52" y="46" width="12" height="52" fill="#0284c7" />
            <circle cx="58" cy="36" r="13" fill="#e2a87c" stroke="#1e293b" strokeWidth="1.3" />
            <path d="M46 40 L58 60 L70 40 Z" fill="#ffffff" />
            <circle cx="53" cy="34" r="2" fill="#0284c7" />
            <circle cx="63" cy="34" r="2" fill="#0284c7" />
            {/* Snow staff */}
            <line x1="92" y1="28" x2="92" y2="98" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
            <circle cx="92" cy="24" r="7.5" fill="#bae6fd" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="28" cy="34" r="2.2" fill="#ffffff" />
            <circle cx="98" cy="48" r="2.2" fill="#ffffff" />
          </g>
        )}

        {/* Burung Teka-Teki -> Burung phoenix merah berekor api */}
        {archetype === 'burung_teka_teki' && (
          <g>
            <path d="M66 74 Q92 84 102 58 Q88 64 84 48 Q74 60 64 68" fill={`url(#${g2})`} stroke="#fde047" strokeWidth="1.3" />
            <path d="M44 54 L14 30 L32 64 Z" fill="#dc2626" stroke="#450a0a" strokeWidth="1.4" />
            <path d="M72 54 L98 30 L80 64 Z" fill="#dc2626" stroke="#450a0a" strokeWidth="1.4" />
            <ellipse cx="56" cy="62" rx="15" ry="20" fill={`url(#${g1})`} stroke="#450a0a" strokeWidth="1.4" />
            <circle cx="54" cy="38" r="11" fill="#dc2626" stroke="#450a0a" strokeWidth="1.4" />
            <path d="M52 28 L64 14 L66 30 Z" fill="#fbbf24" />
            <polygon points="43,38 29,43 43,46" fill="#fbbf24" />
            <circle cx="50" cy="37" r="2.4" fill="#fef08a" />
            <circle cx="50" cy="37" r="1.1" fill="#0f172a" />
          </g>
        )}

        {/* Penyihir Logika -> Penyihir jubah hitam & tongkat sihir */}
        {archetype === 'penyihir_logika' && (
          <g>
            <path d="M30 98 L44 48 L72 48 L86 98 Z" fill={`url(#${g1})`} stroke="#a855f7" strokeWidth="1.8" />
            <circle cx="58" cy="43" r="11.5" fill="#cbd5e1" stroke="#0f172a" strokeWidth="1.3" />
            <ellipse cx="58" cy="35" rx="22" ry="5" fill="#020617" stroke="#a855f7" strokeWidth="1.5" />
            <polygon points="42,35 74,35 58,12" fill="#020617" stroke="#a855f7" strokeWidth="1.5" />
            <circle cx="53.5" cy="42.5" r="2.2" fill="#c084fc" />
            <circle cx="62.5" cy="42.5" r="2.2" fill="#c084fc" />
            <line x1="92" y1="34" x2="88" y2="98" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
            <polygon points="92,22 98,32 92,40 86,32" fill="#c084fc" stroke="#ffffff" strokeWidth="1.2" />
          </g>
        )}

        {/* Raja Matematika -> Malaikat bersayap putih */}
        {archetype === 'raja_matematika' && (
          <g>
            <ellipse cx="60" cy="20" rx="14" ry="4" fill="none" stroke="#fde047" strokeWidth="2.8" />
            <path d="M46 50 Q14 26 20 68 Q34 74 48 64 Z" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.5" />
            <path d="M74 50 Q106 26 100 68 Q86 74 72 64 Z" fill="#ffffff" stroke="#bae6fd" strokeWidth="1.5" />
            <path d="M42 96 L49 48 L71 48 L78 96 Z" fill={`url(#${g1})`} stroke="#fbbf24" strokeWidth="1.8" />
            <rect x="55" y="48" width="10" height="48" fill="#fbbf24" />
            <circle cx="60" cy="38" r="11" fill="#fde2c4" stroke="#9a3412" strokeWidth="1" />
            <path d="M49 36 A11 11 0 0 1 71 36 Z" fill="#fbbf24" />
            <circle cx="56" cy="38" r="1.8" fill="#0284c7" />
            <circle cx="64" cy="38" r="1.8" fill="#0284c7" />
          </g>
        )}
      </g>
    </svg>
  );
};

export const GeometryDiagramSvg: React.FC<{
  type: 'segitiga_siku' | 'persegi_panjang' | 'lingkaran' | 'kubus' | 'sudut';
  data?: Record<string, string | number>;
}> = ({ type, data = {} }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 flex items-center justify-center">
      {type === 'persegi_panjang' && (
        <svg viewBox="0 0 220 110" className="w-48 h-24">
          <rect x="35" y="18" width="140" height="65" fill="#1e3a8a" fillOpacity="0.45" stroke="#38bdf8" strokeWidth="2.5" />
          <text x="105" y="13" textAnchor="middle" fill="#fde047" fontSize="13" fontWeight="700">
            p = {data.p ?? '12 m'}
          </text>
          <text x="184" y="54" textAnchor="start" fill="#34d399" fontSize="13" fontWeight="700">
            l = {data.l ?? '7 m'}
          </text>
        </svg>
      )}
      {type === 'segitiga_siku' && (
        <svg viewBox="0 0 220 120" className="w-48 h-24">
          <polygon points="45,95 45,22 155,95" fill="#312e81" fillOpacity="0.5" stroke="#fbbf24" strokeWidth="2.5" />
          <rect x="45" y="83" width="12" height="12" fill="none" stroke="#38bdf8" strokeWidth="1.8" />
          <text x="26" y="62" textAnchor="end" fill="#34d399" fontSize="12" fontWeight="700">
            {data.tinggi ?? '8 m'}
          </text>
          <text x="100" y="112" textAnchor="middle" fill="#38bdf8" fontSize="12" fontWeight="700">
            {data.alas ?? '6 m'}
          </text>
          <text x="112" y="50" textAnchor="start" fill="#fde047" fontSize="12" fontWeight="700">
            {data.miring ?? '?'}
          </text>
        </svg>
      )}
      {type === 'sudut' && (
        <svg viewBox="0 0 220 115" className="w-48 h-24">
          <polygon points="35,92 185,92 115,20" fill="#7c2d12" fillOpacity="0.4" stroke="#f59e0b" strokeWidth="2.5" />
          <text x="58" y="84" fill="#fde047" fontSize="12" fontWeight="700">{data.a ?? '50°'}</text>
          <text x="148" y="84" fill="#38bdf8" fontSize="12" fontWeight="700">{data.b ?? '60°'}</text>
          <text x="115" y="44" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="700">{data.c ?? '?'}</text>
        </svg>
      )}
      {type === 'kubus' && (
        <svg viewBox="0 0 180 120" className="w-44 h-24">
          <rect x="45" y="38" width="60" height="60" fill="#0f766e" fillOpacity="0.4" stroke="#2dd4bf" strokeWidth="2" />
          <polygon points="45,38 72,18 132,18 105,38" fill="#14b8a6" fillOpacity="0.3" stroke="#2dd4bf" strokeWidth="2" />
          <polygon points="105,38 132,18 132,78 105,98" fill="#0d9488" fillOpacity="0.35" stroke="#2dd4bf" strokeWidth="2" />
          <text x="75" y="112" textAnchor="middle" fill="#fde047" fontSize="12" fontWeight="700">
            s = {data.rusuk ?? '5 cm'}
          </text>
        </svg>
      )}
      {type === 'lingkaran' && (
        <svg viewBox="0 0 180 115" className="w-44 h-24">
          <circle cx="90" cy="58" r="42" fill="#4c1d95" fillOpacity="0.4" stroke="#c084fc" strokeWidth="2.5" />
          <line x1="90" y1="58" x2="132" y2="58" stroke="#fde047" strokeWidth="2.2" />
          <circle cx="90" cy="58" r="3" fill="#fde047" />
          <text x="111" y="51" textAnchor="middle" fill="#fde047" fontSize="12" fontWeight="700">
            r = {data.r ?? '7 cm'}
          </text>
        </svg>
      )}
    </div>
  );
};
