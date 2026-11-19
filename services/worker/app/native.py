"""One lock for native PDF work in this process.

PDFium (via pypdfium2) and Docling's parsers aren't safe to run side by side in threads: the load
test crashed the worker with two ingests at once. Validation and conversion both hold this lock,
so at most one of them touches native PDF code at a time; the other steps (figures, captions,
embeddings, database writes) still overlap. Re-entrant, so nested helpers can take it too.
"""

import threading

NATIVE_PDF_LOCK = threading.RLock()
