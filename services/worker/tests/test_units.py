"""Unit tests that don't need Docling models: embeddings, captions, figures and chunk helpers."""

from __future__ import annotations

from types import SimpleNamespace

import httpx
import openai
import pytest
from PIL import Image

from app import chunking, figures
from app.captions import CaptionUsage, Captioner, caption_all, system_prompt
from app.embed import BATCH, Embedder, check_token_budget
from app.errors import IngestError

# ───────────── embeddings ─────────────


class FakeEmbeddings:
    def __init__(self, dims=1536, fail_first=0, error=None):
        self.dims, self.fail_first, self.calls, self.error = dims, fail_first, 0, error
        self.sizes: list[int] = []

    def create(self, model, input):
        self.calls += 1
        if self.calls <= self.fail_first:
            raise self.error
        self.sizes.append(len(input))
        data = [SimpleNamespace(index=i, embedding=[0.1] * self.dims) for i in range(len(input))]
        return SimpleNamespace(data=list(reversed(data)), usage=SimpleNamespace(total_tokens=7 * len(input)))


def rate_limited():
    req = httpx.Request("POST", "https://api.openai.com/v1/embeddings")
    return openai.RateLimitError("slow down", response=httpx.Response(429, request=req), body=None)


def embedder(fake):
    return Embedder("k", "text-embedding-3-small", 1536, client=SimpleNamespace(embeddings=fake), sleep=lambda s: None)


def test_embeddings_are_batched_in_order():
    fake = FakeEmbeddings()
    e = embedder(fake)
    out = e.embed([f"t{i}" for i in range(BATCH * 2 + 5)])
    assert len(out) == BATCH * 2 + 5
    assert fake.sizes == [BATCH, BATCH, 5]
    assert e.tokens == 7 * (BATCH * 2 + 5)


def test_embeddings_retry_with_backoff_on_429():
    fake = FakeEmbeddings(fail_first=2, error=rate_limited())
    assert len(embedder(fake).embed(["a"])) == 1
    assert fake.calls == 3


def test_embeddings_give_up_after_five_tries():
    fake = FakeEmbeddings(fail_first=99, error=rate_limited())
    with pytest.raises(openai.RateLimitError):
        embedder(fake).embed(["a"])
    assert fake.calls == 5


def test_vector_length_is_checked():
    with pytest.raises(RuntimeError, match="dims"):
        embedder(FakeEmbeddings(dims=768)).embed(["a"])


def test_token_cap_per_document():
    assert check_token_budget([100, 200], 1000) == 300
    with pytest.raises(IngestError):
        check_token_budget([800, 800], 1000)


# ───────────── captions ─────────────


def test_captioner_prompt_is_a_file():
    assert "learner" in system_prompt()


class FakeMessages:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    def create(self, **kwargs):
        self.requests.append(kwargs)
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def message(text="A diagram.", stop="end_turn"):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        stop_reason=stop,
        usage=SimpleNamespace(input_tokens=300, output_tokens=40),
    )


def anthropic_error(status):
    import anthropic

    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    cls = anthropic.RateLimitError if status == 429 else anthropic.BadRequestError
    return cls("err", response=httpx.Response(status, request=req), body=None)


def captioner(responses):
    fake = FakeMessages(responses)
    return Captioner("k", "claude-haiku-5-5", client=SimpleNamespace(messages=fake), sleep=lambda s: None), fake


def test_caption_request_uses_the_fast_model_with_the_image():
    c, fake = captioner([message()])
    usage = CaptionUsage()
    assert c.describe(b"RIFFxxxxWEBP", "Figure 1", "Attention.", usage) == "A diagram."
    req = fake.requests[0]
    assert req["model"] == "claude-haiku-5-5"
    assert req["output_config"] == {"effort": "low"}
    image, text = req["messages"][0]["content"]
    assert image["source"]["media_type"] == "image/webp"
    assert "Figure 1" in text["text"]
    assert (usage.input_tokens, usage.output_tokens) == (300, 40)


def test_caption_retries_rate_limits_then_succeeds():
    c, fake = captioner([anthropic_error(429), message("Later.")])
    assert c.describe(b"x", None, None, CaptionUsage()) == "Later."
    assert len(fake.requests) == 2


def test_caption_gives_up_on_bad_requests_and_refusals():
    c, _ = captioner([anthropic_error(400)])
    assert c.describe(b"x", None, None, CaptionUsage()) is None
    c, _ = captioner([message("", stop="refusal")])
    usage = CaptionUsage()
    assert c.describe(b"x", None, None, usage) is None
    assert usage.failures == ["refusal"]


def test_caption_all_skips_done_figures_uses_the_cache_and_survives_failures():
    figs = [
        {"id": "1", "label": "Figure 1", "description": "done"},
        {"id": "2", "label": "Figure 2", "image_sha256": "cached"},
        {"id": "3", "label": "Figure 3"},
        {"id": "4", "label": "Figure 4"},
    ]
    saved, progress = {}, []

    def describe(webp, label, caption, usage):
        usage.input_tokens += 10
        if label == "Figure 4":
            raise TimeoutError()
        return f"about {label}"

    usage = caption_all(
        figs,
        load_image=lambda f: b"img",
        describe=describe,
        cached=lambda f: "from cache" if f.get("image_sha256") == "cached" else None,
        save=lambda f, t: saved.__setitem__(f["id"], t),
        concurrency=4,
        on_done=lambda d, t: progress.append((d, t)),
    )
    assert saved == {"2": "from cache", "3": "about Figure 3"}
    assert (usage.described, usage.cached, usage.failed) == (2, 1, 1)
    assert usage.input_tokens == 20
    assert usage.failures == ["TimeoutError"]
    assert progress[-1] == (4, 4)


# ───────────── figures ─────────────


@pytest.mark.parametrize(
    ("caption", "label"),
    [
        ("Figure 3: Attention", "Figure 3"),
        ("Fig. 12b. Loss curves", "Figure 12b"),
        ("Table 2 shows", "Table 2"),
        ("An unlabelled picture", None),
        (None, None),
    ],
)
def test_labels(caption, label):
    assert figures.label_of(caption) == label


def candidate(page, size_pt=200, px=400, color=(10, 10, 10), top=100.0):
    img = Image.new("RGB", (px, px), "white")
    img.paste(Image.new("RGB", (px // 2, px // 2), color), (px // 4, px // 4))
    return figures.Candidate(
        page=page,
        bbox={"page": page, "l": 50.0, "t": top, "r": 50.0 + size_pt, "b": top + size_pt},
        label=None,
        paper_caption=None,
        image=img,
        area=size_pt * size_pt,
    )


def test_tiny_images_and_repeated_logos_are_skipped():
    real = candidate(2, color=(200, 0, 0))
    real.image = Image.radial_gradient("L").convert("RGB").resize((400, 400))
    tiny = candidate(1, size_pt=20, px=40)
    logos = [candidate(p, size_pt=90, px=200) for p in (1, 2, 3, 4)]
    kept, skipped = figures.select([tiny, real, *logos], 40)
    assert kept == [real]
    assert skipped == 5


def test_only_the_largest_figures_are_kept_in_reading_order():
    many = []
    for i in range(50):
        c = candidate(1 + i // 5, size_pt=100 + i, top=float(i % 5) * 120)
        c.image = Image.effect_noise((300, 300), 40 + i).convert("RGB")
        many.append(c)
    kept, skipped = figures.select(many, 40)
    assert len(kept) == 40 and skipped == 10
    assert kept == sorted(kept, key=lambda c: (c.page, c.top))
    assert min(c.area for c in kept) >= sorted(c.area for c in many)[10]


def test_webp_is_at_most_1600_wide():
    data, w, h = figures.to_webp(Image.new("RGB", (3200, 1000), "white"))
    assert data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    assert (w, h) == (1600, 500)
    data, w, h = figures.to_webp(Image.new("L", (800, 600)))
    assert (w, h) == (800, 600)


# ───────────── chunks ─────────────


@pytest.mark.parametrize("text", ["12", "Page 3", "page 4 of 20", "iv", "  7 / 9 ", "", "ab"])
def test_page_numbers_and_scraps_are_boilerplate(text):
    assert chunking.is_boilerplate(text)


def test_real_text_is_not_boilerplate():
    assert not chunking.is_boilerplate("Attention is all you need.")


def test_caption_chunk_text_does_not_repeat_the_label():
    fig = {"label": "Figure 3", "page": 5, "paper_caption": "Figure 3: Multi-head attention.", "description": "Boxes."}
    assert chunking.caption_text(fig) == "Figure 3 (page 5): Multi-head attention.\nBoxes."
    assert chunking.caption_text({"label": None, "page": 2, "paper_caption": None}) == "Figure (page 2)"


def test_tokenizer_matches_the_embedding_model():
    assert chunking.ENCODING == "cl100k_base"
    assert chunking.MAX_TOKENS == 400
    assert chunking.count_tokens("hello world") == 2
