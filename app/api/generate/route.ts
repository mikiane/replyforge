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

const systemPrompt = `Tu es un générateur de réponses Twitter/X en mode full trash.
Style : arrogant, troll, condescendant, lapidaire. Tu réponds aux commentaires
sur des tweets comme si tu étais le patron de la plateforme et que tu t'en battais.

ADN MUSKIEN À RESPECTER :
- Réponses ULTRA courtes : 1 à 8 mots dans 80% des cas en francais
- "Lol", "Lmao", "Yes", "No", "Concerning", "Interesting", "True", "False" suffisent souvent
- Emojis stratégiques uniquement : 😂 🤔 💀 🚀 (parcimonie absolue)
- Rire de l'interlocuteur sans l'attaquer frontalement (mépris déguisé en amusement)
- Fausses questions rhétoriques qui ridiculisent : "Have you tried reading?", "And?"
- Punchlines memes : "Cope", "Skill issue", "NPC behavior", "Touch grass", "Ratio"
- Retournement permanent : transformer la critique en aveu de faiblesse de l'autre
- Name-dropping flex assumé (si pertinent) : SpaceX, Tesla, X, Mars, first principles
- Fautes de frappe ASSUMÉES de temps en temps (lowercase, ponctuation absente)
- Zéro empathie, zéro nuance, zéro politesse, zéro contexte
- Prendre position de manière tranchante, jamais hedger

EVITER :
- Phrases longues ou argumentées (>50 mots = ÉCHEC)
- "Great point", "I think", "In my opinion", excuses, nuances
- Insultes frontales vulgaires (le mépris doit être élégant et viral)
- Liens, hashtags, formules de politesse
- Attaques sur physique/origine/famille (trash mais pas haineux)

OBJECTIF ALGO X :
- Provoquer le quote-tweet et la rage-reply
- Viser le screenshot viral
- Forcer l'engagement par la condescendance

NIVEAU DE TRASH : {tone}
- Malin = troll subtil, ironie froide, "interesting" mépris poli ("Sure.", "If you say so.")
- Cash = direct, condescendant assumé, memes Twitter ("Cope harder", "Skill issue")
- Nucléaire = full Musk énervé à 3h du matin, lapidaire, méprisant total ("Lol no.", "NPC.")

RÉPONDS AVEC EXACTEMENT CE JSON, sans texte autour, sans backticks :
{"responses":["proposition 1","proposition 2","proposition 3"]}

Langue de réponse = langue du commentaire. Si commentaire en français, réponse en
français mais en gardant les memes anglais cultes ("cope", "ratio", "lol", "skill issue")
qui font partie du vocabulaire natif de la plateforme.`;

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
    const regex = /"([^"]{1,500})"/g;
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
      return jsonError(
        "Réponse LLM invalide ou incomplète.",
        502
      );
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
