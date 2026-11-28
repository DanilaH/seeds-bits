/** A deadline stops waiting; it never cancels or repeats an unresolved native RPC. */
export async function optionalResult<T>(work: Promise<T>, milliseconds = 1000): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | number | undefined;
  try {
    return await Promise.race([work.catch(() => undefined), new Promise<undefined>(resolve => {timer=setTimeout(resolve,milliseconds);})]);
  } finally {clearTimeout(timer);}
}
const pending = new Map<string, Promise<unknown>>();
export function optionalSingleFlight<T>(key: string, operation: () => Promise<T>): Promise<T | undefined> {
  let work = pending.get(key) as Promise<T> | undefined;
  if (!work) {
    work=Promise.resolve().then(operation);pending.set(key,work);
    void work.finally(()=>{if(pending.get(key)===work)pending.delete(key);}).catch(()=>{});
  }
  return optionalResult(work);
}
