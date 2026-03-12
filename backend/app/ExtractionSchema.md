# Encargo Procurement Extraction Schema

## Overview

This document defines the JSON output format for Encargo’s procurement document extraction pipeline.

The goal of the extraction system is to process procurement-related PDFs and return structured data that can be used for validation, analysis, and downstream systems such as CSV export or dashboards.

The schema separates information into two levels:

### Document-level fields

These apply to the entire document and typically include vendor or order metadata.

### Item-level fields

These represent product or line-item data extracted from the document. A single procurement document may contain multiple items.

Each extracted field stores:

- the **raw value** exactly as it appears in the document
- the **unit** found in the document if applicable
- a **normalized value** used for structured data processing
- a **normalized unit** for consistent measurement representation
- a **review flag** indicating uncertainty
- **review notes** explaining why manual review may be required

If a value is not clearly present in the document, it should be returned as `null`.

---

# JSON Schema Structure

The extraction output must follow the structure below.

{
    "document_fields": {},
    "items": []
}

---

## Document Fields

`document_fields` contains values that apply to the entire document.

Example fields include:

- vendor_name
- purchase_order_number
- invoice_number
- order_date

Each document field follows the standard field object structure.

---

## Items

`items` is an array of product or line-item entries.

Each item contains procurement-related fields such as pricing, dimensions, and quantities.

Example item fields include:

- price_per_unit
- delivery_date
- shipping_date
- tracking_number
- length
- height
- width
- density
- quantity
- quality
- minimum_quantity
- weight

Each of these fields follows the same field object structure.

---

# Field Object Definition

Every extracted field uses the following structure.

{
"raw_value": null,
"unit": null,
"normalized_value": null,
"normalized_unit": null,
"required_review": false,
"review_notes": null
}


### Field Properties

**raw_value**

The value exactly as it appears in the document text.

Example:
"$4.25 / unit"


---

**unit**

The unit associated with the raw value if present.

Examples:
"in"
"lb"

---

**normalized_value**

A cleaned version of the value suitable for structured data.

Examples:
"$1,200.00" → 1200
"March 21, 2026" → "2026-03-21"


If normalization is not possible, this value should be `null`.

---

**normalized_unit**

A standardized unit corresponding to the normalized value.

Examples:
"lb"
"in"
"USD/unit"

If no unit exists, this value should be `null`.

---

**required_review**

Boolean indicating whether the extracted value requires manual review.

Set to `true` when:

- the value is ambiguous
- the value conflicts with expected format
- the value was extracted but cannot be confidently normalized

---

**review_notes**

Optional explanation for why manual review is required.

Example:

If no unit exists, this value should be `null`.

---

**required_review**

Boolean indicating whether the extracted value requires manual review.

Set to `true` when:

- the value is ambiguous
- the value conflicts with expected format
- the value was extracted but cannot be confidently normalized

---

**review_notes**

Optional explanation for why manual review is required.

Example:
"Relative shipping date present without explicit reference date."


If no issues exist, this value should be `null`.

---

# Example JSON Output

Below is an example of a valid extraction output.

[FILL IN EXAMPLE, PASTE HERE (do we need document info?)]

---

# Summary

This schema provides a consistent structure for procurement document extraction by:

- separating document-level and item-level information
- preserving both raw and normalized values
- maintaining unit information
- flagging uncertain values for review
- supporting multiple items within a single document

This structure is designed to support reliable AI extraction while remaining compatible with downstream systems such as CSV exports and analytics pipelines.
