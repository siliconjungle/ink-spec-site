const input = document.querySelector<HTMLTextAreaElement>('#json-input')!;
const output = document.querySelector<HTMLElement>('#json-output')!;
const status = document.querySelector<HTMLElement>('#json-status')!;
const button = document.querySelector<HTMLButtonElement>('#json-run')!;
button.disabled = true;
try {
  const compiled = await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}json-demo.mjs`);
  const documents = new compiled.JsonCodec(compiled.valueCodecs.identity.result);
  const run = () => {
    try {
      const documentValue = documents.parse(input.value);
      const request = compiled.valueCodecs.mark_received.arguments.encode({document: documentValue});
      // This relay validates typed bytes; it never decodes a document tree.
      compiled.valueCodecs.mark_received.arguments.validate(request);
      const reply = compiled.callBinary('mark_received', request);
      const result = compiled.valueCodecs.mark_received.result.decode(reply);
      if (!Object.hasOwn(result, 'Ok')) throw Error('Expected an object document');
      output.textContent = documents.stringify(result.Ok);
      status.textContent = `Validated ${request.byteLength} request bytes · returned ${reply.byteLength} reply bytes · preserved exact numbers and unknown fields`;
    } catch (error) {
      output.textContent = '';
      status.textContent = String(error instanceof Error ? error.message : error);
    }
  };
  button.disabled = false;
  button.addEventListener('click', run);
  run();
} catch (error) {
  status.textContent = `Could not load the compiled program: ${String(error)}`;
}
