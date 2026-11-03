// Sends the anonymous counts and email signups queued by js/site.js to the
// database (functions log_event and add_lead in supabase/006_admin.sql).
// Loaded with js/auth.js. Counts never include names; a signup stores the
// email the visitor typed and the page it came from.

(function () {
  var A = window.Web3Auth;
  if (!A) return;
  var queue = window.__w3log = window.__w3log || [];
  var sending = false;

  function send(x) {
    return x.type === 'lead'
      ? A.client.rpc('add_lead', { p_email: x.email, p_source: x.source, p_page: x.page })
      : A.client.rpc('log_event', { p_name: x.name, p_page: x.page, p_item: x.item });
  }

  function flush() {
    if (sending || !queue.length) return;
    sending = true;
    var x = queue.shift();
    Promise.resolve(send(x)).catch(function () { /* counts are best effort */ }).then(function () {
      sending = false;
      flush();
    });
  }

  window.Web3Log = { flush: flush };
  flush();
})();
