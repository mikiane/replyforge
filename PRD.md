# ReplyForge — PRD

## Concept
App web qui génère 3 réponses "cash mais honnêtes, un poil sarcastiques" pour commenter sur X. Optimisée pour l'algo X.

## Stack
- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **OpenAI API** — modèle `gpt-5-nano` (GPT 5.5 instant) pour les générations
- Deploy sur Docker / Coolify

## Fonctionnalités V1
1. **Input tweet original** — textarea pour coller le tweet
2. **Input commentaire(s)** — textarea pour coller 1+ commentaires (format: @user: texte, un par ligne)
3. **Curseur de ton** — 3 niveaux : "Malin" → "Cash" → "Nucléaire"
4. **3 propositions** générées par GPT-5.5 avec un bouton 📋 copier pour chacune
5. **Historique local** — localStorage des 20 dernières générations
6. **UI** — sombre, moderne, minimaliste, mobile-first

## System Prompt envoyé à GPT-5.5
```
Tu es un expert en réponses Twitter/X. Ton style : cash, direct, honnête, sarcastique mais jamais méchant.
Tu réponds à des commentaires sur des tweets.

RÈGLES :
- Punchline en 1ère ligne, détail ou question subtile en 2e
- 1 à 3 phrases max
- JAMAIS : "great point", "I think", excuses, formules de politesse, liens externes
- TOUJOURS : prendre position, dire les choses front, match sémantique avec le tweet original
- Utiliser des mots-clés du tweet original pour le matching SimClusters
- Poser une question implicite ou ouvrir un angle pour forcer le reply en retour (algo X)
- Viser le bookmark : apporter une info/valeur

NIVEAU DE TON : {tone}
- Malin = spirituel, ironique, pince-sans-rire
- Cash = direct, franc, pas de filtre
- Nucléaire = brutal mais drôle, assumé, tranchant

Réponds en 3 propositions courtes, chacune dans un bloc séparé numérotées 1 2 3.
Langue de réponse = langue du commentaire.
```

## Structure du projet
```
replyforge/
├── app/
│   ├── layout.tsx
│   ├── page.tsx          # main UI
│   ├── api/generate/route.ts  # API call to OpenAI
│   └── globals.css
├── components/
│   ├── ToneSelector.tsx
│   ├── ResponseCard.tsx
│   └── History.tsx
├── lib/
│   └── utils.ts
├── public/
├── package.json
├── Dockerfile
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```

## Environment variables
- `OPENAI_API_KEY` = clé API OpenAI (la même que pour les apps déployées)

## Deploy
- Dockerfile multi-stage pour Next.js standalone
- Port 3000
- Build avec `npm run build` → `npm start`
