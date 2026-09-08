/**
 * Genereert public/kwart.mp3: precies één kwart (10 minuten) stilte met een piep op 5:00
 * (wissel) en een dubbele piep op 10:00 (einde). De audiospeler van de telefoon houdt zo
 * de tijd bij, ook met het scherm op slot — JavaScript-timers worden dan stilgezet.
 *
 *   node scripts/maak-kwartaudio.mjs
 *
 * Mono, 8 kHz, 16 kbps: ± 1,2 MB. Toonhoogtes gelijk aan de piep in MatchClock.tsx.
 */
import { writeFileSync } from 'node:fs'
import lamejs from '@breezystack/lamejs'

const SAMPLE_RATE = 8_000
const KBPS = 16
const DUUR_S = 600
const WISSEL_S = 300

/** [startseconde, frequentie, duur in s] — een piep is een blokgolf, hard genoeg voor een broekzak. */
const PIEPEN = [
  [WISSEL_S, 988, 0.3],
  [WISSEL_S + 0.4, 1319, 0.3],
  [DUUR_S - 1.2, 880, 0.3],
  [DUUR_S - 0.8, 880, 0.3],
  [DUUR_S - 0.4, 1175, 0.35],
]

const samples = new Int16Array(SAMPLE_RATE * DUUR_S)
for (const [start, freq, duur] of PIEPEN) {
  const van = Math.floor(start * SAMPLE_RATE)
  const tot = Math.min(samples.length, Math.floor((start + duur) * SAMPLE_RATE))
  for (let i = van; i < tot; i++) {
    const t = (i - van) / SAMPLE_RATE
    // korte fade in/uit tegen tikken
    const env = Math.min(1, t / 0.01, (duur - t) / 0.02)
    const blok = Math.sign(Math.sin(2 * Math.PI * freq * t))
    samples[i] = Math.round(blok * env * 0.6 * 32767)
  }
}

const enc = new lamejs.Mp3Encoder(1, SAMPLE_RATE, KBPS)
const delen = []
const STAP = 1152 * 16
for (let i = 0; i < samples.length; i += STAP) {
  const buf = enc.encodeBuffer(samples.subarray(i, i + STAP))
  if (buf.length) delen.push(Buffer.from(buf))
}
const rest = enc.flush()
if (rest.length) delen.push(Buffer.from(rest))

const uit = Buffer.concat(delen)
writeFileSync(new URL('../public/kwart.mp3', import.meta.url), uit)
console.log(`public/kwart.mp3: ${(uit.length / 1024 / 1024).toFixed(2)} MB, ${DUUR_S} s`)
