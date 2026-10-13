import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const {JsonCodec,TypedJsonCodec,callBinary,callCompact,callOwned,valueCodecs,compiledValues,callCompiled}=await import(pathToFileURL(resolve(process.argv[2])).href);
const documents=new JsonCodec(valueCodecs.identity.result);
const host={title:'hello',unknown:{items:[true,null,3]}},expected={received:true,...host};
const document=documents.fromJS(host),owned=callOwned('mark_received',[document]);
assert.deepEqual(documents.toJS(owned.Ok),expected);
for(const [codec,call] of [[valueCodecs.mark_received,callBinary],[{arguments:valueCodecs.mark_received.arguments.compact(),result:valueCodecs.mark_received.result.compact()},callCompact]]){
 const request=codec.arguments.encode({document}),result=codec.result.decode(call('mark_received',request));
 assert.deepEqual(documents.toJS(result.Ok),expected);
}
host.unknown.items[0]=false;assert.equal(documents.toJS(owned.Ok).unknown.items[0],true);
const big=documents.fromJS({id:9007199254740993n});
assert.throws(()=>documents.toJS(big),/precision/);
assert.deepEqual(documents.toJS(big,{numbers:'bigint'}),{id:9007199254740993n});
assert.throws(()=>documents.fromJS({missing:undefined}));
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
 assert.deepEqual(documents.parseCompact(text),documents.values.compact().encode(documents.parse(text)));
 const directDocument=documents.parseCompact(text);
 assert.deepEqual(ingress.encodeWith(w=>w.frame(()=>w.bytes(directDocument.subarray(1)))),short);
 const typed=new TypedJsonCodec(codecs.arguments);assert.deepEqual(typed.parseCompact(typed.stringify({document:documents.parse(text)})),short);
 assert.equal(ingress.validate(short),true);const compactReply=callCompact('mark_received',short);
 assert.deepEqual(short,before);assert.deepEqual(egress.decode(compactReply),result);
 const render=new Uint8Array(40+reply.length-45);render.set(bytes.subarray(0,40));render.set(reply.subarray(45),40);
 assert.equal(documents.stringifyBinary(render),documents.stringify(result.Ok));
 for(let n=0;n<short.length;n++)assert.throws(()=>ingress.validate(short.subarray(0,n)));
}
assert.throws(()=>documents.parse('{"x":1,"x":2}'));
console.log('Published JSON flow preserves exact numbers and unknown fields, and rejects duplicate names and malformed binary.');

const privateInput=compiledValues.mark_received.params[0];
const privateDoc=privateInput.decodeCompact(documents.parseCompact(JSON.stringify({title:'hello',unknown:{items:[true,null,3]}})));
const privateReply=callCompiled('mark_received',[privateDoc]);
assert.deepEqual(documents.toJS(compiledValues.mark_received.result.materialize(privateReply).Ok),documents.toJS(owned.Ok));
assert.deepEqual(compiledValues.mark_received.result.encodeCompact(privateReply),valueCodecs.mark_received.result.compact().encode(owned));
