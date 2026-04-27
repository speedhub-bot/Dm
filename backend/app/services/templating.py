"""Template rendering: simple {var} substitution + spintax {a|b|c}."""
from __future__ import annotations

import random
import re
from typing import Any

_SPINTAX_RE = re.compile(r"\{([^{}]+\|[^{}]+)\}")


def render_spintax(text: str, rng: random.Random | None = None) -> str:
    rng = rng or random
    while True:
        m = _SPINTAX_RE.search(text)
        if not m:
            return text
        choices = m.group(1).split("|")
        text = text[: m.start()] + rng.choice(choices) + text[m.end() :]


_VAR_RE = re.compile(r"\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}")


def render_variables(text: str, ctx: dict[str, Any]) -> str:
    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        val = ctx.get(key)
        if val is None:
            return m.group(0)
        return str(val)

    return _VAR_RE.sub(repl, text)


def render(template_body: str, variants: str | None, ctx: dict[str, Any]) -> str:
    """Render a message: pick a variant, then expand spintax, then variables."""
    if variants and variants.strip():
        candidates = [v.strip() for v in variants.splitlines() if v.strip()]
        candidates.insert(0, template_body)
        body = random.choice(candidates)
    else:
        body = template_body
    body = render_spintax(body)
    body = render_variables(body, ctx)
    return body
