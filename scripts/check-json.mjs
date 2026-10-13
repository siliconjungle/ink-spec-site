import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {JsonCodec,callBinary,callCompact,valueCodecs}=await import(pathToFileURL(resolve(process.argv[2])).href);
const documents=new JsonCodec(valueCodecs.identity.result);
for(const text of ['{}','{"title":null,"unknown":[123456789012345678901234567890,1e10000]}','{"__proto__":"safe"}']){
 const bytes=documents.parseBinary(text),codecs=valueCodecs.mark_received;
 const request=codecs.arguments.encodeWith(w=>w.frame(()=>w.bytes(bytes.subarray(40))));
 assert.equal(valueCodecs.mark_received.arguments.validate(request),true);
 const reply=callBinary('mark_received',request),result=valueCodecs.mark_received.result.decode(reply);
 assert.ok(documents.stringify(result.Ok).startsWith('{"received":true'));
 if(text.includes('unknown'))assert.ok(documents.stringify(result.Ok).includes('[123456789012345678901234567890,1e10000]'));
 const malformed=request.slice();malformed[40]^=255;assert.throws(()=>callBinary('mark_received',malformed));
 const ingress=codecs.arguments.compact(),egress=codecs.result.compact();
 const short=ingress.encode({document:documents.parse(text)}),before=short.slice();
 assert.equal(ingress.validate(short),true);const compactReply=callCompact('mark_received',short);
 assert.deepEqual(short,before);assert.deepEqual(egress.decode(compactReply),result);
 const render=new Uint8Array(40+reply.length-45);render.set(bytes.subarray(0,40));render.set(reply.subarray(45),40);
 assert.equal(documents.stringifyBinary(render),documents.stringify(result.Ok));
 for(let n=0;n<short.length;n++)assert.throws(()=>ingress.validate(short.subarray(0,n)));
}
assert.throws(()=>documents.parse('{"x":1,"x":2}'));
console.log('Published JSON flow preserves exact numbers and unknown fields, and rejects duplicate names and malformed binary.');
