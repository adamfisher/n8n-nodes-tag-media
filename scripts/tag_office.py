#!/usr/bin/env python3
"""
Tag Office documents with metadata.
Supports DOCX (python-docx), XLSX (openpyxl), PPTX (python-pptx).

Usage: tag_office.py <document_path> <meta_path>
"""

import sys
from pathlib import Path
from datetime import datetime

# Import shared utilities
sys.path.insert(0, '/app')
from meta_utils import load_metadata, get_value, error_exit


def parse_datetime(value: str):
    """Parse ISO 8601 datetime string to datetime object."""
    if not value:
        return None
    try:
        # Try full ISO format first
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        try:
            # Try date only
            return datetime.strptime(value, '%Y-%m-%d')
        except ValueError:
            return None


def tag_docx(doc_path: str, meta: dict, extended: dict) -> None:
    """Tag a DOCX file with metadata."""
    from docx import Document
    from docx.opc.coreprops import CoreProperties

    doc = Document(doc_path)
    props = doc.core_properties

    # Core properties
    if get_value(meta, 'title') is not None:
        props.title = str(meta['title'])
    if get_value(meta, 'subject') is not None:
        props.subject = str(meta['subject'])
    if get_value(meta, 'author') is not None:
        props.author = str(meta['author'])
    if get_value(meta, 'description') is not None:
        props.comments = str(meta['description'])
    if get_value(meta, 'keywords') is not None:
        props.keywords = str(meta['keywords'])
    if get_value(meta, 'category') is not None:
        props.category = str(meta['category'])
    if get_value(meta, 'lastModifiedBy') is not None:
        props.last_modified_by = str(meta['lastModifiedBy'])

    # Created date
    created = parse_datetime(get_value(meta, 'createdDate') or '')
    if created:
        props.created = created

    # Note: python-docx doesn't directly support company/manager in core_properties
    # These are in app.xml (extended properties) which requires direct XML manipulation
    # For simplicity, we'll skip these for DOCX or add as custom properties

    # Custom properties - python-docx has limited support
    # We'll add them via the custom_properties if available
    # Note: python-docx doesn't have built-in custom properties support
    # This would require direct XML manipulation of docProps/custom.xml

    doc.save(doc_path)


def tag_xlsx(xlsx_path: str, meta: dict, extended: dict) -> None:
    """Tag an XLSX file with metadata."""
    from openpyxl import load_workbook

    wb = load_workbook(xlsx_path)
    props = wb.properties

    # Core properties
    if get_value(meta, 'title') is not None:
        props.title = str(meta['title'])
    if get_value(meta, 'subject') is not None:
        props.subject = str(meta['subject'])
    if get_value(meta, 'author') is not None:
        props.creator = str(meta['author'])
    if get_value(meta, 'description') is not None:
        props.description = str(meta['description'])
    if get_value(meta, 'keywords') is not None:
        props.keywords = str(meta['keywords'])
    if get_value(meta, 'category') is not None:
        props.category = str(meta['category'])
    if get_value(meta, 'lastModifiedBy') is not None:
        props.lastModifiedBy = str(meta['lastModifiedBy'])

    # Created date
    created = parse_datetime(get_value(meta, 'createdDate') or '')
    if created:
        props.created = created

    # Company and manager (available in openpyxl)
    if get_value(meta, 'company') is not None:
        props.company = str(meta['company'])
    if get_value(meta, 'manager') is not None:
        props.manager = str(meta['manager'])

    # Custom properties
    if extended:
        if wb.custom_doc_props is None:
            from openpyxl.packaging.custom import CustomPropertyList
            wb.custom_doc_props = CustomPropertyList()
        for key, value in extended.items():
            # openpyxl custom properties
            from openpyxl.packaging.custom import StringProperty
            wb.custom_doc_props.append(StringProperty(name=key, value=str(value)))

    wb.save(xlsx_path)


def tag_pptx(pptx_path: str, meta: dict, extended: dict) -> None:
    """Tag a PPTX file with metadata."""
    from pptx import Presentation

    prs = Presentation(pptx_path)
    props = prs.core_properties

    # Core properties
    if get_value(meta, 'title') is not None:
        props.title = str(meta['title'])
    if get_value(meta, 'subject') is not None:
        props.subject = str(meta['subject'])
    if get_value(meta, 'author') is not None:
        props.author = str(meta['author'])
    if get_value(meta, 'description') is not None:
        props.comments = str(meta['description'])
    if get_value(meta, 'keywords') is not None:
        props.keywords = str(meta['keywords'])
    if get_value(meta, 'category') is not None:
        props.category = str(meta['category'])
    if get_value(meta, 'lastModifiedBy') is not None:
        props.last_modified_by = str(meta['lastModifiedBy'])

    # Created date
    created = parse_datetime(get_value(meta, 'createdDate') or '')
    if created:
        props.created = created

    # Note: python-pptx doesn't directly support company/manager
    # These would require direct XML manipulation

    prs.save(pptx_path)


def get_extended(meta: dict) -> dict:
    """Get extended properties from metadata."""
    extended = meta.get('extended', {})
    if not isinstance(extended, dict):
        return {}
    # Filter out empty values
    return {k: v for k, v in extended.items() if v}


def main():
    if len(sys.argv) != 3:
        error_exit("Usage: tag_office.py <document_path> <meta_path>")

    doc_path = sys.argv[1]
    meta_path = sys.argv[2]

    # Load metadata
    meta = load_metadata(meta_path)
    extended = get_extended(meta)

    # Debug output
    print(f"Processing: {doc_path}", file=sys.stderr)
    print(f"Metadata: title={meta.get('title')}, author={meta.get('author')}", file=sys.stderr)

    # Detect format from extension
    ext = Path(doc_path).suffix.lower()

    try:
        if ext == '.docx':
            tag_docx(doc_path, meta, extended)
        elif ext == '.xlsx':
            tag_xlsx(doc_path, meta, extended)
        elif ext == '.pptx':
            tag_pptx(doc_path, meta, extended)
        else:
            error_exit(f"Unsupported document format: {ext}")

        print(f"Successfully tagged {ext} file", file=sys.stderr)
        print("OK")
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        error_exit(str(e))


if __name__ == '__main__':
    main()
