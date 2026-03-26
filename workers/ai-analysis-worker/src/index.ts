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
import { getFromKV } from './services/kv';

export const PROMPT_VERSION = 'v1.0.0';

/* how many days ago get data */
export const daysOfData: number = 7;

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
				const latest = await env.ai_analysis_db
					.prepare(
						`
						SELECT * FROM analysis_reports ORDER BY created_at DESC LIMIT 1
						`,
					)
					.first();
				return Response.json(latest);
			}

			/* get lastest entry in KV (same as KV-TEST) */
			if (url.pathname === '/kv-latest') {
				const cached = await getFromKV<AnalysisCache>(env, 'analysis:latest');
				return cached ? Response.json(cached) : new Response('No data yet', { status: 404 });
			}
			/* PRODUCTIVE, NORMAL WORKER CRONJOB CODE */
			if (url.pathname === '/run-now') {
				if (!env.ENV || env.ENV !== 'dev') {
					return new Response('Forbidden', { status: 403 });
				} else {
					const result = await runDailyAnalysis(env, true);
					return Response.json(result);
				}
			}

			/* return possible endpoints */
			return Response.json({
				endpoints: ['/kv-latest', '/run-now', '/d1-test'],
			});
		} catch (err) {
			/* DEBUGGING INFO */
			return new Response(
				JSON.stringify({
					error: err instanceof Error ? err.message : String(err),
					url: env.SUPABASE_URL ? 'exists' : 'missing',
					key: env.SUPABASE_PUBLISHABLE_KEY ? 'exists' : 'missing',
				}),
				{ status: 500 },
			);
		}
	},
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		/* DEBUG */
		console.log('[CRON] triggered at:', new Date(controller.scheduledTime).toISOString());
		/* execute cron job the the sceduled time (wrangler.toml) */
		ctx.waitUntil(runDailyAnalysis(env, true));
	},
} satisfies ExportedHandler<Env>;
