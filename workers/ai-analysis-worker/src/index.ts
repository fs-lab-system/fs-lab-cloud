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

import { runDailyAnalysis } from './services/cronHandler';
import { saveAnalysisToD1 } from './services/db';
import { getFromKV, saveToKV } from './services/kv';

export const PROMPT_VERSION = 'v1.0.0';

/* how many days ago get data */
export const daysOfData: number = 7;

/* date string */
export const since = new Date(Date.now() - daysOfData * 24 * 60 * 60 * 1000).toISOString();

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
			/* get current URL */
			const url = new URL(request.url);

			/* only GET Method allowed! */
			if (request.method !== 'GET') {
				return new Response('Method Not Allowed', { status: 405 });
			}

			/* D1 TESTING */
			if (url.pathname === '/d1-test') {
				await saveAnalysisToD1(
					env,
					{
						llama: 'D1 works',
						mistral: 'D1 works',
					},
					{
						prompt_version: PROMPT_VERSION,
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

				const stored = await getFromKV<AnalysisCache>(env, 'kv-test');

				return Response.json({
					written: testData,
					readBack: stored,
				});
			}
			/* PRODUCTIVE, NORMAL WORKER CODE */
			if (url.pathname === '/latest') {
				const cached = await getFromKV<AnalysisCache>(env, 'analysis:latest');
				return cached ? Response.json(cached) : new Response('No data yet', { status: 404 });
			}
			if (url.pathname === '/run-now') {
				const result = await runDailyAnalysis(env);
				return Response.json(result);
			}

			/* return possible endpoints */
			return Response.json({
				endpoints: ['/latest', '/run-now', '/d1-test', '/kv-test'],
			});
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
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		console.log('Cron triggered at:', new Date(controller.scheduledTime));

		ctx.waitUntil(runDailyAnalysis(env));
	},
} satisfies ExportedHandler<Env>;
