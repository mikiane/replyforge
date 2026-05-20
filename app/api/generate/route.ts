type GenerateRequest = {
  tweet?: unknown;
  comments?: unknown;
  tone?: unknown;
  directive?: unknown;
};

const toneLabels: Record<1 | 2 | 3, string> = {
  1: "Malin",
  2: "Cash",
  3: "Nucléaire",
};

const systemPrompt = `Tu es un générateur de réponses Twitter/X cash, tranchant, avec du caractère.
Ton style : direct, un poil sarcastique, honnête, mais TOUJOURS compréhensible.
Tu réponds aux commentaires sur des tweets.

LANGUE : Répondre dans la même langue que le commentaire. Français = français.
Pas d'anglais sauf si le commentaire est en anglais ou si le meme est universel.

RÈGLES :
- 1 à 3 phrases MAXIMUM, mais CHAQUE phrase doit avoir du sens
- Punchline en 1ère ligne, puis un détail, une question, ou un angle en 2e phrase
- Prendre position clairement, jamais hedger
- Match sémantique : reprendre les mots-clés du tweet original
- Pas de politesse, pas d'excuses, pas de "great point", pas de "I think"
- Condescendant mais INTELLIGIBLE : le reader doit comprendre ta réponse sans effort
- Mépris déguisé en humour plutôt qu'insulte frontale
- Pas de liens, pas de hashtags

À ÉVITER :
- Réponses d'un seul mot ("lol", "cope", "yes", "no", "true") — c'est de la flemme, pas du style
- Mots anglais isolés dans une réponse française (sauf meme vraiment connu comme "skill issue" ou "ratio")
- Phrases de plus de 50 mots
- Insultes vulgaires ou attaques personnelles
- Réponse incompréhsible ou trop cryptique

OBJECTIF ALGO X :
- Provoquer le reply en retour ou le quote-tweet
- Viser le screenshot viral
- Forcer l'engagement

NIVEAU DE TRASH : {tone}
- Malin = ironie fine, sous-entendu, question qui pique ("Intéressant comme analyse... Tu es sûr de toi ?")
- Cash = direct, franc, sans filtre, condescendant assumé ("T'as jamais entendu parler de X ? Curieux pour quelqu'un qui donne son avis.")
- Nucléaire = tranchant, moqueur, lapidaire mais COMPREHENSIBLE ("Si ta compréhension du sujet s'arrête au titre du tweet, c'est normal que tu sois perdu.")

RÉPONDS AVEC EXACTEMENT CE JSON, sans texte autour, sans backticks, sans markdown :
{"responses":["proposition 1","proposition 2","proposition 3"]}

Chaque proposition = 1 à 3 phrases complètes, dans la langue du commentaire.`;

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
  const directive =
    typeof body.directive === "string" ? body.directive.trim() : "";

  return { tweet, comments, tone, directive };
}

function parseJsonResponse(text: string): string[] {
  const cleaned = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();
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
    const regex = /"([^"]{5,500})"/g;
    let match;
    const results: string[] = [];
    while ((match = regex.exec(text)) !== null) {
      results.push(match[1].trim());
    }
    const filtered = results.filter((r) => r !== "responses");
    if (filtered.length >= 2) return filtered.slice(0, 3);

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

  const { tweet, comments, tone, directive } = validateBody(body);

  if (!tweet) {
    return jsonError("Le tweet est requis.", 400);
  }

  if (comments.length === 0) {
    return jsonError("Au moins un commentaire est requis.", 400);
  }

  if (!tone) {
    return jsonError("Le ton doit être 1, 2 ou 3.", 400);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return jsonError("OPENROUTER_API_KEY est manquant côté serveur.", 500);
  }

  const directiveLine = directive ? `\nDirective / Angle : ${directive}` : "";

  const userMessage = `Tweet original :
${tweet}

Commentaires :
${comments.map((comment) => `- ${comment}`).join("\n")}

Niveau de trash demandé : ${toneLabels[tone]} (${tone})${directiveLine}`;

  const modelToUse = "anthropic/claude-sonnet-4";

  try {
    const llmResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
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
      }
    );

    const data = (await llmResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!llmResponse.ok) {
      return jsonError(
        data.error?.message ?? "Erreur LLM pendant la génération.",
        llmResponse.status
      );
    }

    const content = data.choices?.[0]?.message?.content ?? "";

    if (!content) {
      return jsonError("Le LLM n'a retourné aucun contenu.", 502);
    }

    const responses = parseJsonResponse(content);

    if (responses.length < 2) {
      console.error("LLM response could not be parsed:", content);
      return jsonError("Réponse LLM invalide ou incomplète.", 502);
    }

    while (responses.length < 3) {
      responses.push("(génération partielle - réessayez)");
    }

    return Response.json({ responses });
  } catch (error) {
    console.error("ReplyForge generate error:", error);
    return jsonError("Impossible de joindre le LLM.", 502);
  }
}
