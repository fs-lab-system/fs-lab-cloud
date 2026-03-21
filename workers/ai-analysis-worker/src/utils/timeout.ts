/* secure timeout error from ai-worker */
/* waiting max 50s */
export async function runAIWithTimeout(promise: Promise<any>, timeoutMs = 50000) {
	const timeout = new Promise((_, reject) => {
		setTimeout(() => {
			reject(new Error('AI request took too long'));
		}, timeoutMs);
	});

	return Promise.race([promise, timeout]);
}
