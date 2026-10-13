const input = document.querySelector<HTMLTextAreaElement>('#json-input')!;
const output = document.querySelector<HTMLElement>('#json-output')!;
const status = document.querySelector<HTMLElement>('#json-status')!;
const button = document.querySelector<HTMLButtonElement>('#json-run')!;
const compact = document.querySelector<HTMLInputElement>('#json-compact')!;
button.disabled = true;
try {
  const compiled = await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}json-demo.mjs`);
  const documents = new compiled.JsonCodec(compiled.valueCodecs.identity.result);
  const run = () => {
    try {
      const codecs = compiled.valueCodecs.mark_received;
      let request: Uint8Array, reply: Uint8Array;
      if (compact.checked) {
        // Both ends of this demo use the same argument/result schema identities.
        const ingress = codecs.arguments.compact(), egress = codecs.result.compact();
        request = ingress.encode({document: documents.parse(input.value)});
        ingress.validate(request); // relay checks bytes without materialisation
        reply = compiled.callCompact('mark_received', request);
        const result = egress.decode(reply);
        if (!Object.hasOwn(result, 'Ok')) throw Error('Expected an object document');
        output.textContent = documents.stringify(result.Ok);
      } else {
        const documentBytes = documents.parseBinary(input.value);
        request = codecs.arguments.encodeWith((writer: {frame(emit: () => void): void; bytes(data: Uint8Array): void}) => writer.frame(() => writer.bytes(documentBytes.subarray(40))));
        codecs.arguments.validate(request);
        reply = compiled.callBinary('mark_received', request);
        codecs.result.validate(reply);
        if (reply[44] !== 0) throw Error('Expected an object document');
        // Extract this known Result<Json, JsonError> success frame for rendering.
        const result = new Uint8Array(40 + reply.length - 45);
        result.set(documentBytes.subarray(0, 40)); result.set(reply.subarray(45), 40);
        output.textContent = documents.stringifyBinary(result);
      }
      status.textContent = `${compact.checked ? 'Agreed-schema' : 'Portable'} transport · validated ${request.byteLength} request bytes · returned ${reply.byteLength} reply bytes · preserved exact numbers and unknown fields`;
    } catch (error) {
      output.textContent = '';
      status.textContent = String(error instanceof Error ? error.message : error);
    }
  };
  button.disabled = false;
  button.addEventListener('click', run);
  compact.addEventListener('change', run);
  run();
} catch (error) {
  status.textContent = `Could not load the compiled program: ${String(error)}`;
}
