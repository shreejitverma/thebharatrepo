/**
 * An entity's name in native script and in IAST, each with its language tag so the right font,
 * hyphenation and screen-reader voice apply. Renders nothing when neither name exists.
 * Usable from server and client components (no hooks).
 */
export default function EntityNames({
  native,
  iast,
  nativeLang,
  iastLang,
  className = 'names',
}: {
  native?: string;
  iast?: string;
  nativeLang?: string;
  iastLang?: string;
  className?: string;
}) {
  if (!native && !iast) return null;
  return (
    <div className={className}>
      {native ? (
        <span className="name-native" lang={nativeLang ?? 'und'}>
          {native}
        </span>
      ) : null}
      {/* A real space between the two, so text extracted from the page (the search excerpt) does not run them together. */}
      {native && iast ? ' ' : null}
      {iast ? (
        <span className="name-iast" lang={iastLang ?? 'sa-Latn'}>
          {iast}
        </span>
      ) : null}
    </div>
  );
}
