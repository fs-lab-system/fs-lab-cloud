import { getModelVersion } from './ai';

/* save in DB analysis_repot */
export async function saveAnalysisToD1(
	env: Env,
	analyses: Record<string, string>,
	options: {
		prompt_version: string;
		dataset: string;
		data_since: string;
	},
) {
	const now = new Date().toISOString();

	for (const [model, analysisText] of Object.entries(analyses)) {
		try {
			await env.ai_analysis_db
				.prepare(
					`
				INSERT INTO analysis_reports (
					id,
					created_at,
					dataset,
					model,
					model_version,
					prompt_version,
					analysis,
					run_timestamp,
					data_since
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				)
				.bind(
					crypto.randomUUID(),
					now,
					options.dataset,
					model,
					getModelVersion(model),
					options.prompt_version,
					analysisText,
					now,
					options.data_since,
				)
				.run();
		} catch (err) {
			console.error(`D1 insert failed for model ${model}`, err);
		}
	}
}

export async function savePromptIfNotExists(env: Env, prompt: string, version: string) {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prompt));

	const hashHex = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	/* check if exists */
	const existing = await env.ai_analysis_db.prepare(`SELECT id FROM prompt_versions WHERE id = ?`).bind(hashHex).first();

	if (!existing) {
		await env.ai_analysis_db
			.prepare(
				`
				INSERT OR IGNORE INTO prompt_versions  (
					id,
					created_at,
					version,
					prompt_template,
					description
				) VALUES (?, ?, ?, ?, ?)
			`,
			)
			.bind(hashHex, new Date().toISOString(), version, prompt, 'auto-saved prompt version')
			.run();
	}
}
