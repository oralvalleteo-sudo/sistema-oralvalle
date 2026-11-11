const test=require('node:test'),assert=require('node:assert/strict');
test('API de certificado recusa conta válida sem autorização da clínica antes de ler o certificado',async()=>{
 const original=globalThis.fetch,base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
 process.env.SUPABASE_URL='https://supabase.invalid';process.env.SUPABASE_ANON_KEY='public-synthetic';let checked=false;
 globalThis.fetch=async(url,opts)=>String(url).includes('/auth/v1/user')?Response.json({id:'synthetic-user'}):(checked=true,new Response(null,{status:403}));
 try{for(const name of ['certificado','certificado-inspecionar','certificado-assinar-pdf']){
 let status,body;const res={setHeader(){},status(s){status=s;return this},json(v){body=v;return this}};
 await require('../api/'+name)({method:'POST',headers:{authorization:'Bearer synthetic'},body:{clinic_id:'11111111-1111-1111-1111-111111111111'}},res);assert.equal(status,403);assert.match(body.error,/clínica/);
 }assert.equal(checked,true);
 }finally{globalThis.fetch=original;if(base===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=base;if(anon===undefined)delete process.env.SUPABASE_ANON_KEY;else process.env.SUPABASE_ANON_KEY=anon;}
});
