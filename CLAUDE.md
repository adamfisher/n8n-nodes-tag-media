# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

n8n community nodes for reading and writing metadata tags to media files. The package provides four nodes:
- **Tag Audio File** - Write ID3/Vorbis/MP4 tags via Python (mutagen)
- **Tag Media File** - Write EXIF/IPTC/XMP tags via exiftool
- **Tag Office Document** - Write document properties via Python (python-docx, openpyxl, python-pptx)
- **Read File Tags** - Read metadata from any file via exiftool

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix lint issues
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode

# Docker development (includes Python/exiftool)
npm run dev:docker          # Build and start n8n with nodes
npm run dev:docker:rebuild  # Rebuild after changes
npm run dev:docker:down     # Stop containers
npm run dev:docker:logs     # View logs
```

**Running a single test:**
```bash
npx vitest run -t "should write metadata to 'WAV'"
```

## Architecture

### Node ↔ External Tool Pattern

Nodes don't process files directly. They delegate to external tools:

```
TypeScript Node → writes temp file → calls external tool → reads result
```

- **TagAudioFile/TagOfficeDocument**: Call Python scripts in `scripts/` via `child_process`
- **TagMediaFile/ReadFileTags**: Call `exiftool` directly via `child_process`

### Script Path Resolution

Python scripts are bundled with the npm package. Nodes locate them relative to their compiled location:

```typescript
const SCRIPT_PATH = join(__dirname, '..', '..', '..', 'scripts', 'tag_audio.py');
```

From `dist/nodes/TagAudioFile/`, this resolves to `scripts/tag_audio.py` at package root.

### Shared Utilities

- `nodes/shared/utils.ts` - Binary data extraction, command execution, file cleanup
- `nodes/shared/tempFiles.ts` - Temp file path generation and writing

All nodes use a consistent pattern:
1. Extract binary data from input item
2. Write to temp file
3. Call external tool with temp file path
4. Read modified file back
5. Return as binary output
6. Cleanup temp files in `finally` block

### ESLint Configuration

Restricted imports/globals are disabled for node files because they require Node.js built-ins (`fs`, `child_process`, `path`) to execute external tools. This makes these nodes incompatible with n8n Cloud.

## CI/CD

Single workflow (`.github/workflows/ci.yml`) handles both CI and publishing:
- Runs on: push to main, PRs, and version tags
- Always: lint → build → test
- On version tags (`v*`): also publish to npm and create GitHub release

**To release:**
```bash
npm version patch  # or minor/major
git push origin main --tags
```

## Testing

Tests require Python and exiftool. They detect tool availability and skip gracefully when dependencies are missing:
- Tests check for `python3`/`python` and required Python modules
- Tests check for `exiftool`
- Sample files are in `tests/sample-files/`

## Key Files

- `scripts/tag_audio.py` - Handles WAV (RIFF INFO + ID3v2.3), MP3, FLAC, M4A, OGG
- `scripts/tag_office.py` - Handles DOCX, XLSX, PPTX
- `package.json` `files` array - Must include both `dist` and `scripts` for npm package
