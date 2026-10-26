import test from 'node:test';
import assert from 'node:assert/strict';

// Full HTTP security test with no external services or live database writes.
process.env.NODE_ENV='test';
process.env.ADMIN_PASSWORD='admin-session-test-password-27';
delete process.env.ALLOW_LEGACY_ADMIN_HEADER;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
const {default:app}=await import('../server/index.js');

test('admin login has HttpOnly cookie; password header is not accepted by default; writes require CSRF',async()=>{
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const unauth=await fetch(`${base}/api/admin/questions`,{headers:{'x-admin-password':process.env.ADMIN_PASSWORD}});
    assert.equal(unauth.status,401);
    const response=await fetch(`${base}/api/admin/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.ADMIN_PASSWORD})});
    assert.equal(response.status,200);
    const {csrfToken}=await response.json();
    const cookie=response.headers.get('set-cookie');
    assert.match(cookie,/HttpOnly/);
    assert.ok(!cookie.includes(process.env.ADMIN_PASSWORD));
    const cookieHeader=cookie.split(';')[0];
    const session=await fetch(`${base}/api/admin/session`,{headers:{Cookie:cookieHeader}});
    assert.equal(session.status,200);
    assert.equal((await session.json()).csrfToken,csrfToken);
    const questions=await fetch(`${base}/api/admin/questions`,{headers:{Cookie:cookieHeader}});
    assert.equal(questions.status,200);
    assert.deepEqual(await questions.json(),[]);
    const blocked=await fetch(`${base}/api/admin/stock`,{method:'POST',headers:{Cookie:cookieHeader,'Content-Type':'application/json'},body:JSON.stringify({slug:'x',available:true})});
    assert.equal(blocked.status,403);
    const allowed=await fetch(`${base}/api/admin/stock`,{method:'POST',headers:{Cookie:cookieHeader,'x-admin-csrf':csrfToken,'Content-Type':'application/json'},body:JSON.stringify({slug:'x',available:true})});
    assert.equal(allowed.status,400);
    const logout=await fetch(`${base}/api/admin/logout`,{method:'POST',headers:{Cookie:cookieHeader}});
    assert.equal(logout.status,200);
    assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});
