import { runAIWithTimeout } from '../utils/timeout';

/* ai- models */
const MODELS = [
	{
		name: 'llama',
		id: '@cf/meta/llama-3.1-8b-instruct-fp8',
	},
	{
		name: 'mistral',
		id: '@cf/mistral/mistral-7b-instruct-v0.1',
	},
];

export async function runAnalysis(env: Env, prompt: string): Promise<Record<string, string>> {
	/* maxTokenSize: limit Token usage, temperature: limit creativity */
	/* top_p = nucleus sampling: the smaller, the more important words gets chosen next */
	const AI_OPTIONS = {
		max_tokens: 750,
		temperature: 0.2,
		top_p: 0.9,
	};

	const results: Record<string, string> = {};

	for (const model of MODELS) {
		try {
			/* request for ai-worker */
			const res = await runAIWithTimeout(
				env.AI.run(model.id as any, {
					messages: [{ role: 'user', content: prompt }],
					...AI_OPTIONS,
				}),
			);
			/* results in array */
			results[model.name] = res?.response?.trim() || 'NO VALID ANALYSIS';
			/* ERROR DEBUG */
		} catch (err) {
			console.error(`AI error (${model.name})`, err);
			results[model.name] = `ERROR: ${String(err)}`;
		}
	}

	return results;
}
