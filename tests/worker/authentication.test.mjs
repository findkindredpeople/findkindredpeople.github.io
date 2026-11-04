import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {sign,verify,webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../../worker/kindred-push.js',import.meta.url),'utf8');
const directory=mkdtempSync(join(tmpdir(),'kindred-test-certificate-'));
let privateKey,certificate;
try {
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1',
    '-subj','/CN=kindred-local-test','-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem')],{stdio:'ignore'});
  privateKey=readFileSync(join(directory,'key.pem'),'utf8');
  certificate=readFileSync(join(directory,'cert.pem'),'utf8');
} finally {rmSync(directory,{recursive:true,force:true});}
const now=Math.floor(Date.now()/1000);
const claims={sub:'sender',aud:'test',iss:'https://securetoken.google.com/test',iat:now-10,exp:now+3600,auth_time:now-20};
function token(changes={},headerChanges={}) {
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned=encode({alg:'RS256',kid:'local-test',...headerChanges})+'.'+encode({...claims,...changes});
  return unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),privateKey).toString('base64url');
}
function setup() {
  const state={assertions:[]};
  const context=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Request,Response,Headers,
    URLSearchParams,atob,btoa,console:{error:()=>{}},fetch:async(url,options={})=>{
      if(String(url).includes('/metadata/x509/'))return new Response(JSON.stringify({'local-test':certificate}));
      if(String(url)==='https://oauth2.googleapis.com/token'){
        state.assertions.push(String(options.body.get('assertion')));
        return new Response('{"access_token":"local-oauth-test"}');
      }
      throw Error('Unexpected external request');
    }});
  vm.runInContext(source.replace('export default {','globalThis.worker = {'),context);
  return {context,state};
}
test('Firebase JWT validation checks a real RSA signature through an X.509 certificate',async()=>{
  const {context}=setup();const result=await context.verifyFirebaseIdToken(token(),'test');
  assert.equal(result.uid,'sender');
});
for(const [label,changes] of [
  ['expired',{exp:now-1}],['wrong audience',{aud:'another'}],['wrong issuer',{iss:'https://example.invalid'}],
  ['empty uid',{sub:''}],['future issuance',{iat:now+3600}],['future login',{auth_time:now+3600}],
  ['string expiry',{exp:String(now+3600)}],['invalid uid path',{sub:'sender/other'}]
])test('rejects '+label+' even with an otherwise valid RSA signature',async()=>{
  const {context}=setup();assert.equal(await context.verifyFirebaseIdToken(token(changes),'test'),null);
});
test('rejects tampering, unknown keys, wrong algorithm, and malformed JWT',async()=>{
  const {context}=setup();const valid=token();const [header,,signature]=valid.split('.');
  const altered=Buffer.from(JSON.stringify({...claims,sub:'attacker'})).toString('base64url');
  for(const value of [header+'.'+altered+'.'+signature,token({},{kid:'unknown'}),token({},{alg:'none'}),'bad-token']){
    assert.equal(await context.verifyFirebaseIdToken(value,'test'),null);
  }
});
test('service account OAuth assertion is signed correctly and requests FCM and Firestore access',async()=>{
  const {context,state}=setup();
  const result=await context.getGoogleAccessToken({client_email:'local-test@example.invalid',private_key:privateKey});
  assert.equal(result,'local-oauth-test');assert.equal(state.assertions.length,1);
  const [header,payload,signature]=state.assertions[0].split('.');
  assert.equal(verify('RSA-SHA256',Buffer.from(header+'.'+payload),certificate,Buffer.from(signature,'base64url')),true);
  const claims=JSON.parse(Buffer.from(payload,'base64url'));
  assert.equal(claims.iss,'local-test@example.invalid');assert.equal(claims.aud,'https://oauth2.googleapis.com/token');
  assert.match(claims.scope,/firebase.messaging/);assert.match(claims.scope,/datastore/);
  assert.equal(claims.exp-claims.iat,3600);
});
