import type { Blok, Formatie } from '@/domain/types'

/** Posities op een verticaal kwartveld (42,5 × 30 m), eigen doel onderaan. viewBox 300×425. */
const SPOTS: Record<
  Formatie,
  { keeper: [number, number]; verdediger: [number, number][]; aanval: [number, number][]; labels: string[] }
> = {
  '1-2-3': {
    keeper: [150, 355],
    verdediger: [
      [72, 288],
      [228, 288],
    ],
    aanval: [
      [64, 172],
      [150, 130],
      [236, 172],
    ],
    labels: ['A', 'A', 'A'],
  },
  '1-2-1-2': {
    keeper: [150, 355],
    verdediger: [
      [72, 288],
      [228, 288],
    ],
    aanval: [
      [150, 232],
      [102, 126],
      [198, 126],
    ],
    labels: ['M', 'S', 'S'],
  },
}

const CHALK = 'rgba(238,246,236,.42)'
const KLEUR = { K: '#D9971F', V: '#37749F', A: '#BE4A28' }

interface Props {
  blok: Blok
  formatie: Formatie
  naam: (id: string) => string
}

export function Pitch({ blok, formatie, naam }: Props) {
  const spots = SPOTS[formatie] ?? SPOTS['1-2-3']
  return (
    <svg viewBox="0 0 300 425" role="img" aria-label="Opstelling op het veld" className="block h-auto w-full">
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={0} y={i * 71} width={300} height={71} fill={i % 2 ? '#27503F' : '#23483A'} />
      ))}
      <rect x={12} y={12} width={276} height={401} rx={2} fill="none" stroke={CHALK} strokeWidth={2} />
      <line x1={12} y1={212.5} x2={288} y2={212.5} stroke={CHALK} strokeWidth={2} />
      <circle cx={150} cy={212.5} r={44} fill="none" stroke={CHALK} strokeWidth={2} />
      <rect x={95} y={363} width={110} height={50} fill="none" stroke={CHALK} strokeWidth={2} />
      <rect x={95} y={12} width={110} height={50} fill="none" stroke={CHALK} strokeWidth={2} />
      <rect x={118} y={407} width={64} height={6} fill="rgba(240,247,238,.8)" />
      <rect x={118} y={12} width={64} height={6} fill="rgba(240,247,238,.8)" />

      {blok.keeper && <Marker x={spots.keeper[0]} y={spots.keeper[1]} naam={naam(blok.keeper)} letter="K" kleur={KLEUR.K} />}
      {blok.verdedigers.map((p, i) => {
        const s = spots.verdediger[i] ?? spots.verdediger[0]
        return <Marker key={p} x={s[0]} y={s[1]} naam={naam(p)} letter="V" kleur={KLEUR.V} />
      })}
      {blok.aanval.map((p, i) => {
        const s = spots.aanval[i] ?? spots.aanval[0]
        return <Marker key={p} x={s[0]} y={s[1]} naam={naam(p)} letter={spots.labels[i] ?? 'A'} kleur={KLEUR.A} />
      })}
    </svg>
  )
}

function Marker({ x, y, naam, letter, kleur }: { x: number; y: number; naam: string; letter: string; kleur: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={20} fill={kleur} stroke="rgba(255,255,255,.85)" strokeWidth={2} />
      <text
        x={x}
        y={y + 5.5}
        textAnchor="middle"
        fill="#fff"
        fontFamily="'Barlow Condensed', sans-serif"
        fontSize={16}
        fontWeight={700}
      >
        {letter}
      </text>
      <text
        x={x}
        y={y + 38}
        textAnchor="middle"
        fill="#F1F7EF"
        fontFamily="'Barlow Condensed', sans-serif"
        fontSize={16.5}
        fontWeight={600}
        stroke="#1B3A2E"
        strokeWidth={3.4}
        paintOrder="stroke"
      >
        {naam}
      </text>
    </g>
  )
}
