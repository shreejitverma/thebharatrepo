import type { Metadata } from 'next';
import Link from 'next/link';
import GradeBadge from '@/components/GradeBadge';
import { GRADES, GRADE_LABELS, METHOD_LABELS, DATING_METHODS, isTraditional } from '@/lib/content/labels';
import { SEGMENTS } from '@/lib/time/scale';
import { BOUNDARY_LABELS } from '@/components/kaalchakra/shared';
import { YUGA_YEARS } from '@/lib/time';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'How The Bharat Repo grades evidence, separates scholarship from tradition, places entries in time, and verifies every source.',
};

const GRADE_TEXT: Record<string, string> = {
  A: 'A dated inscription, a coin legend, a contemporary foreign record, a calibrated radiocarbon series from a stratified excavation, or contemporary documents for modern events.',
  B: 'Several independent lines of evidence converge and the position is mainstream in peer-reviewed scholarship.',
  C: 'A reasoned estimate from internal textual, linguistic or stylistic evidence, with live scholarly disagreement.',
  D: 'Puranic, Siddhantic, Itihasa or sampradaya chronology. Shown faithfully in the Tradition lens, never presented as dated history.',
  E: 'A single-author reconstruction without wide acceptance, such as many astronomical datings of epic events. Shown, clearly labelled, so readers can judge it.',
};

export default function MethodologyPage() {
  return (
    <div className="main-content">
      <div className="prose-wrap">
        <p className="eyebrow">Methodology</p>
        <h1>How we know what we say</h1>
        <p className="lede" style={{ marginTop: 0 }}>
          The authority of this archive rests on one rule: never overstate. Every claim carries its evidence and its grade, and where credible positions disagree, all of them are shown.
        </p>

        <h2 id="grades">Evidence grades</h2>
        <p>Each dating and each key claim receives one of five grades. The shape of the badge carries meaning as well as its colour: squares for scholarship, a circle for tradition, an outline for speculation.</p>
        <div style={{ display: 'grid', gap: 14 }}>
          {GRADES.map((g) => (
            <div key={g}>
              <GradeBadge grade={g} />
              <p style={{ margin: '4px 0 0' }}>{GRADE_TEXT[g]}</p>
            </div>
          ))}
        </div>

        <h2>Two lenses</h2>
        <p>
          The <strong>Scholarship lens</strong> shows datings from archaeology, epigraphy, numismatics, linguistics, genetics and documentary evidence. The <strong>Tradition lens</strong> shows the chronology of the Puranas, the Siddhantas and the sampradayas, including the cosmology of kalpas and yugas. The default view shows both, side by side, so a reader sees exactly where they meet and where they part. Tradition is never quietly corrected out of existence, and it is never presented as dated history.
        </p>

        <h2>Dating methods</h2>
        <ul>
          {DATING_METHODS.map((m) => (
            <li key={m}>
              {METHOD_LABELS[m]} {isTraditional(m) ? <span className="muted">(Tradition lens, always grade D)</span> : null}
            </li>
          ))}
        </ul>

        <h2>The scale of the wheel</h2>
        <p>
          The archive spans about two billion years of traditional cosmology and three million years of human prehistory, but most entries fall in the last five thousand years. No single scale can show both honestly, so the Kaalchakra divides time into eras. Each era has a fixed share of the wheel and its own scale, and every change of scale is drawn as a dashed line.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.95rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--line)' }}>Era</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--line)' }}>Starts</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--line)' }}>Share of wheel</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--line)' }}>Scale</th>
              </tr>
            </thead>
            <tbody>
              {SEGMENTS.map((s) => (
                <tr key={s.id}>
                  <td style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{s.label}</td>
                  <td style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{BOUNDARY_LABELS[s.id] ?? 'Start of the kalpa (tradition)'}</td>
                  <td style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{Math.round(s.share * 100)}%</td>
                  <td style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{s.interp === 'log' ? 'Logarithmic' : 'Linear'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Calendars</h2>
        <p>
          All years are stored in astronomical numbering, where 1 BCE is year 0, and shown in CE and BCE by default. The Kaalchakra can also show years ago, Vikram Samvat (epoch 57 BCE), Shaka Samvat (epoch 78 CE) and the Kali Yuga era, whose epoch of 18 February 3102 BCE comes from Siddhantic reckoning and is stated by Aryabhata in 499 CE. Indian era years begin in spring in most regional calendars, so a Gregorian year spans two era years; we show the era year that begins in it.
        </p>
        <p>
          Traditional cosmology counts a Kali Yuga of {YUGA_YEARS.kali.toLocaleString('en-US')} years, a mahayuga of {YUGA_YEARS.mahayuga.toLocaleString('en-US')} years and a kalpa of {YUGA_YEARS.kalpa.toLocaleString('en-US')} years.
        </p>

        <h2>Sources and verification</h2>
        <p>
          Primary sources come first: the text with its verse, the inscription with its corpus number, the excavation report, the coin, the genome. Encyclopaedias such as Wikipedia are finding aids, never citations. Before anything is published, an automated check resolves every DOI against Crossref and every ISBN against Open Library and Google Books, and confirms that the resolved title matches the work cited. Wikidata identifiers and Wikimedia Commons images are checked the same way. A source that cannot be verified is not used.
        </p>
        <p>
          Machine verification proves a source exists and is the work named. It does not prove that the source says what we claim, which is why every page also shows its editorial review status. Entries and articles are currently drafted by AI models and marked draft until a subject editor reviews them; a notice on every page says so, and each entry and article page shows its own status.
        </p>

        <h2>Corrections</h2>
        <p>
          Every page has a link to report an error. Substantive changes are recorded in the public <Link href="/corrections">corrections log</Link>, and the full history of every page is public in the <a href="https://github.com/shreejitverma/thebharatrepo">source repository</a>.
        </p>
        <p className="muted">
          Grade meanings at a glance: {GRADES.map((g) => `${g}, ${GRADE_LABELS[g].toLowerCase()}`).join('; ')}.
        </p>
      </div>
    </div>
  );
}
