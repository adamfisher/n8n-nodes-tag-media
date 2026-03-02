import { config } from '@n8n/node-cli/eslint';

export default [
	...config,
	{
		// Exclude test config files from linting
		ignores: ['vitest.config.ts'],
	},
	{
		// These nodes require Node.js built-in modules (fs, child_process, etc.)
		// because they execute external tools (Python scripts, exiftool) and handle temp files.
		// This is for self-hosted n8n only, not n8n Cloud.
		files: [
			'nodes/shared/**/*.ts',
			'nodes/ReadFileTags/**/*.ts',
			'nodes/TagAudioFile/**/*.ts',
			'nodes/TagMediaFile/**/*.ts',
			'nodes/TagOfficeDocument/**/*.ts',
			'tests/**/*.ts',
		],
		rules: {
			'@n8n/community-nodes/no-restricted-imports': 'off',
			'@n8n/community-nodes/no-restricted-globals': 'off',
		},
	},
];
