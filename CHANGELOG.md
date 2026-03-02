# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-03-01

### Added

- **Tag Audio File** node - Write ID3, Vorbis, and MP4 tags to audio files
  - Supported formats: WAV, MP3, FLAC, M4A/AAC, OGG
  - Standard metadata fields: Title, Artist, Album, Year, Genre, Track Number, etc.
  - Extended properties with dropdown selection for format-specific tags

- **Tag Media File** node - Write EXIF, IPTC, and XMP metadata to images and PDFs
  - Supported formats: JPEG, PNG, TIFF, PDF, WebP, GIF
  - Standard metadata fields: Title, Creator, Description, Copyright, Keywords
  - Extended properties with hundreds of EXIF, IPTC, XMP, PDF, and GPS tags

- **Tag Office Document** node - Write document properties to Microsoft Office files
  - Supported formats: DOCX, XLSX, PPTX
  - Standard metadata fields: Title, Subject, Author, Description, Keywords, Category
  - Extended properties for additional document metadata

- **Read File Tags** node - Read embedded metadata from any file type
  - Uses exiftool for comprehensive format support
  - Field filtering options: include all, include specific, exclude specific

[1.0.0]: https://github.com/adamfisher/n8n-nodes-tag-media/releases/tag/v1.0.0
