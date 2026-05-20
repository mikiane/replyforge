"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type HistoryItem = {
  id: string;
  tweet: string;
  comments: string[];
  tone: 1 | 2 | 3;
  directive: string;
  createdAt: number;
  responses: string[];
};

type GenerateResponse = {
  responses?: string[];
  error?: string;
};

const historyKey = "replyforge-history";
const toneLabels: Record<1 | 2 | 3, string> = {
  1: "Malin",
  2: "Cash",
  3: "Nucléaire",
};
const toneDescriptions: Record<1 | 2 | 3, string> = {
  1: "troll subtil",
  2: "condescendant assumé",
  3: "full trash méprisant",
};

function parseComments(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatRelativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) {
    return "à l'instant";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `il y a ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `il y a ${hours} h`;
  }

  const days = Math.floor(hours / 24);

  return `il y a ${days} j`;
}

function truncateTweet(tweet: string) {
  return tweet.length > 50 ? `${tweet.slice(0, 50)}...` : tweet;
}

function loadHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(historyKey);
    const parsed = stored ? (JSON.parse(stored) as HistoryItem[]) : [];

    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const [tweet, setTweet] = useState("");
  const [commentsText, setCommentsText] = useState("");
  const [directive, setDirective] = useState("");
  const [tone, setTone] = useState<1 | 2 | 3>(2);
  const [responses, setResponses] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const comments = useMemo(() => parseComments(commentsText), [commentsText]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 20)));
  }, [history]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setResponses([]);
    setCopiedIndex(null);

    if (!tweet.trim()) {
      setError("Colle un tweet avant de générer.");
      return;
    }

    if (comments.length === 0) {
      setError("Ajoute au moins un commentaire.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tweet: tweet.trim(),
          comments,
          tone,
          directive: directive.trim() || undefined,
        }),
      });

      const data = (await response.json()) as GenerateResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "La génération a échoué.");
      }

      if (!Array.isArray(data.responses) || data.responses.length === 0) {
        throw new Error("Aucune réponse exploitable reçue.");
      }

      const nextResponses = data.responses.slice(0, 3);
      setResponses(nextResponses);

      const nextItem: HistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tweet: tweet.trim(),
        comments,
        tone,
        directive: directive.trim(),
        createdAt: Date.now(),
        responses: nextResponses,
      };

      setHistory((current) => [nextItem, ...current].slice(0, 20));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erreur inconnue pendant la génération.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResponse(response: string, index: number) {
    try {
      await navigator.clipboard.writeText(response);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1400);
    } catch {
      setError("Impossible de copier cette réponse.");
    }
  }

  function loadHistoryItem(item: HistoryItem) {
    setTweet(item.tweet);
    setCommentsText(item.comments.join("\n"));
    setTone(item.tone);
    setDirective(item.directive ?? "");
    setResponses(item.responses);
    setError("");
    setCopiedIndex(null);
  }

  function clearHistory() {
    setHistory([]);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="grid gap-5 rounded-xl border border-gray-800 bg-gray-900 p-4 shadow-2xl shadow-black/30 sm:p-6"
      >
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-gray-200">
            Tweet original
          </span>
          <textarea
            value={tweet}
            onChange={(event) => setTweet(event.target.value)}
            placeholder="Colle le tweet ici..."
            className="min-h-28 resize-y rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-base text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-gray-200">
            Commentaires
          </span>
          <textarea
            value={commentsText}
            onChange={(event) => setCommentsText(event.target.value)}
            placeholder="@user: texte du commentaire... (un par ligne)"
            className="min-h-28 resize-y rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-base text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-gray-200">
            Directive / Angle (optionnel)
          </span>
          <textarea
            value={directive}
            onChange={(event) => setDirective(event.target.value)}
            placeholder="Ex: Attaque l'angle technique, répond en mockant la logique, sois ultra court..."
            className="min-h-20 resize-y rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-base text-gray-100 outline-none transition placeholder:text-gray-600 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
          />
        </label>

        <div className="grid gap-3 rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-gray-200">
              Level Trash
            </span>
            <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-gray-950">
              {toneLabels[tone]}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="1"
            value={tone}
            onChange={(event) =>
              setTone(Number(event.target.value) as 1 | 2 | 3)
            }
            className="h-2 w-full cursor-pointer accent-amber-500"
            aria-label="Niveau de ton"
          />
          <div className="grid grid-cols-3 text-xs font-semibold text-gray-500">
            <span>Malin</span>
            <span className="text-center">Cash</span>
            <span className="text-right">Nucléaire</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm font-medium text-red-200">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-base font-black text-gray-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
        >
          {isLoading ? "Génération..." : "Générer 3 réponses ⚡"}
        </button>
      </form>

      {responses.length > 0 ? (
        <section className="grid gap-4">
          <h2 className="text-xl font-black text-white">Réponses</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {responses.map((response, index) => (
              <article
                key={`${response}-${index}`}
                className="flex min-h-48 flex-col justify-between gap-5 rounded-xl border border-gray-800 bg-gray-900 p-4 shadow-lg shadow-black/20"
              >
                <p className="whitespace-pre-wrap text-base leading-7 text-gray-100">
                  {response}
                </p>
                <button
                  type="button"
                  onClick={() => copyResponse(response, index)}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-500/50 px-4 py-2 text-sm font-bold text-amber-300 transition hover:border-amber-400 hover:bg-amber-500/10"
                >
                  📋 {copiedIndex === index ? "Copié" : "Copier"}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Historique</h2>
            <p className="mt-1 text-sm text-gray-500">
              Les 20 dernières générations restent dans ce navigateur.
            </p>
          </div>
          <button
            type="button"
            onClick={clearHistory}
            disabled={history.length === 0}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-300 transition hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Vider
          </button>
        </div>

        {history.length > 0 ? (
          <div className="grid gap-3">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => loadHistoryItem(item)}
                className="grid gap-2 rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-left transition hover:border-amber-500/60 hover:bg-gray-900"
              >
                <span className="text-sm font-semibold text-gray-200">
                  {truncateTweet(item.tweet)}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
                  <span className="rounded-full bg-gray-800 px-2 py-1 text-amber-300">
                    {toneLabels[item.tone]}
                  </span>
                  {item.directive ? (
                    <span className="rounded-full bg-gray-800 px-2 py-1 text-gray-300">
                      {truncateTweet(item.directive)}
                    </span>
                  ) : null}
                  <span>{formatRelativeTime(item.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-950 px-4 py-8 text-center text-sm text-gray-500">
            Aucun historique pour le moment.
          </div>
        )}
      </section>
    </main>
  );
}
