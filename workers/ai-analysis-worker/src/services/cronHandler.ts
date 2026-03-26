import { daysOfData, PROMPT_VERSION } from '..';
import { buildSnapshotPrompt } from '../prompts/snapshotPrompt';
import { aggregateSnapshots } from '../utils/aggregateSnapshots';
import { runAnalysis } from './ai';
import { saveAnalysisToD1, savePromptIfNotExists } from './db';
import { getFromKV, saveToKV } from './kv';
import { fetchSnapshots } from './supabase';

/* chache time */
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function runDailyAnalysis(env: Env, force = false) {
	const since = new Date(Date.now() - daysOfData * 24 * 60 * 60 * 1000).toISOString();

	/* PRODUCTIVE, NORMAL WORKER CODE */
	try {
		/* check if env variables are fine */
		if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
			throw new Error('Missing Supabase config');
		}
		if (!env.ai_analysis_db) {
			throw new Error('D1 not configured');
		}

		/* chache guard in case the entry already existst */
		const cached = await getFromKV<AnalysisCache>(env, 'analysis:latest');
		/* chace gets ignore during cron */
		if (!force && typeof cached?.timestamp === 'string') {
			const age = Date.now() - new Date(cached.timestamp).getTime();

			if (!isNaN(age) && age < CACHE_TTL) {
				console.log('>> Using cached analysis (KV');
				return cached;
			}
		}

		/* get data from table (last X days) */
		const snapshots = await fetchSnapshots(env, daysOfData);

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
		const promptDBResponse = await savePromptIfNotExists(env, prompt, PROMPT_VERSION);

		/* return JOSN response of both requests */
		return {
			analyses,
			aggregatedSnapshots: aggregatedSnapshots,
			d1Response: d1Response,
			kvResponse: kvResponse,
			promptDBResponse: promptDBResponse,
		};
	} catch (err) {
		console.error('X runDailyAnalysis failed:', {
			message: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		throw err;
	}
}
