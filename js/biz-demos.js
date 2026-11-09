// Three tiny playable example concepts for /launch-your-toy/. Made up for
// illustration (no real project), about 30 seconds each:
//   liquidation: borrow against ETH, survive a price drop
//   slippage:    pick a slippage setting before the market moves
//   bridge:      put the bridge steps in the right order
//   Web3BizDemos.play(id, box) draws the demo inside box.

(function () {
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var sound = function (n) { var s = window.WEB3TOYS && window.WEB3TOYS.sound; if (s) s.play(n); };

  function result(box, good, title, lesson, again) {
    box.insertAdjacentHTML('beforeend', '<div class="demo-result ' + (good ? 'is-good' : 'is-bad') + '"><b>' + esc(title) + '</b><span>' + esc(lesson) + '</span>' +
      '<button type="button" class="text-button" data-again>Play again</button></div>');
    box.querySelector('[data-again]').addEventListener('click', again);
    sound(good ? 'cash' : 'buzz');
  }

  var DEMOS = {
    liquidation: function (box) {
      var start = function () {
        box.innerHTML = '<p class="demo-q">You lock <b>1 ETH ($3,000)</b> and borrow dollars against it. You get liquidated if your loan goes over <b>80%</b> of what your ETH is worth. How much do you borrow?</p>' +
          '<div class="demo-opts">' + [1000, 1800, 2300].map(function (v) { return '<button type="button" class="btn btn--small" data-v="' + v + '">$' + v.toLocaleString('en-US') + '</button>'; }).join('') + '</div>';
        box.querySelectorAll('[data-v]').forEach(function (b) {
          b.addEventListener('click', function () {
            var debt = Number(b.getAttribute('data-v'));
            var eth = 2100;
            var limit = eth * 0.8;
            box.innerHTML = '<p class="demo-q">📉 ETH drops 30%. Your ETH is now worth <b>$2,100</b>, so the limit is <b>$1,680</b>. Your loan: <b>$' + debt.toLocaleString('en-US') + '</b>.</p>' +
              '<div class="demo-bar"><span style="width:' + Math.min(100, Math.round(debt / eth * 100)) + '%"></span><i style="left:80%"></i></div>';
            if (debt <= limit) result(box, true, 'You survived!', 'You kept a buffer. Borrowing less than you can is how people avoid liquidation.', start);
            else result(box, false, 'Liquidated.', 'Your loan went over the limit, so part of your ETH was sold to repay it. A bigger buffer would have saved you.', start);
          });
        });
      };
      start();
    },

    slippage: function (box) {
      var start = function () {
        box.innerHTML = '<p class="demo-q">You swap <b>$1,000</b>. Before your trade lands, the price moves <b>0.8%</b>. Pick your slippage limit:</p>' +
          '<div class="demo-opts">' + ['0.1%', '1%', '15%'].map(function (v) { return '<button type="button" class="btn btn--small" data-v="' + v + '">' + v + '</button>'; }).join('') + '</div>';
        box.querySelectorAll('[data-v]').forEach(function (b) {
          b.addEventListener('click', function () {
            var v = b.getAttribute('data-v');
            box.innerHTML = '<p class="demo-q">Your limit: <b>' + v + '</b>. The price moved <b>0.8%</b>.</p>';
            if (v === '0.1%') result(box, false, 'Trade failed.', 'The price moved more than you allowed, so the swap stopped. Your money is safe, but you still paid the network fee.', start);
            else if (v === '1%') result(box, true, 'Swapped!', 'Just enough room for normal price moves. Small limits on big pools are the sweet spot.', start);
            else result(box, false, 'Swapped, but…', 'A 15% limit lets bots trade just before and after you and take up to 15%. Keep the limit low.', start);
          });
        });
      };
      start();
    },

    bridge: function (box) {
      var steps = ['Check you are on the official site', 'Connect your wallet', 'Pick the networks and amount', 'Confirm, then wait for it to arrive'];
      var start = function () {
        var order = steps.map(function (s, i) { return i; }).sort(function () { return Math.random() - 0.5; });
        var next = 0;
        box.innerHTML = '<p class="demo-q">Tap the four bridge steps in the right order.</p><div class="demo-opts demo-opts--col">' +
          order.map(function (i) { return '<button type="button" class="btn btn--small" data-i="' + i + '">' + esc(steps[i]) + '</button>'; }).join('') + '</div><p class="small-print" data-left>4 to go</p>';
        box.querySelectorAll('[data-i]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (Number(b.getAttribute('data-i')) !== next) {
              box.innerHTML = '';
              result(box, false, 'Not that one.', next === 0 ? 'Always check the website first. Fake bridge sites are a common way to lose funds.' : 'Close! The order matters, so you never sign on the wrong site or network.', start);
              return;
            }
            b.disabled = true;
            b.classList.add('is-done');
            next++;
            sound('pop');
            box.querySelector('[data-left]').textContent = next < 4 ? (4 - next) + ' to go' : '';
            if (next === 4) result(box, true, 'Bridged safely!', 'Official site first, then wallet, then networks, then confirm and wait. Bridges take minutes, so do not panic and send again.', start);
          });
        });
      };
      start();
    },
  };

  window.Web3BizDemos = {
    play: function (id, box) { if (DEMOS[id]) DEMOS[id](box); },
  };
})();
