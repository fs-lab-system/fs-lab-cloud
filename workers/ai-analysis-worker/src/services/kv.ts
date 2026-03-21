/* take data from, JSON to KV! */
export async function saveToKV(env: Env, key: string, data: unknown) {
	await env.AI_ANALYSIS.put(key, JSON.stringify(data));
}

/* get/fetch data from KV and parse to JSON-Object*/
export async function getFromKV<T = unknown>(env: Env, key: string): Promise<T | null> {
	const raw = await env.AI_ANALYSIS.get(key);
	return raw ? JSON.parse(raw) : null;
}

/* saves data per model seperatley */
export async function saveModelAnalysis(env: Env, model: string, data: string) {
	const key = `analysis:${model}:latest`;
	await saveToKV(env, key, data);
}
