// Supabase owns authentication and session storage. RLS remains the database
// security boundary; this UI check does not replace database authorization.
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const form = el('admin-login');
  let client;
  let subscription;
  let busy = true;
  let revision = 0;

  function setBusy(value) {
    busy = value;
    el('admin-main').setAttribute('aria-busy', String(value));
    el('login-fields').disabled = value;
    el('logout-button').disabled = value;
    el('retry-button').disabled = value;
    el('login-button').textContent = value ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ / Login';
  }

  function message(text = '') {
    el('admin-error').textContent = text;
    el('admin-error').hidden = !text;
    el('admin-status').textContent = '';
  }

  function login(text = '') {
    el('admin-dashboard').hidden = true;
    el('session-actions').hidden = true;
    form.hidden = false;
    el('admin-password').value = '';
    message(text);
  }

  function locked(text) {
    // Fail closed even if a network failure prevents session revocation.
    form.hidden = true;
    el('admin-dashboard').hidden = true;
    el('session-actions').hidden = !client;
    el('admin-password').value = '';
    message(text);
  }

  async function signOutToLogin(text = '') {
    revision++;
    locked('กำลังออกจากระบบ…');
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      login(text);
    } catch {
      locked('ยังออกจากระบบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและกดออกจากระบบอีกครั้ง');
    }
  }

  async function verifyAdmin() {
    const current = ++revision;
    el('admin-dashboard').hidden = true;
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (current !== revision) return;
    if (sessionError) throw sessionError;
    if (!sessionData.session) { login(); return; }

    // getUser validates the current token with Supabase Auth. Never authorize
    // from an email, a hard-coded UID, or the local session object alone.
    const { data: userData, error: userError } = await client.auth.getUser();
    if (current !== revision) return;
    if (userError || !userData.user) {
      await signOutToLogin('การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
      return;
    }
    const uid = userData.user.id;
    const { data: admin, error } = await client.from('admin_users')
      .select('id').eq('id', uid).maybeSingle();
    if (current !== revision) return;
    if (error) {
      await signOutToLogin('ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาลองเข้าสู่ระบบอีกครั้ง');
      return;
    }
    if (!admin || admin.id !== uid) {
      await signOutToLogin('ไม่อนุญาตให้เข้าถึง บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลร้าน');
      return;
    }
    message();
    form.hidden = true;
    el('admin-password').value = '';
    el('admin-dashboard').hidden = false;
    el('session-actions').hidden = false;
    el('dashboard-title').focus();
  }

  async function checkSession() {
    if (busy) return;
    setBusy(true);
    try { await verifyAdmin(); }
    catch { locked('ไม่สามารถตรวจสอบการเข้าสู่ระบบได้ กรุณาออกจากระบบแล้วลองอีกครั้ง'); }
    finally { setBusy(false); }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !client || !form.reportValidity()) return;
    setBusy(true);
    message();
    try {
      const request = client.auth.signInWithPassword({
        email: el('admin-email').value.trim(),
        password: el('admin-password').value
      });
      // Do not retain passwords in application state, logs, or storage.
      el('admin-password').value = '';
      const { error } = await request;
      if (error) {
        login(error.status === 429
          ? 'มีการเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่'
          : 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน แล้วลองอีกครั้ง');
        return;
      }
      await verifyAdmin();
    } catch {
      locked('ไม่สามารถตรวจสอบการเข้าสู่ระบบได้ กรุณาออกจากระบบแล้วลองอีกครั้ง');
    } finally { setBusy(false); }
  });

  el('logout-button').addEventListener('click', async () => {
    if (busy) return;
    setBusy(true);
    try { await signOutToLogin(); }
    finally { setBusy(false); }
  });

  async function start() {
    setBusy(true);
    el('retry-button').hidden = true;
    message();
    el('admin-status').textContent = 'กำลังตรวจสอบการเข้าสู่ระบบ…';
    try {
      client = await window.PengPengSupabase.getAdminClient();
      subscription?.unsubscribe();
      const { data } = client.auth.onAuthStateChange((event) => {
        // Keep this callback synchronous: SDK auth calls inside it can deadlock.
        if (event === 'SIGNED_OUT') {
          revision++;
          el('admin-dashboard').hidden = true;
          if (!busy) login();
        } else if (!busy && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
          el('admin-dashboard').hidden = true;
          setTimeout(checkSession, 0);
        }
      });
      subscription = data.subscription;
      await verifyAdmin();
    } catch {
      locked('เชื่อมต่อระบบผู้ดูแลไม่สำเร็จ กรุณาลองอีกครั้ง');
      el('retry-button').hidden = false;
    } finally { setBusy(false); }
  }

  el('retry-button').addEventListener('click', () => { if (!busy) void start(); });
  // Recheck authorization after returning to a backgrounded admin page.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && client) void checkSession();
  });
  void start();
})();
