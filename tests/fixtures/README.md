# File converter fixtures

`password-protected.pdf` is a generated blank 100 × 60 point PDF, encrypted with pypdf 7.0.0 using RC4-128 for compatibility testing. Its public test password is `converter-test-password`; it contains no private content or real credential.

To regenerate with pypdf available:

```python
from pypdf import PdfWriter

writer = PdfWriter()
writer.add_blank_page(width=100, height=60)
writer.encrypt("converter-test-password", algorithm="RC4-128")
writer.write("tests/fixtures/password-protected.pdf")
```

Other image and PDF fixtures are generated inside the Playwright tests.
