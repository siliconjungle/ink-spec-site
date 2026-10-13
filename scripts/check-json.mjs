import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {JsonCodec,callBinary,valueCodecs}=await import(pathToFileURL(resolve(process.argv[2])).href);
const documents=new JsonCodec(valueCodecs.identity.result);
for(const text of ['{}','{"title":null,"unknown":[123456789012345678901234567890,1e10000]}','{"__proto__":"safe"}']){
 const request=valueCodecs.mark_received.arguments.encode({document:documents.parse(text)});
 assert.equal(valueCodecs.mark_received.arguments.validate(request),true);
 const reply=callBinary('mark_received',request),result=valueCodecs.mark_received.result.decode(reply);
 assert.ok(documents.stringify(result.Ok).startsWith('{"received":true'));
 if(text.includes('unknown'))assert.ok(documents.stringify(result.Ok).includes('[123456789012345678901234567890,1e10000]'));
 const malformed=request.slice();malformed[40]^=255;assert.throws(()=>callBinary('mark_received',malformed));
}
assert.throws(()=>documents.parse('{"x":1,"x":2}'));
console.log('Published JSON flow preserves exact numbers and unknown fields, and rejects duplicate names and malformed binary.');
