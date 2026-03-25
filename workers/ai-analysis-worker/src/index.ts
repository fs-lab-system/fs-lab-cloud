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
import { saveAnalysisToD1, savePromptIfNotExists } from './services/db';
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
			const PROMPT_VERSION = 'v1.0.0';

			/* get current URL */
			const url = new URL(request.url);

			/* how many days ago get data */
			const days: number = 7;

			/* date string */
			const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

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
						data_since: since,
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
				/* check if env variables are fine */
				if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
					throw new Error('Missing Supabase config');
				}
				if (!env.ai_analysis_db) {
					throw new Error('D1 not configured');
				}

				/* get data from table (last X days) */
				const snapshots = await fetchSnapshots(env, days);

				/* if snapshot empty -> throw error */
				if (!snapshots || snapshots.length === 0) {
					throw new Error('No snapshot data available');
				}

				/* aggregate the snapshots, to make ai analysis easier */
				const aggregatedSnapshots = aggregateSnapshots(snapshots);

				/* get prompt */
				const prompt = buildSnapshotPrompt(aggregatedSnapshots);

				/* responses */
				const analyses = await runAnalysis(env, prompt);

				/* if analyses are empty -> throw error */
				if (!analyses || Object.keys(analyses).length === 0) {
					throw new Error('No analysis results');
				}
				/* save latest analysis in KV */
				const kvResponse = await saveToKV(env, 'analysis:latest', {
					analyses,
					aggregatedSnapshots,
					timestamp: new Date().toISOString(),
				});

				/* save in d1 */
				const d1Response = await saveAnalysisToD1(env, analyses, {
					prompt_version: PROMPT_VERSION,
					dataset: 'snapshots',
					data_since: since,
				});

				/* save in prompt table, if not already there */
				const promtDBResponse = await savePromptIfNotExists(env, prompt, PROMPT_VERSION);

				const tables = await env.ai_analysis_db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

				console.log('TABLES:', tables);

				/* return JOSN response of both requests */
				return Response.json({
					llamaSnapshotsAnalysis: analyses.llama ?? 'NO DATA',
					mistralSnapshotsAnalysis: analyses.mistral ?? 'NO DATA',
					aggregatedSnapshots: aggregatedSnapshots,
					d1Response: d1Response,
					kvResponse: kvResponse,
					promtDBResponse: promtDBResponse,
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
