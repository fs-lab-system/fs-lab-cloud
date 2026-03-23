/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { fetchSnapshots } from '../src/services/supabase';
import { buildSnapshotPrompt } from '../src/prompts/snapshotPrompt';

import { runAnalysis } from './services/ai';
import { saveAnalysisToD1 } from './services/db';
import { getFromKV, saveToKV } from './services/kv';
import { aggregateSnapshots } from './utils/aggregateSnapshots';

/* ENTRY POINT OF WORKER */
export default {
	/* HTTP request handler, 
	request = HTTP request,
	env = Cloudflare binding (for example Storage),
	ctx = Execution Content (backgroundjobs)
	*/
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		/* create the HTTP response */
		try {
			const PROMPT_VERSION = 'v1';

			/* get current URL */
			const url = new URL(request.url);

			/* D1 TESTING */
			if (url.pathname === '/d1-test') {
				await saveAnalysisToD1(
					env,
					{
						llama: 'D1 works',
						mistral: 'D1 works',
					},
					{
						prompt_version: 'v1',
						dataset: 'snapshots',
						data_since: new Date().toISOString(),
					},
				);

				const latest = await env.ai_analysis_db
					.prepare(
						`
					SELECT * FROM analysis_reports ORDER BY created_at DESC LIMIT 2`,
					)
					.all();

				return Response.json(latest);
			}

			/* KV TESTING */
			if (url.pathname === '/kv-test') {
				const testData = {
					message: 'KV storage works',
					time: new Date().toISOString(),
				};

				await saveToKV(env, 'kv_test', testData);

				const stored = await getFromKV(env, 'kv_test');

				return Response.json({
					written: testData,
					readBack: stored,
				});
			} else {
				/* PRODUCTIVE, NORMAL WORKER CODE */
				/* get data from table (last X days) */
				const snapshots = await fetchSnapshots(env, 7);

				/* aggregate the snapshots, to make ai analysis easier */
				const aggregatedSnapshots = aggregateSnapshots(snapshots);

				/* get prompt */
				const prompt = buildSnapshotPrompt(aggregatedSnapshots);

				/* responses */
				const analyses = await runAnalysis(env, prompt);

				/* save in d1 */
				await saveAnalysisToD1(env, analyses, {
					prompt_version: PROMPT_VERSION,
					dataset: 'snapshots',
					data_since: new Date().toISOString(),
				});

				/* return JOSN response of both requests */
				return Response.json({
					llamaSnapshotsAnalysis: analyses.llama ?? 'NO DATA',
					mistralSnapshotsAnalysis: analyses.mistral ?? 'NO DATA',
					aggregatedSnapshots: aggregatedSnapshots,
				});
			}
		} catch (err) {
			/* DEBUGGING INFO */
			return new Response(
				JSON.stringify({
					error: String(err),
					url: env.SUPABASE_URL,
					key: env.SUPABASE_PUBLISHABLE_KEY ? 'exists' : 'missing',
				}),
				{ status: 500 },
			);
		}
	},
} satisfies ExportedHandler<Env>;
