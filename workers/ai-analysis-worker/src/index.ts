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

			/* TESTING */
			if (url.pathname === '/kv-test') {
				const testData = {
					message: 'KV storage works',
					time: new Date().toISOString(),
				};

				await env.AI_ANALYSIS.put('kv_test', JSON.stringify(testData));

				const stored = await env.AI_ANALYSIS.get('kv_test');

				return Response.json({
					written: testData,
					readBack: stored ? JSON.parse(stored) : null,
				});

				/* PRODUCTIVE, NORMAL WORKER CODE */
			} else {
				/* get data from table */
				const snapshots = await fetchSnapshots(env);

				/* get prompt */
				const prompt = buildSnapshotPrompt(snapshots);

				/* responses */
				const analyses = await runAnalysis(env, prompt);

				/* return JOSN response of both requests */
				return Response.json({
					llamaSnapshotsAnalysis: analyses.llama,
					mistralSnapshotsAnalysis: analyses.mistral,
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
