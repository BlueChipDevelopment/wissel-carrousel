import { useRef, useState } from 'react'
import type { Blok, Doel, Formatie } from '@/domain/types'

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
  '1-2-2-1': {
    keeper: [150, 355],
    verdediger: [
      [72, 288],
      [228, 288],
    ],
    aanval: [
      [92, 222],
      [208, 222],
      [150, 118],
    ],
    labels: ['M', 'M', 'S'],
  },
}

const VELD_H = 425
/** Hoogte van de bankstrook onder het veld (alleen in de bewerkbare stand). */
const BANK_H = 78
const CHALK = 'rgba(238,246,236,.42)'
const KLEUR = { K: '#D9971F', V: '#37749F', A: '#BE4A28', B: '#7E8983' }
/** Straal waarbinnen een sleep "boven" een plek telt. */
const RAAK = 36

interface Props {
  blok: Blok
  formatie: Formatie
  naam: (id: string) => string
  /** Slepen aan: bank onder het veld, spelers versleepbaar. */
  bewerkbaar?: boolean
  /** Speler is op `doel` losgelaten. */
  onZet?: (speler: string, doel: Doel) => void
}

interface Sleep {
  speler: string
  van: Doel
  x: number
  y: number
  startX: number
  startY: number
  boven: Doel | null
  bewogen: boolean
}

interface Plek {
  doel: Doel
  x: number
  y: number
  speler: string | null
  letter: string
  kleur: string
}

function zelfdeDoel(a: Doel, b: Doel): boolean {
  return a.soort === b.soort && (a.soort !== 'veld' || b.soort !== 'veld' || a.i === b.i)
}

/**
 * Het veldje. In de bewerkbare stand kun je spelers slepen: van de bank naar een plek, of
 * twee plekken ruilen door de een op de ander te laten vallen. Pointer events, dus het
 * werkt op de telefoon; de bank staat in dezelfde SVG zodat alles één coördinatenstelsel is.
 */
export function Pitch({ blok, formatie, naam, bewerkbaar = false, onZet }: Props) {
  const spots = SPOTS[formatie] ?? SPOTS['1-2-3']
  const svgRef = useRef<SVGSVGElement>(null)
  const [sleep, setSleepState] = useState<Sleep | null>(null)
  // De sleep-stand ook in een ref: pointer events volgen elkaar sneller op dan React rendert.
  const sleepRef = useRef<Sleep | null>(null)
  const setSleep = (s: Sleep | null) => {
    sleepRef.current = s
    setSleepState(s)
  }
  const hoogte = bewerkbaar ? VELD_H + BANK_H : VELD_H

  const plekken: Plek[] = [
    { doel: { soort: 'goal' }, x: spots.keeper[0], y: spots.keeper[1], speler: blok.keeper, letter: 'K', kleur: KLEUR.K },
    ...spots.verdediger.map<Plek>((s, i) => ({
      doel: { soort: 'veld', i },
      x: s[0],
      y: s[1],
      speler: blok.verdedigers[i] || null,
      letter: 'V',
      kleur: KLEUR.V,
    })),
    ...spots.aanval.map<Plek>((s, i) => ({
      doel: { soort: 'veld', i: 2 + i },
      x: s[0],
      y: s[1],
      speler: blok.aanval[i] || null,
      letter: spots.labels[i] ?? 'A',
      kleur: KLEUR.A,
    })),
  ]
  const bankX = (k: number) => 40 + k * Math.min(70, 220 / Math.max(1, blok.bank.length - 1))
  const bankY = VELD_H + 30

  const naarSvg = (e: React.PointerEvent): [number, number] => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const r = svg.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * 300, ((e.clientY - r.top) / r.height) * hoogte]
  }

  const bovenWat = (x: number, y: number, speler: string): Doel | null => {
    let beste: { doel: Doel; d: number } | null = null
    for (const p of plekken) {
      const d = Math.hypot(p.x - x, p.y - y)
      if (d <= RAAK && (!beste || d < beste.d)) beste = { doel: p.doel, d }
    }
    if (beste) return beste.doel
    if (y > VELD_H && !blok.bank.includes(speler)) return { soort: 'bank' }
    return null
  }

  const pakOp = (e: React.PointerEvent, speler: string, van: Doel) => {
    if (!bewerkbaar || !onZet || e.button !== 0) return
    e.preventDefault()
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* geen actieve pointer (bijv. in een test): dan zonder capture */
    }
    const [x, y] = naarSvg(e)
    setSleep({ speler, van, x, y, startX: x, startY: y, boven: null, bewogen: false })
  }

  const beweeg = (e: React.PointerEvent) => {
    const sleep = sleepRef.current
    if (!sleep) return
    const [x, y] = naarSvg(e)
    const bewogen = sleep.bewogen || Math.hypot(x - sleep.startX, y - sleep.startY) > 6
    setSleep({ ...sleep, x, y, bewogen, boven: bewogen ? bovenWat(x, y, sleep.speler) : null })
  }

  const laatLos = () => {
    const sleep = sleepRef.current
    if (!sleep) return
    const { speler, van, boven, bewogen } = sleep
    setSleep(null)
    if (bewogen && boven && !zelfdeDoel(boven, van)) onZet?.(speler, boven)
  }

  const isBoven = (d: Doel) => !!sleep?.boven && zelfdeDoel(sleep.boven, d)

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 300 ${hoogte}`}
      role="img"
      aria-label={bewerkbaar ? 'Opstelling op het veld — sleep spelers om te wisselen' : 'Opstelling op het veld'}
      className="block h-auto w-full select-none"
      style={{ touchAction: bewerkbaar ? 'none' : undefined }}
      onPointerMove={beweeg}
      onPointerUp={laatLos}
      onPointerCancel={() => setSleep(null)}
    >
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

      {bewerkbaar && (
        <g>
          <rect x={0} y={VELD_H} width={300} height={BANK_H} fill="#1B3A2E" />
          <rect
            x={8}
            y={VELD_H + 6}
            width={284}
            height={BANK_H - 12}
            rx={8}
            fill={isBoven({ soort: 'bank' }) ? 'rgba(240,247,238,.18)' : 'rgba(240,247,238,.06)'}
            stroke={isBoven({ soort: 'bank' }) ? '#fff' : CHALK}
            strokeWidth={isBoven({ soort: 'bank' }) ? 3 : 1.5}
            strokeDasharray={isBoven({ soort: 'bank' }) ? undefined : '6 4'}
          />
          <text x={292} y={VELD_H + 18} textAnchor="end" fill={CHALK} fontFamily="'Barlow Condensed', sans-serif" fontSize={12} letterSpacing={1.5}>
            BANK
          </text>
          {blok.bank.length === 0 && (
            <text x={150} y={bankY + 8} textAnchor="middle" fill={CHALK} fontFamily="'Barlow Condensed', sans-serif" fontSize={15}>
              niemand op de bank
            </text>
          )}
        </g>
      )}

      {plekken.map((p) => {
        const gesleept = sleep?.speler === p.speler && sleep.bewogen
        if (!p.speler) {
          return bewerkbaar ? (
            <circle
              key={`leeg-${p.letter}-${p.x}-${p.y}`}
              cx={p.x}
              cy={p.y}
              r={20}
              fill={isBoven(p.doel) ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.08)'}
              stroke={isBoven(p.doel) ? '#fff' : 'rgba(255,255,255,.55)'}
              strokeWidth={isBoven(p.doel) ? 3 : 2}
              strokeDasharray={isBoven(p.doel) ? undefined : '5 4'}
            />
          ) : null
        }
        return (
          <Marker
            key={p.speler}
            x={p.x}
            y={p.y}
            naam={naam(p.speler)}
            letter={p.letter}
            kleur={p.kleur}
            dim={gesleept}
            ring={isBoven(p.doel)}
            pak={bewerkbaar ? (e) => pakOp(e, p.speler as string, p.doel) : undefined}
          />
        )
      })}

      {bewerkbaar &&
        blok.bank.map((p, k) => (
          <Marker
            key={p}
            x={bankX(k)}
            y={bankY}
            naam={naam(p)}
            letter="B"
            kleur={KLEUR.B}
            dim={sleep?.speler === p && sleep.bewogen}
            pak={(e) => pakOp(e, p, { soort: 'bank' })}
          />
        ))}

      {sleep?.bewogen && (
        <Marker x={sleep.x} y={sleep.y} naam={naam(sleep.speler)} letter="" kleur="rgba(255,255,255,.35)" zwevend />
      )}
    </svg>
  )
}

function Marker({
  x,
  y,
  naam,
  letter,
  kleur,
  dim,
  ring,
  zwevend,
  pak,
}: {
  x: number
  y: number
  naam: string
  letter: string
  kleur: string
  dim?: boolean
  ring?: boolean
  zwevend?: boolean
  pak?: (e: React.PointerEvent) => void
}) {
  return (
    <g
      opacity={dim ? 0.35 : 1}
      style={{ cursor: pak ? 'grab' : undefined, pointerEvents: zwevend ? 'none' : undefined }}
      onPointerDown={pak}
    >
      {ring && <circle cx={x} cy={y} r={27} fill="none" stroke="#fff" strokeWidth={3} />}
      <circle cx={x} cy={y} r={pak ? 24 : 20} fill={pak ? 'transparent' : 'none'} stroke="none" />
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
