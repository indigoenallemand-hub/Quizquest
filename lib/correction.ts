import Anthropic from "@anthropic-ai/sdk";

export interface CorrectionResult {
  correcte: boolean;
  feedback: string;
}

const CORRECTION_TOOL: Anthropic.Tool = {
  name: "submit_correction",
  description: "Rend le verdict de correction pour la réponse libre de l'utilisateur.",
  input_schema: {
    type: "object",
    properties: {
      correcte: {
        type: "boolean",
        description: "true si la réponse est juridiquement/numériquement correcte, même formulée différemment.",
      },
      feedback: {
        type: "string",
        description: "Un ou deux phrases expliquant pourquoi la réponse est correcte ou non.",
      },
    },
    required: ["correcte", "feedback"],
  },
};

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY n'est pas configurée côté serveur.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function correctFreeTextAnswer(params: {
  enonce: string;
  reponseAttendue: string;
  reponseUtilisateur: string;
}): Promise<CorrectionResult> {
  const { enonce, reponseAttendue, reponseUtilisateur } = params;

  const response = await getClient().messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
    max_tokens: 400,
    system:
      "Tu corriges des réponses libres à un quiz de droit du bail suisse. " +
      "Accepte une formulation différente de la réponse attendue si le sens juridique ou " +
      "numérique est correct. Sois tolérant sur la forme, strict sur le fond. " +
      "Réponds uniquement en appelant l'outil submit_correction.",
    tools: [CORRECTION_TOOL],
    tool_choice: { type: "tool", name: "submit_correction" },
    messages: [
      {
        role: "user",
        content: `Énoncé de la question :\n${enonce}\n\nRéponse attendue :\n${reponseAttendue}\n\nRéponse de l'utilisateur :\n${reponseUtilisateur}`,
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("L'IA n'a pas retourné de correction structurée.");
  }

  const input = toolUse.input as { correcte: boolean; feedback: string };
  return { correcte: input.correcte, feedback: input.feedback };
}
