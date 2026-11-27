"""Retrieval-Augmented Generation: retrieve chunks, ask Gemini to answer only from them, map citations back."""

import logging
import re
import time

from . import config, vector_store
from .embeddings import embed

log = logging.getLogger("papertrail.ai")

NOT_ENOUGH = "NOT_ENOUGH_EVIDENCE"

SYSTEM_PROMPT = f"""You are PaperTrail AI, a research assistant that answers questions about a user's own research papers.

Rules:
1. Use ONLY the numbered source excerpts given to you. Never use outside knowledge, even if you know the answer.
2. Every sentence that states a fact must end with its citation(s) in square brackets, e.g. [S1] or [S2][S5].
   Only cite sources that actually support the sentence.
3. Refer to papers by their title (or a short form of it), not by "S1".
4. If the excerpts do not contain enough information to answer, reply with exactly
   "{NOT_ENOUGH}: " followed by one short sentence saying what is missing. Do not guess.
5. If the excerpts answer only part of the question, answer that part and clearly say what is not covered.
6. Be concise. Use bullet points when listing things across several papers."""

_client = None


class LLMError(Exception):
    pass


def _get_client():
    global _client
    if not config.GEMINI_API_KEY:
        raise LLMError("GEMINI_API_KEY is not set in ai-service/.env")
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _client


def _format_page(chunk: dict) -> str:
    a, b = chunk["page_start"], chunk["page_end"]
    return f"page {a}" if a == b else f"pages {a}-{b}"


def _build_context(chunks: list[dict], titles: dict[str, str]) -> str:
    parts = []
    for n, c in enumerate(chunks, start=1):
        title = titles.get(c["paper_id"], "Untitled paper")
        parts.append(f"[S{n}] Paper: {title} | Section: {c['section']} | {_format_page(c)}\n{c['text']}")
    return "\n\n".join(parts)


def _is_temporary(exc: Exception) -> bool:
    """Overload (503) and rate-limit (429) errors are worth retrying; bad keys or prompts are not."""
    return getattr(exc, "code", None) in (429, 500, 503) or "UNAVAILABLE" in str(exc)


def _call_llm(question: str, context: str) -> str:
    from google.genai import types

    prompt = f"Source excerpts:\n\n{context}\n\n---\nQuestion: {question}"
    models = [m for m in (config.GEMINI_MODEL, config.GEMINI_FALLBACK_MODEL) if m]
    last_error = None
    for model in dict.fromkeys(models):
        for attempt in range(3):
            try:
                response = _get_client().models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT, temperature=0.2),
                )
                break
            except LLMError:
                raise
            except Exception as exc:
                last_error = exc
                if not _is_temporary(exc):
                    raise LLMError(f"Gemini request failed: {exc}") from exc
                log.warning("Gemini %s busy (attempt %d): %s", model, attempt + 1, exc)
                time.sleep(2 ** attempt)
        else:
            continue  # all retries failed, try the fallback model
        break
    else:
        raise LLMError("Gemini is overloaded right now, please try again in a minute. "
                       f"({last_error})")
    text = (response.text or "").strip()
    if not text:
        raise LLMError("Gemini returned an empty response (it may have been blocked by safety filters).")
    return text


def answer_question(question: str, papers: list[dict], top_k: int | None = None) -> dict:
    """papers: [{"id": ..., "title": ...}]"""
    titles = {p["id"]: p.get("title") or "Untitled paper" for p in papers}
    paper_ids = [p["id"] for p in papers if vector_store.has_paper(p["id"])]
    if not paper_ids:
        return {"answer": "None of the selected papers have been processed yet.",
                "insufficient_evidence": True, "sources": []}

    query_vec = embed([question])[0]
    chunks = vector_store.search(paper_ids, query_vec, top_k or config.TOP_K, config.MAX_CONTEXT_CHUNKS)

    if not chunks or chunks[0]["score"] < config.MIN_SCORE:
        return {"answer": "I could not find anything in the selected papers that relates to this question.",
                "insufficient_evidence": True, "sources": []}

    raw = _call_llm(question, _build_context(chunks, titles))
    insufficient = raw.upper().startswith(NOT_ENOUGH)
    answer = raw[len(NOT_ENOUGH):].lstrip(" :") if insufficient else raw

    # Keep only citation markers that point at real sources.
    cited = set()
    def keep_valid(m):
        n = int(m.group(1))
        if 1 <= n <= len(chunks):
            cited.add(n)
            return m.group(0)
        return ""
    answer = re.sub(r"\[S(\d+)\]", keep_valid, answer).strip()

    sources = [{
        "id": f"S{n}",
        "paper_id": c["paper_id"],
        "paper_title": titles.get(c["paper_id"], "Untitled paper"),
        "section": c["section"],
        "page_start": c["page_start"],
        "page_end": c["page_end"],
        "score": c["score"],
        "text": c["text"],
        "cited": n in cited,
    } for n, c in enumerate(chunks, start=1)]

    return {"answer": answer, "insufficient_evidence": insufficient, "sources": sources}
