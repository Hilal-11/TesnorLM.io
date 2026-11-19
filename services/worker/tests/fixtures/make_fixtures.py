"""Generates the worker's test PDFs. Everything is synthetic (no third-party papers).

    python tests/fixtures/make_fixtures.py [out_dir]

paper_basic      3 pages: title, numbered sections, a table, 2 captioned figures, running header
                 and page-number footer on every page
scanned          1 page that is only an image of text (needs OCR)
blank_scan       1 page that is only a blank image (OCR finds nothing → no_text_found)
encrypted        password-protected (user password required)
corrupt          a PDF header followed by garbage
not_pdf          PNG bytes with a .pdf name
too_many_pages   201 short pages
logo_repeat      4 pages with the same small logo on each, plus one real figure
"""

from __future__ import annotations

import io
import random
import sys
from pathlib import Path

from fpdf import FPDF
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
DEFAULT_OUT = HERE / "generated"

KNOWN_SCANNED_WORD = "TRANSFORMER"


def _font(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    return ImageFont.load_default(size=size)


def bar_chart() -> Image.Image:
    img = Image.new("RGB", (900, 600), "white")
    d = ImageDraw.Draw(img)
    d.line([(80, 520), (860, 520)], fill="black", width=4)
    d.line([(80, 40), (80, 520)], fill="black", width=4)
    for i, h in enumerate([120, 260, 340, 420, 300]):
        x = 130 + i * 145
        d.rectangle([x, 520 - h, x + 90, 520], fill=(40, 90, 200), outline="black")
        d.text((x + 20, 535), f"L{i + 1}", fill="black", font=_font(28))
    d.text((300, 560), "Number of layers", fill="black", font=_font(26))
    return img


def block_diagram() -> Image.Image:
    img = Image.new("RGB", (900, 500), "white")
    d = ImageDraw.Draw(img)
    for i, label in enumerate(["Query", "Key", "Value"]):
        x = 60 + i * 280
        d.rounded_rectangle([x, 60, x + 200, 160], radius=18, outline="black", width=4)
        d.text((x + 50, 95), label, fill="black", font=_font(32))
        d.line([(x + 100, 160), (450, 330)], fill="black", width=4)
    d.rounded_rectangle([300, 330, 600, 440], radius=18, outline="black", width=4)
    d.text((340, 370), "Attention", fill="black", font=_font(36))
    return img


def logo() -> Image.Image:
    img = Image.new("RGB", (200, 200), "white")
    d = ImageDraw.Draw(img)
    d.ellipse([10, 10, 190, 190], fill=(20, 140, 120))
    d.text((60, 75), "TL", fill="white", font=_font(56))
    return img


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class Paper(FPDF):
    running_header = "Tiny Study of Attention - Preprint"

    def header(self) -> None:
        self.set_font("Helvetica", size=8)
        self.cell(0, 6, self.running_header, align="C")
        self.ln(10)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", size=8)
        self.cell(0, 6, str(self.page_no()), align="C")


LOREM = (
    "Attention lets a model weigh every token against every other token. In this short study "
    "we measure how the number of layers changes accuracy on a toy copy task, and we describe "
    "the scaled dot-product attention block used in each layer. Queries, keys and values are "
    "linear projections of the same input sequence."
)


def heading(pdf: FPDF, text: str) -> None:
    pdf.set_font("Helvetica", style="B", size=14)
    pdf.cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=11)


def para(pdf: FPDF, text: str) -> None:
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, text)
    pdf.ln(3)


def figure(pdf: FPDF, img: Image.Image, caption: str, width: float = 120) -> None:
    pdf.image(io.BytesIO(png_bytes(img)), x=(pdf.w - width) / 2, w=width)
    pdf.ln(2)
    pdf.set_font("Helvetica", style="I", size=10)
    pdf.multi_cell(0, 5, caption, align="C")
    pdf.ln(4)


def paper_basic() -> bytes:
    pdf = Paper(unit="mm", format="A4")
    pdf.set_auto_page_break(True, margin=18)
    pdf.add_page()
    pdf.set_font("Helvetica", style="B", size=20)
    pdf.multi_cell(0, 10, "A Tiny Study of Attention", align="C")
    pdf.ln(4)
    heading(pdf, "1 Introduction")
    para(pdf, LOREM)
    para(pdf, LOREM.replace("short study", "brief experiment"))
    heading(pdf, "2 Method")
    para(pdf, "Each layer applies scaled dot-product attention followed by a feed-forward block.")
    figure(pdf, block_diagram(), "Figure 1: Scaled dot-product attention combines queries, keys and values.")
    pdf.add_page()
    heading(pdf, "3 Results")
    para(pdf, "Table 1 lists accuracy by depth. Accuracy rises with depth and then levels off.")
    pdf.set_font("Helvetica", size=10)
    with pdf.table(col_widths=(40, 40, 40), text_align="CENTER") as table:
        for row in [("Layers", "Accuracy", "Params"), ("1", "61.2", "0.4M"), ("2", "74.8", "0.8M"),
                    ("4", "88.1", "1.6M"), ("8", "90.3", "3.2M")]:
            r = table.row()
            for cell in row:
                r.cell(cell)
    pdf.ln(4)
    pdf.set_font("Helvetica", style="I", size=10)
    pdf.multi_cell(0, 5, "Table 1: Accuracy on the copy task by number of layers.", align="C")
    pdf.ln(4)
    figure(pdf, bar_chart(), "Figure 2: Accuracy grows with the number of layers.")
    pdf.add_page()
    heading(pdf, "4 Conclusion")
    para(pdf, "Deeper attention stacks help on this task until about four layers. " * 3)
    return bytes(pdf.output())


def text_image(lines: list[str]) -> Image.Image:
    img = Image.new("RGB", (1240, 1754), "white")  # A4 at 150 dpi
    d = ImageDraw.Draw(img)
    y = 160
    for line in lines:
        d.text((120, y), line, fill="black", font=_font(44))
        y += 80
    return img


def image_only_pdf(img: Image.Image) -> bytes:
    pdf = FPDF(unit="mm", format="A4")
    pdf.add_page()
    pdf.image(io.BytesIO(png_bytes(img)), x=0, y=0, w=pdf.w, h=pdf.h)
    return bytes(pdf.output())


def scanned() -> bytes:
    return image_only_pdf(
        text_image(
            [
                f"{KNOWN_SCANNED_WORD} NOTES",
                "Self attention compares every",
                "token with every other token.",
                "The output is a weighted sum",
                "of the value vectors.",
            ]
        )
    )


def blank_scan() -> bytes:
    rng = random.Random(7)
    img = Image.new("RGB", (1240, 1754), (250, 250, 250))
    d = ImageDraw.Draw(img)
    for _ in range(300):  # faint paper speckle, no text
        x, y = rng.randrange(1240), rng.randrange(1754)
        d.point((x, y), fill=(225, 225, 225))
    return image_only_pdf(img)


def encrypted() -> bytes:
    pdf = FPDF()
    pdf.set_encryption(owner_password="owner-secret", user_password="user-secret")
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 10, "Locked content")
    return bytes(pdf.output())


def corrupt() -> bytes:
    rng = random.Random(3)
    return b"%PDF-1.7\n" + bytes(rng.randrange(256) for _ in range(4096))


def not_pdf() -> bytes:
    return png_bytes(logo())


def too_many_pages(pages: int = 201) -> bytes:
    pdf = FPDF(format=(105, 148))
    pdf.set_font("Helvetica", size=8)
    for i in range(pages):
        pdf.add_page()
        pdf.cell(0, 6, f"Page {i + 1}")
    return bytes(pdf.output())


def logo_repeat() -> bytes:
    pdf = FPDF(unit="mm", format="A4")
    pdf.set_auto_page_break(True, margin=18)
    for i in range(4):
        pdf.add_page()
        pdf.image(io.BytesIO(png_bytes(logo())), x=180, y=8, w=18)
        heading(pdf, f"Section {i + 1}")
        para(pdf, LOREM)
        if i == 1:
            figure(pdf, bar_chart(), "Figure 1: The only real figure in this file.")
    return bytes(pdf.output())


FIXTURES = {
    "paper_basic": paper_basic,
    "scanned": scanned,
    "blank_scan": blank_scan,
    "encrypted": encrypted,
    "corrupt": corrupt,
    "not_pdf": not_pdf,
    "too_many_pages": too_many_pages,
    "logo_repeat": logo_repeat,
}


def generate(out_dir: Path = DEFAULT_OUT) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {}
    for name, make in FIXTURES.items():
        path = out_dir / f"{name}.pdf"
        if not path.exists():
            path.write_bytes(make())
        paths[name] = path
    return paths


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    for name, path in generate(target).items():
        print(f"{name}: {path.stat().st_size} bytes")
