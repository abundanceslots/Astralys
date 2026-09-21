const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);

const projectRef = args.get('--project-ref') ?? process.env.SUPABASE_PROJECT_REF;
const secret = process.env.JEV_BATCH_SECRET;
const batchSize = Math.max(1, Math.min(25, Number(args.get('--batch-size') ?? 20)));
const maximum = Math.max(1, Number(args.get('--maximum') ?? 10_000));

if (!projectRef || !secret) {
  console.error('Missing SUPABASE_PROJECT_REF or JEV_BATCH_SECRET.');
  process.exit(1);
}

const endpoint = `https://${projectRef}.supabase.co/functions/v1/classify-system-visuals`;
let processed = 0;
let failed = 0;

while (processed < maximum) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-batch-secret': secret },
    body: JSON.stringify({ batchSize: Math.min(batchSize, maximum - processed) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? `Batch request failed (${response.status}).`);
  if (!payload.claimed) break;
  processed += payload.claimed;
  failed += payload.claimed - payload.complete;
  console.log(`Classified ${processed}; failed attempts ${failed}.`);
  await new Promise(resolve => setTimeout(resolve, 350));
}

console.log(`Finished. Claimed ${processed} systems; ${failed} attempts need a retry.`);

