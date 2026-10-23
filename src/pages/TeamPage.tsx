import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTeam } from '@/App'
import { BlockTabs } from '@/components/BlockTabs'
import { LineupEditor } from '@/components/LineupEditor'
import { LivePanel } from '@/components/LivePanel'
import { MatchClock } from '@/components/MatchClock'
import { MinutesList } from '@/components/MinutesList'
import { Pitch } from '@/components/Pitch'
import { RolesPanel } from '@/components/RolesPanel'
import { ScheduleTable } from '@/components/ScheduleTable'
import { SEED_START_JO8_1 } from '@/data/seed'
import {
  keepersVan,
  keepersGeteld,
  laatLos,
  liveBij,
  past,
  samengesteld,
  vanPlan,
  verschillen,
  zetBeschikbaarheid,
  zetHuidig,
  zetOpPlek,
  zetOpPlekInPlan,
} from '@/domain/live'
import { AttendancePanel } from '@/components/AttendancePanel'
import { WISSEL_STANDEN, hussel, keeperTally, minuten, standaardVerdeling, toggleAanwezig, vijfMinuten } from '@/domain/schedule'
import type { Beschikbaarheid, Doel, Live, Opstelling, Verschil, WisselStand } from '@/domain/types'
import { ConflictError, db, type Match, type Player } from '@/services/db'
import { formatDateShort, nextSaturdayISO, todayISO } from '@/utils/dateUtils'

interface Draft {
  id?: string
  date: string
  opponent: string
  opstelling: Opstelling
  afwezig: string[]
  /** Werkelijkheid tijdens de wedstrijd; null zolang alles volgens plan is. */
  live: Live | null
  /** Opgeslagen keepers; alleen leidend als de coach ze heeft vastgezet (keepersVast). */
  keepers: string[]
  keepersVast: boolean
}

/** Wat de undo-knop terugzet: plan én werkelijkheid van vóór de wijziging. */
interface Snapshot {
  label: string
  opstelling: Opstelling
  afwezig: string[]
  live: Live | null
}

/** De live-stand die geldt: de opgeslagen, of anders het (eerlijk gemaakte) plan. */
function liveVan(d: Draft): Live {
  return liveBij(d.opstelling, d.live)
}

/** Opstelling van één wedstrijd: instellen, bekijken langs de lijn, live aanpassen, opslaan. */
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
  const [regelsOpen, setRegelsOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)
  const [undo, setUndo] = useState<Snapshot[]>([])
  const [diff, setDiff] = useState<Verschil[]>([])
  /** Nieuwere versie van een andere telefoon terwijl hier nog planwijzigingen open staan. */
  const [remote, setRemote] = useState<Match | null>(null)
  /** Telt live-acties; elke tik plant een stille opslag. */
  const [liveTick, setLiveTick] = useState(0)

  const draftRef = useRef<Draft | null>(null)
  draftRef.current = draft
  /** Meteen bijgewerkt (niet pas bij de volgende render): realtime en opslaan lezen hem tussendoor. */
  const dirtyRef = useRef(false)
  const zetDirty = useCallback((v: boolean) => {
    dirtyRef.current = v
    setDirty(v)
  }, [])
  const spelersRef = useRef<Player[]>([])
  spelersRef.current = spelers
  /** updated_at van de laatst bekende versie op de server; oudere realtime-berichten negeren we. */
  const laatstBewaard = useRef<string>('')
  /** Telt lokale wijzigingen (plan en live); `gedeeld` is de stand die op de server staat. */
  const wijzigingen = useRef(0)
  const gedeeld = useRef(0)
  /** Lopende opslagen. Realtime-berichten die intussen binnenkomen (vaak onze eigen echo) wachten. */
  const bezig = useRef(0)
  const uitgesteld = useRef<Match | null>(null)

  const naam = useCallback((id: string) => spelers.find((p) => p.id === id)?.name ?? '?', [spelers])

  const laadDraft = (d: Draft, updatedAt: string) => {
    setDraft(d)
    laatstBewaard.current = updatedAt
    gedeeld.current = wijzigingen.current
    zetDirty(false)
    setUndo([])
    setDiff([])
    setRemote(null)
  }

  // Team gewisseld: spelers en wedstrijden laden, en de eerstvolgende wedstrijd kiezen.
  useEffect(() => {
    let live = true
    setLaden(true)
    setFout(null)
    Promise.all([db.listPlayers(team.id), db.listMatches(team.id)])
      .then(([p, m]) => {
        if (!live) return
        setSpelers(p)
        spelersRef.current = p
        setMatches(m)
        const vandaag = todayISO()
        const aanstaand = m.filter((x) => x.date >= vandaag).sort((a, b) => a.date.localeCompare(b.date))[0]
        const datum = gevraagdeDatum ?? aanstaand?.date ?? nextSaturdayISO()
        laadDraft(maakDraft(datum, p, m, team.slug), m.find((x) => x.date === datum)?.updatedAt ?? '')
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

  /**
   * Een versie van de server, van een andere telefoon. Staat hier nog iets dat niet gedeeld is
   * (planwijziging of een live-actie die nog op de stille opslag wacht), dan niet overschrijven
   * maar de coach laten kiezen.
   */
  const ontvang = useCallback((m: Match) => {
    if (draftRef.current?.date !== m.date) return
    if (laatstBewaard.current && m.updatedAt <= laatstBewaard.current) return
    setMatches((l) => [m, ...l.filter((x) => x.id !== m.id)].sort((a, b) => b.date.localeCompare(a.date)))
    if (dirtyRef.current || wijzigingen.current !== gedeeld.current) {
      setRemote(m)
      return
    }
    laatstBewaard.current = m.updatedAt
    setDraft((d) => (d && d.date === m.date ? draftVanMatch(m, spelersRef.current) : d))
    setUndo([])
    setStatus('Bijgewerkt vanaf een andere telefoon.')
  }, [])

  // Realtime: dezelfde wedstrijd op een andere telefoon.
  const datum = draft?.date
  useEffect(() => {
    if (!datum) return
    return db.subscribeMatch(team.id, datum, (m) => {
      if (!m) return
      if (bezig.current) {
        if (!uitgesteld.current || m.updatedAt > uitgesteld.current.updatedAt) uitgesteld.current = m
        return
      }
      ontvang(m)
    })
  }, [team.id, datum, ontvang])

  const live = useMemo(() => (draft ? liveVan(draft) : null), [draft])
  const sch = useMemo(() => (draft && live ? samengesteld(draft.opstelling, live) : []), [draft, live])
  const vijf = draft ? vijfMinuten(draft.opstelling.wissel) : false
  const vrij = draft?.opstelling.wissel === 'vrij'
  const opstelling = draft?.opstelling
  const aanwezigIds = useMemo(() => (opstelling ? [...opstelling.achter, ...opstelling.voor] : []), [opstelling])
  const mins = useMemo(() => minuten(sch, aanwezigIds), [sch, aanwezigIds])
  const uniekeMinuten = new Set(aanwezigIds.map((p) => mins[p]))

  /** Keeperbeurten in wedstrijden vóór de gekozen datum: daar rekent de hussel mee. */
  const tally = useMemo(
    () => keeperTally(matches.filter((m) => draft && m.date < draft.date).map(keepersVan)),
    [matches, draft],
  )

  const kiesDatum = (datum: string) => {
    if (!datum) return
    laadDraft(maakDraft(datum, spelers, matches, team.slug), matches.find((x) => x.date === datum)?.updatedAt ?? '')
    setBlok(0)
    setStatus(null)
    setParams({ datum }, { replace: true })
  }

  /** Planwijziging: handmatig opslaan, zoals altijd. */
  const wijzig = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d))
    wijzigingen.current++
    zetDirty(true)
    setStatus(null)
  }

  /** Plan gewijzigd terwijl de wedstrijd (misschien) loopt: de werkelijkheid volgt vanaf het huidige blok. */
  const wijzigPlan = (opstelling: Opstelling, afwezig: string[]) => {
    const d = draftRef.current
    if (!d) return
    if (d.live && past(d.opstelling, d.live)) {
      if (opstelling.wissel !== d.opstelling.wissel) {
        wijzig({ opstelling, afwezig, live: null })
        setStatus('Andere wisselstand: de live-stand begint opnieuw.')
      } else {
        wijzig({ opstelling, afwezig, live: vanPlan(opstelling, d.live) })
      }
    } else {
      wijzig({ opstelling, afwezig })
      setBlok(0)
    }
  }

  /**
   * Live-actie: nieuwe werkelijkheid, undo-snapshot, verschillen, en een stille opslag zodat
   * de andere coach het ook ziet. `label` null = geen undo (bijv. de klok die doortikt).
   */
  const zetLive = useCallback(
    (label: string | null, f: (live: Live, plan: Opstelling) => Live, planPatch?: Pick<Draft, 'opstelling' | 'afwezig'>) => {
      const d = draftRef.current
      if (!d) return
      const plan = planPatch?.opstelling ?? d.opstelling
      const oud = liveVan(d)
      const nieuw = f(oud, plan)
      if (label) {
        setUndo((u) => [...u.slice(-19), { label, opstelling: d.opstelling, afwezig: d.afwezig, live: d.live }])
        setDiff(verschillen(samengesteld(d.opstelling, oud), samengesteld(plan, nieuw), plan.formatie))
      }
      setDraft({ ...d, ...planPatch, live: nieuw })
      wijzigingen.current++
      setLiveTick((t) => t + 1)
    },
    [],
  )

  /**
   * Opslaan. Bij een bestaande wedstrijd alleen over de versie heen die deze telefoon kende;
   * heeft een andere telefoon intussen opgeslagen, dan blijft die staan en kiest de coach
   * (`remote`). `forceer` = bewust toch overschrijven.
   */
  const bewaar = useCallback(
    async (stil: boolean, forceer = false) => {
      const d = draftRef.current
      if (!d) return
      if (!stil) setStatus('Bezig…')
      setFout(null)
      const bij = wijzigingen.current
      bezig.current++
      try {
        // Bekende versie: alleen daaroverheen. Nog geen id: alleen aanmaken als niemand ons voor was.
        const verwacht = forceer ? undefined : d.id ? laatstBewaard.current || undefined : null
        const saved = await db.saveMatch(
          {
            id: d.id,
            teamId: team.id,
            date: d.date,
            opponent: d.opponent.trim() || null,
            wissel: d.opstelling.wissel,
            formatie: d.opstelling.formatie,
            achter: d.opstelling.achter,
            voor: d.opstelling.voor,
            afwezig: d.afwezig,
            keepers: d.keepersVast ? d.keepers : keepersGeteld(d.opstelling, d.live),
            keepersVast: d.keepersVast,
            live: d.live,
            notes: null,
          },
          verwacht,
        )
        laatstBewaard.current = saved.updatedAt
        gedeeld.current = bij
        setMatches((m) => [saved, ...m.filter((x) => x.id !== saved.id)].sort((a, b) => b.date.localeCompare(a.date)))
        setDraft((x) => (x && x.date === saved.date ? { ...x, id: saved.id, keepers: saved.keepers } : x))
        // Tijdens het opslaan nog iets veranderd? Dat staat er niet in, dus blijft het "niet opgeslagen".
        if (wijzigingen.current === bij) zetDirty(false)
        setRemote(null)
        setStatus(stil ? 'Gedeeld met de andere telefoons.' : `Opgeslagen voor ${formatDateShort(saved.date)}.`)
      } catch (e) {
        if (e instanceof ConflictError) {
          setMatches((m) => [e.huidig, ...m.filter((x) => x.id !== e.huidig.id)].sort((a, b) => b.date.localeCompare(a.date)))
          setRemote(e.huidig)
          zetDirty(true)
          setStatus('Niet opgeslagen: een andere telefoon was eerder.')
          return
        }
        setFout(e instanceof Error ? e.message : String(e))
        setStatus(null)
      } finally {
        // Wat er tijdens het opslaan binnenkwam: onze eigen echo valt nu weg op updated_at, de rest telt.
        bezig.current--
        const u = uitgesteld.current
        if (!bezig.current && u) {
          uitgesteld.current = null
          ontvang(u)
        }
      }
    },
    [team.id, zetDirty, ontvang],
  )

  // Elke live-actie wordt kort daarna stil opgeslagen (last-write-wins).
  const remoteRef = useRef<Match | null>(null)
  remoteRef.current = remote
  useEffect(() => {
    if (!liveTick) return
    // Zolang er een nieuwere versie van een andere telefoon open staat, eerst laten kiezen.
    if (remoteRef.current) return
    const id = window.setTimeout(() => void bewaar(true), 400)
    return () => window.clearTimeout(id)
  }, [liveTick, bewaar])

  // De klok zet het actieve blok mee, en op de wedstrijddag ook het huidige (vastleggen).
  const onKlokBlok = useCallback(
    (i: number) => {
      setBlok(i)
      const d = draftRef.current
      if (!d || d.date !== todayISO()) return
      if (i > liveVan(d).huidig) zetLive(null, (l) => zetHuidig(l, i))
    },
    [zetLive],
  )

  const doeHussel = () => {
    if (!draft) return
    const r = hussel(aanwezigIds, tally)
    wijzigPlan({ ...draft.opstelling, ...r }, draft.afwezig)
  }

  const doeUndo = () => {
    const s = undo[undo.length - 1]
    if (!s) return
    setUndo((u) => u.slice(0, -1))
    setDraft((d) => (d ? { ...d, opstelling: s.opstelling, afwezig: s.afwezig, live: s.live } : d))
    setDiff([])
    wijzigingen.current++
    setLiveTick((t) => t + 1)
  }

  const zetBeschikbaar = (speler: string, b: Beschikbaarheid) => {
    const d = draftRef.current
    if (!d) return
    let { opstelling, afwezig } = d
    const inLinie = opstelling.achter.includes(speler) || opstelling.voor.includes(speler)
    if (!inLinie) {
      // Stond op afwezig: in de kortste linie erbij, achteraan (dus geen keeperbeurt).
      const t = toggleAanwezig(opstelling, afwezig, speler)
      opstelling = { ...opstelling, achter: t.achter, voor: t.voor }
      afwezig = t.afwezig
    }
    const label =
      b.tot !== undefined ? `${naam(speler)} valt uit` : b.vanaf !== undefined ? `${naam(speler)} komt erbij` : `${naam(speler)} hele wedstrijd`
    zetLive(label, (l, plan) => zetBeschikbaarheid(plan, l, speler, b), { opstelling, afwezig })
  }

  if (laden) return <p className="hint">Laden…</p>
  if (!draft || !live) return <p className="text-voor">{fout ?? 'Er ging iets mis.'}</p>

  const geldigBlok = sch[Math.min(blok, sch.length - 1)] ? Math.min(blok, sch.length - 1) : 0
  // Zolang er iemand achterin staat is er een schema — ook als de coach in een blok de goal
  // even leeg heeft gelaten (keeper naar de bank gesleept).
  const kanTonen = sch.length > 0 && draft.opstelling.achter.length > 0
  const bewerkbaar = geldigBlok >= live.huidig
  const huidigBlok = sch[geldigBlok]

  const zetOpVeld = (speler: string, doel: Doel) => {
    const b = sch[geldigBlok]
    const veld = [...b.verdedigers, ...b.aanval]
    const ander = doel.soort === 'goal' ? b.keeper : doel.soort === 'veld' ? veld[doel.i] || null : null
    const label = ander ? `${naam(speler)} ↔ ${naam(ander)}` : `${naam(speler)} naar ${doel.soort === 'bank' ? 'de bank' : 'het veld'}`
    if (geldigBlok === 0 && live.huidig === 0) {
      // Vóór de aftrap is blok 1 de beginopstelling: pas het plan aan, niet de werkelijkheid.
      const r = zetOpPlekInPlan(draft.opstelling, live, speler, doel)
      zetLive(label, () => r.live, { opstelling: r.opstelling, afwezig: draft.afwezig })
    } else {
      zetLive(label, (l, plan) => zetOpPlek(plan, l, geldigBlok, speler, doel))
    }
  }

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
            <button type="button" className="btn btn-primary btn-small" onClick={() => void bewaar(false)} disabled={!dirty && !!draft.id}>
              {draft.id ? (dirty ? 'Wijzigingen opslaan' : 'Opgeslagen') : 'Wedstrijd opslaan'}
            </button>
            {status && <span className="hint">{status}</span>}
            <button
              type="button"
              className={`inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border font-display text-[14px] font-bold ${
                regelsOpen ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-sunk text-muted'
              }`}
              aria-label="Spelregels en wisselregels"
              aria-expanded={regelsOpen}
              title="Spelregels en wisselregels"
              onClick={() => setRegelsOpen((o) => !o)}
            >
              i
            </button>
          </div>
        </div>
        {regelsOpen && (
          <div className="-mx-4 -mb-4 border-t border-line" role="region" aria-label="Spelregels en wisselregels">
            <div className="flex flex-wrap">
              <Feit b="4 × 10 min" s="2 × 20, time-out halverwege" />
              <Feit b="6 tegen 6" s="keeper + 5" />
              <Feit b="42,5 × 30 m" s="kwartveld" />
              <Feit b={uniekeMinuten.size === 1 ? `${[...uniekeMinuten][0]} min` : 'wisselend'} s="speeltijd per speler" laatste />
            </div>
            <WisselRegels wissel={draft.opstelling.wissel} />
          </div>
        )}
        {fout && <p className="text-[14px] text-voor">{fout}</p>}
        {remote && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-keeper/45 bg-keeper/15 px-[13px] py-[10px] text-[14px]">
            <span className="basis-full sm:basis-auto sm:flex-1">
              Een andere telefoon heeft deze wedstrijd intussen aangepast. Wat hier staat is niet opgeslagen.
            </span>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => laadDraft(draftVanMatch(remote, spelers), remote.updatedAt)}
            >
              Die versie ophalen
            </button>
            <button type="button" className="btn btn-small" onClick={() => void bewaar(false, true)}>
              Toch mijn versie opslaan
            </button>
          </div>
        )}
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

      {/* Wie is er? Prominent vóór de aftrap, één regel zodra de wedstrijd loopt. */}
      <AttendancePanel
        spelers={spelers}
        afwezig={draft.afwezig}
        compact={live.huidig > 0}
        onToggle={(id) => {
          const t = toggleAanwezig(draft.opstelling, draft.afwezig, id)
          wijzigPlan({ ...draft.opstelling, achter: t.achter, voor: t.voor }, t.afwezig)
        }}
      />

      {kanTonen ? (
        <>
          <section className="flex flex-col gap-4">
            <MatchClock sleutel={team.id} vijf={!!vijf} onBlok={onKlokBlok} />
            <BlockTabs
              blokken={sch}
              actief={geldigBlok}
              vijf={!!vijf}
              naam={naam}
              onKies={setBlok}
              huidig={live.huidig}
              handmatig={live.handmatig}
            />
            <LivePanel
              blokken={sch}
              live={live}
              vijf={!!vijf}
              spelers={spelers}
              afwezig={draft.afwezig}
              naam={naam}
              laatste={undo.length ? undo[undo.length - 1].label : null}
              verschillen={diff}
              onHuidig={(h) => zetLive(null, (l) => zetHuidig(l, h))}
              onUndo={doeUndo}
              onBeschikbaarheid={zetBeschikbaar}
              onSluitVerschillen={() => setDiff([])}
            />
            <div className="grid items-start gap-[22px] md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              <div className="rounded-[14px] bg-pitch p-3 shadow-card">
                <div className="flex items-baseline justify-between px-1 pb-[10px] font-display text-[13px] uppercase tracking-[0.1em] text-[rgba(240,247,238,.8)]">
                  <span>
                    Kwart {huidigBlok.kwart + 1} · {huidigBlok.van}–{huidigBlok.tot} min
                  </span>
                  {bewerkbaar && live.handmatig.includes(geldigBlok) ? (
                    <button
                      type="button"
                      className="underline decoration-[rgba(240,247,238,.5)] underline-offset-2 hover:text-white"
                      title="Dit blok heb je zelf gezet; de app rekent het niet om. Loslaten geeft het weer aan de app."
                      onClick={() =>
                        zetLive(`${vijf ? `${huidigBlok.van}–${huidigBlok.tot}` : `kwart ${huidigBlok.kwart + 1}`} loslaten`, (l, plan) =>
                          laatLos(plan, l, geldigBlok),
                        )
                      }
                    >
                      zelf gezet · loslaten
                    </button>
                  ) : (
                    <span>{bewerkbaar ? draft.opstelling.formatie : 'vastgelegd'}</span>
                  )}
                </div>
                <Pitch
                  blok={huidigBlok}
                  formatie={draft.opstelling.formatie}
                  naam={naam}
                  bewerkbaar={bewerkbaar}
                  onZet={zetOpVeld}
                />
              </div>
              <RolesPanel blokken={sch} i={geldigBlok} opstelling={draft.opstelling} naam={naam} />
            </div>
          </section>

          <ScheduleTable blokken={sch} opstelling={draft.opstelling} naam={naam} />
        </>
      ) : (
        <p className="hint">{vrij ? 'Zet minstens één speler in de keeperlijst om het schema te zien.' : 'Zet minstens één speler achterin om het schema te zien.'}</p>
      )}

      <LineupEditor
        spelers={spelers}
        opstelling={draft.opstelling}
        afwezig={draft.afwezig}
        onChange={({ opstelling, afwezig }) => wijzigPlan(opstelling, afwezig)}
        onHussel={doeHussel}
      />

      {kanTonen && <MinutesList blokken={sch} opstelling={draft.opstelling} naam={naam} />}
    </div>
  )
}

/** Hoe de app wisselt in de gekozen stand; achter het i'tje in de wedstrijdkop. */
function WisselRegels({ wissel }: { wissel: WisselStand }) {
  const linies = wissel !== 'vrij'
  return (
    <div className="border-t border-line px-[14px] py-[11px] text-[13.5px] text-muted">
      <div className="eyebrow mb-[6px]">Zo wisselt de app — {WISSEL_STANDEN.find((w) => w.value === wissel)?.label}</div>
      <ul className="list-disc space-y-1 pl-[18px]">
        {wissel === 'vrij' ? (
          <>
            <li>Geen linies: de keeperlijst staat vast, de rest speelt overal.</li>
            <li>De bank rouleert over iedereen, één keer per helft, en niemand zit vlak vóór of ná zijn keepersbeurt.</li>
            <li>Wie erin komt neemt de plek over van wie eruit gaat, ook verdediger ↔ aanvaller.</li>
          </>
        ) : wissel === '5min' ? (
          <>
            <li>Twee linies: 4 achterin (keeper, 2 verdedigers, 1 wissel) en 4 voorin (3 op het veld, 1 wissel).</li>
            <li>De 4 achterin keepen elk één kwart, in de volgorde van de lijst.</li>
            <li>
              Niemand zit op de bank in het blokje vlak vóór of ná zijn keepersbeurt — je gaat warm het doel in en warm
              het veld weer op — en niemand zit twee blokjes achter elkaar.
            </li>
            <li>Voorin schuift de wissel elke 5 minuten door. Wie erin komt neemt de plek over van wie eruit gaat.</li>
          </>
        ) : (
          <>
            <li>Twee linies: 4 achterin (keeper, 2 verdedigers, 1 wissel) en 4 voorin (3 op het veld, 1 wissel).</li>
            <li>Achterin: keeper geweest → volgend kwart de bank in → twee kwarten verdediger → weer keeper.</li>
            <li>Voorin schuift de wissel per kwart door. Wie erin komt neemt de plek over van wie eruit gaat.</li>
          </>
        )}
        <li>Met 8 spelers speelt iedereen 30 minuten.</li>
        <li>
          Wijk je tijdens de wedstrijd af (slepen, uitvaller), dan rekent de app de rest zo eerlijk mogelijk door;
          speeltijd en keeperbeurten tellen wat er echt gespeeld is.
        </li>
      </ul>
      {linies && (
        <p className="mt-[8px]">
          Liever zonder vaste linies? Kies bij <b>Bankbeurten</b> de stand <b>Vrij</b>.
        </p>
      )}
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

/** Draft uit een opgeslagen wedstrijd; spelers die niet (meer) bestaan vallen weg. */
function draftVanMatch(m: Match, spelers: Player[]): Draft {
  const actief = spelers.filter((p) => p.active).map((p) => p.id)
  const ids = new Set(actief)
  const geldig = (l: string[]) => l.filter((id) => ids.has(id))
  // Wie er na het opslaan bij kwam (gastspeler, nieuw kind) staat eerst op afwezig: aantikken bij "Wie is er?".
  const bekend = new Set([...m.achter, ...m.voor, ...m.afwezig])
  const nieuw = actief.filter((id) => !bekend.has(id))
  return {
    id: m.id,
    date: m.date,
    opponent: m.opponent ?? '',
    opstelling: { achter: geldig(m.achter), voor: geldig(m.voor), wissel: m.wissel, formatie: m.formatie },
    afwezig: [...geldig(m.afwezig), ...nieuw],
    live: m.live,
    keepers: m.keepers,
    keepersVast: m.keepersVast,
  }
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
  if (bestaand) return draftVanMatch(bestaand, spelers)

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
      live: null,
      keepers: [],
      keepersVast: false,
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
  return {
    date: datum,
    opponent: '',
    opstelling: { ...verdeling, wissel: '5min', formatie: '1-2-3' },
    afwezig: [],
    live: null,
    keepers: [],
    keepersVast: false,
  }
}
