import { READING_LEVEL_AUDIENCE, type ReadingLevel } from '@/lib/content/labels';

/**
 * A text at up to three reading levels. Every available version is in the static HTML; CSS keyed on
 * <html data-reading-level> shows one (see styles/learning.css), falling back kids -> teen -> adult.
 * Without JavaScript the adult text shows.
 */
export default function LeveledText({
  adult,
  teen,
  kids,
  className,
  tagged = false,
}: {
  adult: string;
  teen?: string;
  kids?: string;
  className?: string;
  /** Label each version with its audience, for pages where the level must be explicit. */
  tagged?: boolean;
}) {
  const versions: [ReadingLevel, string | undefined][] = [
    ['adult', adult],
    ['teen', teen],
    ['kids', kids],
  ];
  return (
    <div className={`rl ${className ?? ''}`} data-has-teen={teen ? '' : undefined} data-has-kids={kids ? '' : undefined}>
      {versions.map(([level, text]) =>
        text ? (
          <p key={level} data-rl={level}>
            {tagged && level !== 'adult' ? <span className="rl__tag">{READING_LEVEL_AUDIENCE[level]}</span> : null}
            {text}
          </p>
        ) : null,
      )}
    </div>
  );
}
