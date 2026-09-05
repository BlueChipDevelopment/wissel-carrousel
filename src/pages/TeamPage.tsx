import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTeam } from '@/App'
import { BlockTabs } from '@/components/BlockTabs'
import { LineupEditor } from '@/components/LineupEditor'
import { MatchClock } from '@/components/MatchClock'
import { MinutesList } from '@/components/MinutesList'
import { Pitch } from '@/components/Pitch'
import { RolesPanel } from '@/components/RolesPanel'
import { ScheduleTable } from '@/components/ScheduleTable'
import { SEED_START_JO8_1 } from '@/data/seed'
import { blokken, hussel, keeperTally, minuten, standaardVerdeling } from '@/domain/schedule'
import type { Opstelling } from '@/domain/types'
import { db, type Match, type Player } from '@/services/db'
import { formatDateShort, nextSaturdayISO, todayISO } from '@/utils/dateUtils'

interface Draft {
  id?: string
  date: string
  opponent: string
  opstelling: Opstelling
  afwezig: string[]
}

/** Opstelling van één wedstrijd: instellen, bekijken langs de lijn, opslaan. */
export function TeamPage() {
  const team = useTeam()
  const [params, setParams] = useSearchParams()
  const gevraagdeDatum = params.get('datum')
  const [spelers, setSpelers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [blok, setBlok] = useState(0)
  const [wedstrijdOpen, setWedstrijdOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)

  const naam = useCallback((id: string) => spelers.find((p) => p.id === id)?.name ?? '?', [spelers])

  // Team gewisseld: spelers en wedstrijden laden, en de eerstvolgende wedstrijd kiezen.
  useEffect(() => {
    let live = true
    setLaden(true)
    setFout(null)
    Promise.all([db.listPlayers(team.id), db.listMatches(team.id)])
      .then(([p, m]) => {
        if (!live) return
        setSpelers(p)
        setMatches(m)
        const vandaag = todayISO()
        const aanstaand = m.filter((x) => x.date >= vandaag).sort((a, b) => a.date.localeCompare(b.date))[0]
        const datum = gevraagdeDatum ?? aanstaand?.date ?? nextSaturdayISO()
        setDraft(maakDraft(datum, p, m, team.slug))
        setDirty(false)
        setBlok(0)
      })
      .catch((e: unknown) => live && setFout(e instanceof Error ? e.message : String(e)))
      .finally(() => live && setLaden(false))
    return () => {
      live = false
    }
    // gevraagdeDatum alleen bij het laden van het team lezen; daarna stuurt kiesDatum.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.id, team.slug])

  const sch = useMemo(() => (draft ? blokken(draft.opstelling) : []), [draft])
  const vijf = draft?.opstelling.wissel === '5min'
  const aanwezigIds = draft ? [...draft.opstelling.achter, ...draft.opstelling.voor] : []
  const mins = useMemo(() => minuten(sch, aanwezigIds), [sch, aanwezigIds])
  const uniekeMinuten = new Set(aanwezigIds.map((p) => mins[p]))

  /** Keeperbeurten in wedstrijden vóór de gekozen datum: daar rekent de hussel mee. */
  const tally = useMemo(
    () => keeperTally(matches.filter((m) => draft && m.date < draft.date).map((m) => m.achter)),
    [matches, draft],
  )

  const kiesDatum = (datum: string) => {
    if (!datum) return
    setDraft(maakDraft(datum, spelers, matches, team.slug))
    setDirty(false)
    setBlok(0)
    setStatus(null)
    setParams({ datum }, { replace: true })
  }

  const wijzig = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    setDirty(true)
    setStatus(null)
  }

  const doeHussel = () => {
    if (!draft) return
    const r = hussel(aanwezigIds, tally)
    wijzig({ opstelling: { ...draft.opstelling, ...r } })
    setBlok(0)
  }

  const opslaan = async () => {
    if (!draft) return
    setStatus('Bezig…')
    setFout(null)
    try {
      const saved = await db.saveMatch({
        id: draft.id,
        teamId: team.id,
        date: draft.date,
        opponent: draft.opponent.trim() || null,
        wissel: draft.opstelling.wissel,
        formatie: draft.opstelling.formatie,
        achter: draft.opstelling.achter,
        voor: draft.opstelling.voor,
        afwezig: draft.afwezig,
        notes: null,
      })
      setMatches((m) => [saved, ...m.filter((x) => x.id !== saved.id)].sort((a, b) => b.date.localeCompare(a.date)))
      setDraft((d) => (d ? { ...d, id: saved.id } : d))
      setDirty(false)
      setStatus(`Opgeslagen voor ${formatDateShort(saved.date)}.`)
    } catch (e) {
      setFout(e instanceof Error ? e.message : String(e))
      setStatus(null)
    }
  }

  if (laden) return <p className="hint">Laden…</p>
  if (!draft) return <p className="text-voor">{fout ?? 'Er ging iets mis.'}</p>

  const geldigBlok = sch[Math.min(blok, sch.length - 1)] ? Math.min(blok, sch.length - 1) : 0
  const kanTonen = sch.length > 0 && sch[geldigBlok].keeper !== null

  return (
    <div className="flex flex-col gap-6">
      {/* Wedstrijd: ingeklapt één regel; uitgeklapt datum, tegenstander en eerdere wedstrijden */}
      <section className="card no-print flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 text-left"
            aria-expanded={wedstrijdOpen}
            onClick={() => setWedstrijdOpen((o) => !o)}
          >
            <span className="font-display text-[21px] font-semibold uppercase tracking-[0.02em] whitespace-nowrap">
              {formatDateShort(draft.date)}
            </span>
            <span className="hint whitespace-nowrap underline sm:order-last">{wedstrijdOpen ? 'sluit' : 'wijzig'}</span>
            <span className="basis-full truncate text-muted sm:basis-auto sm:flex-1">
              {draft.opponent.trim() ? `tegen ${draft.opponent.trim()}` : 'tegenstander onbekend'}
            </span>
          </button>
          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-primary btn-small" onClick={opslaan} disabled={!dirty && !!draft.id}>
              {draft.id ? (dirty ? 'Wijzigingen opslaan' : 'Opgeslagen') : 'Wedstrijd opslaan'}
            </button>
            {status && <span className="hint">{status}</span>}
          </div>
        </div>
        {fout && <p className="text-[14px] text-voor">{fout}</p>}
        {wedstrijdOpen && (
          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Wedstrijddatum</span>
              <input type="date" className="field" value={draft.date} onChange={(e) => kiesDatum(e.target.value)} />
            </label>
            <label className="flex min-w-[200px] flex-1 flex-col gap-1">
              <span className="eyebrow">Tegenstander (optioneel)</span>
              <input
                type="text"
                className="field"
                placeholder="bijv. SVMM JO8-2"
                value={draft.opponent}
                onChange={(e) => wijzig({ opponent: e.target.value })}
              />
            </label>
            {matches.length > 0 && (
              <p className="hint w-full">
                Opgeslagen wedstrijden:{' '}
                {matches
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .slice(-8)
                  .map((m, i) => (
                    <span key={m.id}>
                      {i > 0 && ' · '}
                      <button
                        type="button"
                        className={m.date === draft.date ? 'font-semibold text-ink' : 'underline'}
                        onClick={() => kiesDatum(m.date)}
                      >
                        {formatDateShort(m.date)}
                      </button>
                    </span>
                  ))}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Spelregels: ingeklapt, alleen op verzoek */}
      <details className="card overflow-hidden shadow-none">
        <summary className="cursor-pointer px-[14px] py-[9px] font-display text-[14px] font-semibold uppercase tracking-[0.1em] text-muted select-none">
          Spelregels JO8
        </summary>
        <div className="flex flex-wrap border-t border-line">
          <Feit b="4 × 10 min" s="2 × 20, time-out halverwege" />
          <Feit b="6 tegen 6" s="keeper + 5" />
          <Feit b="42,5 × 30 m" s="kwartveld" />
          <Feit b={uniekeMinuten.size === 1 ? `${[...uniekeMinuten][0]} min` : 'wisselend'} s="speeltijd per speler" laatste />
        </div>
      </details>

      {kanTonen ? (
        <>
          <section className="flex flex-col gap-4">
            <MatchClock sleutel={team.id} vijf={!!vijf} onBlok={setBlok} />
            <BlockTabs blokken={sch} actief={geldigBlok} vijf={!!vijf} naam={naam} onKies={setBlok} />
            <div className="grid items-start gap-[22px] md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              <div className="rounded-[14px] bg-pitch p-3 shadow-card">
                <div className="flex items-baseline justify-between px-1 pb-[10px] font-display text-[13px] uppercase tracking-[0.1em] text-[rgba(240,247,238,.8)]">
                  <span>
                    Kwart {sch[geldigBlok].kwart + 1} · {sch[geldigBlok].van}–{sch[geldigBlok].tot} min
                  </span>
                  <span>{draft.opstelling.formatie}</span>
                </div>
                <Pitch blok={sch[geldigBlok]} formatie={draft.opstelling.formatie} naam={naam} />
              </div>
              <RolesPanel blokken={sch} i={geldigBlok} opstelling={draft.opstelling} naam={naam} />
            </div>
          </section>

          <ScheduleTable blokken={sch} opstelling={draft.opstelling} naam={naam} />
        </>
      ) : (
        <p className="hint">Zet minstens één speler achterin om het schema te zien.</p>
      )}

      <LineupEditor
        spelers={spelers}
        opstelling={draft.opstelling}
        afwezig={draft.afwezig}
        onChange={({ opstelling, afwezig }) => {
          wijzig({ opstelling, afwezig })
          setBlok(0)
        }}
        onHussel={doeHussel}
      />

      {kanTonen && <MinutesList blokken={sch} opstelling={draft.opstelling} naam={naam} />}

      <footer className="border-t border-line pt-4 text-[13.5px] text-muted">
        {vijf ? (
          <>
            <b>Achterin:</b> niemand zit op de bank in het blokje vlak vóór of vlak ná zijn keepersbeurt — anders sta
            je 15 minuten achter elkaar stil. Je gaat dus warm het doel in en warm het veld weer op. Voorin schuift
            de wissel elke 5 minuten door. Iedereen komt op 30 minuten uit.
          </>
        ) : (
          <>
            <b>De regel achterin:</b> keeper geweest → volgend kwart de bank in → twee kwarten verdediger → weer
            keeper. Voorin schuift de wissel per kwart door.
          </>
        )}
      </footer>
    </div>
  )
}

function Feit({ b, s, laatste }: { b: string; s: string; laatste?: boolean }) {
  return (
    <div className={`min-w-[118px] flex-1 px-[14px] py-[9px] ${laatste ? '' : 'border-r border-line'}`}>
      <b className="block font-display text-[19px] font-semibold">{b}</b>
      <span className="text-[12px] uppercase tracking-[0.06em] text-muted">{s}</span>
    </div>
  )
}

/**
 * Draft voor een datum: de opgeslagen wedstrijd als die er is, anders een nieuwe op basis
 * van de laatste wedstrijd ervoor (zelfde linies, dus de coach hoeft alleen te husselen),
 * en bij een team zonder geschiedenis de standaardverdeling.
 */
function maakDraft(datum: string, spelers: Player[], matches: Match[], slug: string): Draft {
  const actief = spelers.filter((p) => p.active)
  const ids = new Set(actief.map((p) => p.id))
  const geldig = (l: string[]) => l.filter((id) => ids.has(id))

  const bestaand = matches.find((m) => m.date === datum)
  if (bestaand) {
    return {
      id: bestaand.id,
      date: bestaand.date,
      opponent: bestaand.opponent ?? '',
      opstelling: {
        achter: geldig(bestaand.achter),
        voor: geldig(bestaand.voor),
        wissel: bestaand.wissel,
        formatie: bestaand.formatie,
      },
      afwezig: geldig(bestaand.afwezig),
    }
  }

  const vorige = matches.filter((m) => m.date < datum).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (vorige) {
    const achter = geldig(vorige.achter)
    const voor = geldig(vorige.voor)
    const bekend = new Set([...achter, ...voor])
    const nieuw = actief.map((p) => p.id).filter((id) => !bekend.has(id))
    return {
      date: datum,
      opponent: '',
      opstelling: { achter, voor: [...voor, ...nieuw], wissel: vorige.wissel, formatie: vorige.formatie },
      afwezig: [],
    }
  }

  // Geen geschiedenis: JO8-1 begint met de opstelling uit de chat, de rest standaard.
  let verdeling = standaardVerdeling(actief.map((p) => p.id))
  if (slug === 'jo8-1') {
    const byName = (n: string) => actief.find((p) => p.name === n)?.id
    const achter = SEED_START_JO8_1.achter.map(byName).filter((x): x is string => !!x)
    const voor = SEED_START_JO8_1.voor.map(byName).filter((x): x is string => !!x)
    const rest = actief.map((p) => p.id).filter((id) => !achter.includes(id) && !voor.includes(id))
    if (achter.length + voor.length >= 6) verdeling = { achter, voor: [...voor, ...rest] }
  }
  return { date: datum, opponent: '', opstelling: { ...verdeling, wissel: '5min', formatie: '1-2-3' }, afwezig: [] }
}
