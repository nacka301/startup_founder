import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/**
 * Lazily-constructed Anthropic client. Reads `ANTHROPIC_API_KEY` from the
 * environment at first use (server-only — the key must never reach the browser).
 */
export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}
