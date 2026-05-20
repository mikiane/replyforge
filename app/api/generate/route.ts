type GenerateRequest = {
  tweet?: unknown;
  comments?: unknown;
  tone?: unknown;
};

const toneLabels: Record<1 | 2 | 3, string> = {
  1: "Malin",
  2: "Cash",
  3: "Nucl\u00e9aire",
};

const systemPrompt = `Tu es un expert en r\u00e9ponses Twitter/X. Ton style : cash, direct, honn\u00eate, sarcastique mais jamais m\u00e9chant.
Tu r\u00e9ponds \u00e0 des commentaires sur des tweets.

R\u00c8GLES :
- Punchline en 1\u00e8re ligne, d\u00e9tail ou question subtile en 2e
- 1 \u00e0 3 phrases max
- JAMAIS : "great point", "I think", excuses, formules de politesse, liens externes
- TOUJOURS : prendre position, dire les choses front, match s\u00e9mantique avec le tweet original
- Utiliser des mots-cl\u00e9s du tweet original
- Poser une question implicite ou ouvrir un angle pour forcer le reply en retour (algo X)
- Viser le bookmark : apporter une info/valeur

NIVEAU DE TON : {tone}
- Malin = spirituel, ironique, pince-sans-rire
- Cash = direct, franc, pas de filtre
- Nucl\u00e9aire = brutal mais dr\u00f4le, assum\u00e9, tranchant

R\u00e9ponds AVEC EXACTEMENT ce JSON, sans aucun texte autour, sans backticks :
{"responses":["proposition 1","proposition 2","proposition 3"]}
Langue de r\u00e9ponse = langue du commentaire.`;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function validateBody(body: GenerateRequest) {
  const tweet = typeof body.tweet === "string" ? body.tweet.trim() : "";
  const comments = Array.isArray(body.comments)
    ? body.comments
        .filter((comment): comment is string => typeof comment === "string")
        .map((comment) => comment.trim())
        .filter(Boolean)
    : [];
  const tone =
    typeof body.tone === "number" && [1, 2, 3].includes(body.tone)
      ? (body.tone as 1 | 2 | 3)
      : null;

  return { tweet, comments, tone };
}

function parseJsonResponse(text: string): string[] {
  // Strip markdown code fences
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { responses?: unknown };
    if (Array.isArray(parsed.responses)) {
      return parsed.responses
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch {
    // Fallback: extract quoted strings from the text
    const regex = /"([^"]{3,500})"/g;
    let match;
    const results: string[] = [];
    while ((match = regex.exec(text)) !== null) {
      results.push(match[1].trim());
    }
    // Remove the JSON key "responses" if captured (it's too short or exact match)
    const filtered = results.filter((r) => r !== "responses");
    if (filtered.length >= 2) return filtered.slice(0, 3);

    // Last resort: try numbered items
    const lines = text.split("\n");
    const fallback: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\d+[\.\)]\s+(.+)$/);
      if (m && m[1].trim()) fallback.push(m[1].trim());
    }
    if (fallback.length >= 2) return fallback.slice(0, 3);
  }
  return [];
}

export async function POST(request: Request) {
  let body: GenerateRequest;

  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return jsonError("JSON invalide.", 400);
  }

  const { tweet, comments, tone } = validateBody(body);

  if (!tweet) {
    return jsonError("Le tweet est requis.", 400);
  }

  if (comments.length === 0) {
    return jsonError("Au moins un commentaire est requis.", 400);
  }

  if (!tone) {
    return jsonError("Le ton doit \u00eatre 1, 2 ou 3.", 400);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return jsonError("OPENROUTER_API_KEY est manquant c\u00f4t\u00e9 serveur.", 500);
  }

  const userMessage = `Tweet original :
${tweet}

Commentaires :
${comments.map((comment) => `- ${comment}`).join("\n")}

Ton demand\u00e9 : ${toneLabels[tone]} (${tone})`;

  const modelToUse = process.env.LLM_MODEL || "anthropic/claude-sonnet-4-20250514";

  try {
    const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://replyforge.staging.myapp.technology",
        "X-Title": "ReplyForge",
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: systemPrompt.replace("{tone}", toneLabels[tone]),
          },
          { role: "user", content: userMessage },
        ],
        temperature: 0.9,
        max_tokens: 600,
      }),
    });

    const data = (await llmResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!llmResponse.ok) {
      return jsonError(
        data.error?.message ?? "Erreur LLM pendant la g\u00e9n\u00e9ration.",
        llmResponse.status,
      );
    }

    const content = data.choices?.[0]?.message?.content ?? "";

    if (!content) {
      return jsonError("Le LLM n'a retourn\u00e9 aucun contenu.", 502);
    }

    const responses = parseJsonResponse(content);

    if (responses.length < 2) {
      console.error("LLM response could not be parsed:", content);
      return jsonError("R\u00e9ponse LLM invalide ou incompl\u00e8te.", 502);
    }

    // Pad to 3 if needed
    while (responses.length < 3) {
      responses.push("(g\u00e9n\u00e9ration partielle - r\u00e9essayez)");
    }

    return Response.json({ responses });
  } catch (error) {
    console.error("ReplyForge generate error:", error);
    return jsonError("Impossible de joindre le LLM.", 502);
  }
}
