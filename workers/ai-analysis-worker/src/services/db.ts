/* save in DB analysis_repot */
export async function saveAnalysis(
	env: Env,
	data: {
		model: string;
		model_version: string;
		prompt_version: string;
		analysis: string;
		dataset: string;
		data_since: string;
	},
) {
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
		/* insert values */
		.bind(
			crypto.randomUUID(),
			new Date().toISOString(),
			data.dataset,
			data.model,
			data.model_version,
			data.prompt_version,
			data.analysis,
			new Date().toISOString(),
			data.data_since,
		)
		/* execute */
		.run();
}
