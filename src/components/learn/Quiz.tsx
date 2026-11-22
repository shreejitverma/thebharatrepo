'use client';

import { useId, useState } from 'react';
import type { CitationView } from '@/lib/content/learning';

export interface QuizQuestionView {
  id: string;
  question: string;
  choices: { text: string; correct: boolean; explanation: string }[];
  sources: CitationView[];
}

function Citation({ c }: { c: CitationView }) {
  return c.href ? (
    <a href={c.href} rel="noopener noreferrer" target="_blank">
      {c.text}
    </a>
  ) : (
    <>{c.text}</>
  );
}

function Question({ q, n, onChecked }: { q: QuizQuestionView; n: number; onChecked: (id: string, correct: boolean) => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [hint, setHint] = useState(false);
  const name = useId();
  const correctIdx = q.choices.findIndex((c) => c.correct);

  const check = () => {
    if (choice === null) {
      setHint(true);
      return;
    }
    setHint(false);
    setChecked(true);
    onChecked(q.id, choice === correctIdx);
  };

  return (
    <li>
      <fieldset className="quiz__q">
        <legend>
          {n}. {q.question}
        </legend>
        <ul className="quiz__choices">
          {q.choices.map((c, i) => {
            const state = checked ? (i === correctIdx ? 'correct' : i === choice ? 'wrong' : undefined) : undefined;
            return (
              <li key={i}>
                <label className="quiz__choice" data-state={state}>
                  <input type="radio" name={name} value={i} checked={choice === i} disabled={checked} onChange={() => setChoice(i)} />
                  <span>{c.text}</span>
                  {state === 'correct' ? <span className="quiz__mark">{i === choice ? 'Your answer: correct' : 'Correct answer'}</span> : null}
                  {state === 'wrong' ? <span className="quiz__mark">Your answer: not correct</span> : null}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="quiz__feedback" role="status" aria-live="polite">
          {hint && !checked ? <p>Choose an answer first.</p> : null}
          {checked && choice !== null ? (
            <>
              <p>
                <strong>{choice === correctIdx ? 'Correct.' : 'Not quite.'}</strong> {q.choices[correctIdx].explanation}
              </p>
              {choice !== correctIdx ? (
                <p>
                  <strong>About your answer:</strong> {q.choices[choice].explanation}
                </p>
              ) : null}
              <p className="muted" style={{ marginBottom: 0 }}>
                How we know:
              </p>
              <ul className="quiz__sources">
                {q.sources.map((s, i) => (
                  <li key={i}>
                    <Citation c={s} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        {!checked ? (
          <button type="button" className="btn" style={{ marginTop: 10 }} onClick={check}>
            Check answer
          </button>
        ) : null}
      </fieldset>
    </li>
  );
}

/** Multiple-choice quiz with client-side scoring. Nothing is sent anywhere or stored. */
export default function Quiz({ questions }: { questions: QuizQuestionView[] }) {
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [round, setRound] = useState(0);
  const answered = Object.keys(results).length;
  const right = Object.values(results).filter(Boolean).length;
  const done = answered === questions.length;

  return (
    <div className="quiz">
      {/* A new key remounts every question, clearing its answer, when the quiz is restarted. */}
      <ol className="quiz__list" key={round}>
        {questions.map((q, i) => (
          <Question key={q.id} q={q} n={i + 1} onChecked={(id, ok) => setResults((r) => (id in r ? r : { ...r, [id]: ok }))} />
        ))}
      </ol>
      <div className="quiz__actions">
        <p className="quiz__score" role="status" aria-live="polite">
          {answered === 0
            ? `${questions.length} questions. Choose an answer, then check it.`
            : done
              ? `You answered ${right} of ${questions.length} correctly.`
              : `${right} of ${answered} checked answers correct so far; ${questions.length - answered} to go.`}
        </p>
        {answered > 0 ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setResults({});
              setRound((n) => n + 1);
            }}
          >
            Start the quiz again
          </button>
        ) : null}
      </div>
    </div>
  );
}
