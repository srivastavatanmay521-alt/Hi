import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getClaudeClients(): Anthropic[] {
  const keys = [
    process.env["CLAUDE_API_KEY_1"],
    process.env["CLAUDE_API_KEY_2"],
    process.env["CLAUDE_API_KEY_3"],
  ].filter((k): k is string => typeof k === "string" && k.length > 0);
  return keys.map((key) => new Anthropic({ apiKey: key }));
}

function getGeminiClient(): GoogleGenAI | null {
  const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  if (!baseUrl || !apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: "", baseUrl },
  });
}

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return JSON.parse(fence[1].trim());
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) return JSON.parse(brace[0]);
  return JSON.parse(text.trim());
}

async function generateWithClaude(
  clients: Anthropic[],
  prompt: string,
  lang: string,
  log: typeof logger,
): Promise<unknown> {
  if (clients.length >= 3) {
    log.info("Claude 3-agent pipeline starting");

    const arch = await clients[0].messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `You are a senior Discord bot architect.\nUser wants: "${prompt}"\nLanguage: ${lang}\n\nList all files needed (name + one-line purpose). Include entry point, commands, events, config, package.json or requirements.txt, README.md.`,
      }],
    });
    const plan = (arch.content[0] as { text: string }).text;

    const code = await clients[1].messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `Architecture plan:\n${plan}\n\nImplement every file completely in ${lang}. Use discord.js v14 or discord.py. No placeholders, no TODOs.\n\nReturn ONLY valid JSON (no markdown):\n{"files":[{"name":"...","content":"..."}]}`,
      }],
    });
    const draft = (code.content[0] as { text: string }).text;

    const review = await clients[2].messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: `Review and fix bugs in this Discord bot:\n${draft}\n\nReturn ONLY corrected JSON (no markdown):\n{"files":[{"name":"...","content":"..."}]}`,
      }],
    });
    return extractJson((review.content[0] as { text: string }).text);
  }

  // Single-key fallback
  const resp = await clients[0].messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 8192,
    messages: [{
      role: "user",
      content: `Build a complete Discord bot for: "${prompt}"\nLanguage: ${lang}\nUse discord.js v14 or discord.py. All files complete, no placeholders.\n\nReturn ONLY JSON:\n{"files":[{"name":"...","content":"..."}]}`,
    }],
  });
  return extractJson((resp.content[0] as { text: string }).text);
}

async function generateWithGemini(
  client: GoogleGenAI,
  prompt: string,
  lang: string,
  log: typeof logger,
): Promise<unknown> {
  log.info("Gemini 3-step pipeline starting");

  const systemPrompt = `You are an expert Discord bot developer. Build complete, production-ready ${lang} Discord bot code.
Use discord.js v14 (with slash commands, Intents, etc.) for JavaScript, or discord.py for Python.
Write real, working code — no placeholders, no TODO comments, fully implemented.
Always return ONLY valid JSON in this format (no markdown fences, no explanation):
{"files":[{"name":"filename.ext","content":"full file content"}]}`;

  // Step 1: Plan
  const planResp = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nStep 1 - Plan the file structure for: "${prompt}"\nList all files with their purpose. Be specific and complete.` }] }],
  });
  const plan = planResp.text ?? "";

  // Step 2: Implement
  const codeResp = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nPlan:\n${plan}\n\nStep 2 - Implement ALL files completely. Return only JSON:\n{"files":[{"name":"...","content":"..."}]}` }] }],
    config: { maxOutputTokens: 8192 },
  });
  const draft = codeResp.text ?? "";

  // Step 3: Review & fix
  const reviewResp = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nReview this implementation for bugs and fix them:\n${draft}\n\nReturn only the corrected JSON:\n{"files":[{"name":"...","content":"..."}]}` }] }],
    config: { maxOutputTokens: 8192 },
  });
  const final = reviewResp.text ?? "";

  return extractJson(final);
}

router.post("/generate", async (req, res) => {
  const { prompt, language } = req.body as { prompt?: string; language?: string };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  const lang = language === "python" ? "python" : "javascript";

  try {
    // Try Claude first (3-agent pipeline)
    const claudeClients = getClaudeClients();
    if (claudeClients.length > 0) {
      try {
        req.log.info("Attempting Claude pipeline");
        const result = await generateWithClaude(claudeClients, prompt, lang, logger);
        res.json(result);
        return;
      } catch (claudeErr) {
        const msg = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
        req.log.warn({ msg }, "Claude failed, falling back to Gemini");
      }
    }

    // Fallback: Gemini via Replit AI Integrations
    const gemini = getGeminiClient();
    if (!gemini) {
      res.status(500).json({ error: "No AI provider available. Please check your API keys." });
      return;
    }

    const result = await generateWithGemini(gemini, prompt, lang, logger);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Generation failed");
    const message = err instanceof Error ? err.message : "Unknown error occurred.";
    res.status(500).json({ error: message });
  }
});

export default router;
