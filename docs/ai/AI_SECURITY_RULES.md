# AI Security Rules

- Never include another user's data in AI context.
- Never send secrets, tokens, password hashes, or internal keys to an LLM.
- Minimize context to the user's question.
- Store enough metadata to audit what context was used.
- Rate limit AI endpoints.
- Treat AI output as advisory text, not an authoritative financial decision.
- Add prompt-injection defenses before allowing document or free-form context ingestion.
