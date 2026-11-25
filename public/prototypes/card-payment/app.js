/* Concept prototype: payment screen that shows what each amount costs.
   All numbers are made up. Interest estimates use a simple monthly model. */

(() => {
  'use strict';

  // ---------- Demo account ----------
  const today = startOfDay(new Date());
  const ACCOUNT = {
    card: 'Everyday Card ••4821',
    from: 'Checking ••0193',
    currentBalance: 1840.68,
    statementBalance: 1612.40,
    lastPayment: 250.00,
    minimum: 48.37,
    apr: 0.24,
    lateFee: 40,
    dueDate: addDays(today, 6),
    // True only if the previous statement was paid in full. Without a grace period, interest
    // builds from each purchase date, so paying the statement balance can still leave some due.
    hasGracePeriod: true,
  };

  const OPTIONS = [
    { id: 'statement', label: 'Last statement balance', amount: ACCOUNT.statementBalance },
    { id: 'current',   label: 'Current balance',        amount: ACCOUNT.currentBalance },
    { id: 'last',      label: 'Last posted payment',    amount: ACCOUNT.lastPayment },
    { id: 'minimum',   label: 'Minimum payment',        amount: ACCOUNT.minimum },
  ];

  const state = { amount: null, source: null, date: null };

  // ---------- Formatting ----------
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmt = (n) => money.format(n);
  const fmt0 = (n) => money0.format(n);
  const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  function duration(months) {
    if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
    const y = Math.floor(months / 12), m = months % 12;
    const ys = `${y} ${y === 1 ? 'year' : 'years'}`;
    return m ? `${ys}, ${m} ${m === 1 ? 'month' : 'months'}` : ys;
  }
  // ---------- Payoff math ----------
  const monthlyRate = ACCOUNT.apr / 12;

  // This payment comes off first, then interest is added to what's left each month.
  // Fixed: the same amount every month. Minimum: the amount due now, then interest + 1%
  // of the balance (at least $25) each month after.
  function project(balance, payment, useMinimum = false) {
    const first = useMinimum ? ACCOUNT.minimum : payment;
    let b = balance - Math.min(first, balance), months = 1, interest = 0;
    while (b > 0.005) {
      const i = b * monthlyRate;
      const p = useMinimum ? Math.max(i + b * 0.01, 25) : payment;
      if (p <= i + 0.005 || months > 1200) return { never: true, monthlyInterest: i };
      b += i; interest += i;
      b -= Math.min(p, b);
      months++;
    }
    return { months, interest, total: balance + interest };
  }

  // Smallest level payment, starting now, that clears the balance in 3 years (36 payments).
  function threeYearPayment(balance) {
    const r = monthlyRate, v = 1 / (1 + r);
    return Math.ceil(balance * (1 - v) / (1 - Math.pow(v, 36)) * 100) / 100;
  }

  function analyze(amount, source) {
    const isMinimum = source === 'minimum';
    const belowMin = !isMinimum && amount < ACCOUNT.minimum - 0.005;
    if (amount >= ACCOUNT.currentBalance - 0.005) return { kind: 'payoff', amount, source };
    if (amount >= ACCOUNT.statementBalance - 0.005) return { kind: 'nointerest', amount, source };
    const proj = isMinimum
      ? project(ACCOUNT.currentBalance, null, true)
      : project(ACCOUNT.currentBalance, amount);
    return { kind: proj.never ? 'never' : 'interest', amount, source, proj, isMinimum, belowMin };
  }

  // ---------- Icons ----------
  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>',
  };

  // What to say about interest when at least the statement balance is paid.
  // "No interest" is only true with a grace period AND an on-time payment.
  function interestNote() {
    const due = fmtDate(ACCOUNT.dueDate);
    if (state.date && state.date > ACCOUNT.dueDate) {
      return { tone: 'warn', text: `This date is after your ${due} due date, so you may be charged interest.` };
    }
    if (!ACCOUNT.hasGracePeriod) {
      return { tone: 'warn', text: 'You carried a balance from an earlier statement, so some interest may still appear on your next one.' };
    }
    return { tone: 'good', text: `Pay by ${due} and you won't be charged interest on the purchases this covers.` };
  }

  // Full explanation shown under the amount on the main screen
  function costHTML(a) {
    const B = fmt(ACCOUNT.currentBalance);
    if (a.kind === 'payoff' || a.kind === 'nointerest') {
      const note = interestNote();
      const rest = ACCOUNT.currentBalance - a.amount;
      const lead = a.kind === 'payoff' ? 'This pays your current balance. ' : '';
      const extra = rest > 0.005 ? ` The remaining ${fmt(rest)} is newer purchases, due on your next statement.` : '';
      return callout(note.tone, note.tone === 'good' ? ICON.check : ICON.alert, lead + note.text + extra);
    }

    let html = '';
    if (a.belowMin) {
      html += callout('warn', ICON.alert,
        `This is less than your ${fmt(ACCOUNT.minimum)} minimum due ${fmtDate(ACCOUNT.dueDate)}. You may be charged a late fee of up to ${fmt0(ACCOUNT.lateFee)}.`);
    }
    // Short intro, then one row for the chosen amount (modeled on the statement's warning table)
    html += a.isMinimum
      ? `<p>If you only pay the minimum each month and make no new purchases, here's what paying off ${B} would look like:</p>`
      : `<p>If you pay this amount each month and make no new purchases, here's what paying off ${B} would look like:</p>`;

    html += `<table class="cost-table">
      <caption>Estimate at ${Math.round(ACCOUNT.apr * 100)}% APR.</caption>
      <thead><tr><th scope="col">Pay each month</th><th scope="col">Paid off in</th><th scope="col">Total you'll pay</th></tr></thead>
      <tbody><tr>
        <td>${a.isMinimum ? 'Only the minimum' : fmt(a.amount)}</td>
        <td>${a.proj.never ? 'Never' : duration(a.proj.months)}</td>
        <td>${a.proj.never ? 'Keeps growing' : fmt0(a.proj.total)}</td>
      </tr></tbody>
    </table>`;
    return html;
  }
  function callout(tone, icon, text) {
    return `<div class="callout callout-${tone}">${icon}<p>${text}</p></div>`;
  }

  // ---------- Elements ----------
  const $ = (id) => document.getElementById(id);
  const phone = $('phone');
  const screenPay = $('screen-pay');
  const screenDone = $('screen-done');
  const sheet = $('sheet');
  const backdrop = $('backdrop');
  const optionsEl = $('options');
  const other = $('other');
  const otherInput = $('other-input');
  const otherHint = $('other-hint');
  const useAmount = $('use-amount');
  const amountValue = $('amount-value');
  const amountSource = $('amount-source');
  const costWrap = $('cost-wrap');
  const cost = $('cost');
  const slider = $('slider');
  const handle = $('slider-handle');
  const sliderText = $('slider-text');
  const slideHint = $('slide-hint');
  const toast = $('toast');

  // ---------- Static content ----------
  $('card-name').textContent = ACCOUNT.card;
  $('card-due').textContent = `${fmt(ACCOUNT.minimum)} minimum due ${fmtDate(ACCOUNT.dueDate)}`;
  $('card-balance').textContent = fmt(ACCOUNT.currentBalance);
  $('from-name').textContent = ACCOUNT.from;
  $('calc-apr').textContent = `${Math.round(ACCOUNT.apr * 100)}%`;
  $('apr-text').textContent = `${Math.round(ACCOUNT.apr * 100)}%`;

  // ---------- Select amount ----------
  // `draft` is what's picked in the popup. Nothing changes on the payment screen
  // until "Use this amount"; closing the popup throws the draft away.
  let draft = { amount: null, source: null };

  OPTIONS.forEach((opt, i) => {
    const label = document.createElement('label');
    label.className = 'card stagger';
    label.style.setProperty('--i', i);
    label.innerHTML = `<input type="radio" name="amount" value="${opt.id}">
      <span class="card-face">
        <span class="card-amount">${fmt(opt.amount)}</span>
        <span class="card-label">${opt.label}</span>
      </span>
      <svg class="card-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`;
    optionsEl.appendChild(label);
  });
  other.style.setProperty('--i', OPTIONS.length);
  $('about-toggle').classList.add('stagger'); $('about-toggle').style.setProperty('--i', OPTIONS.length + 1);

  optionsEl.addEventListener('change', (e) => {
    const opt = OPTIONS.find(o => o.id === e.target.value);
    setOther(0);
    showOtherError('');
    setDraft(opt.amount, opt.id);
  });

  // Digits fill in from the cents, so the decimal point is never typed: 1, 2, 0, 0, 0 becomes $120.00.
  const MAX_DIGITS = 7; // up to $99,999.99
  let otherCents = 0, otherTimer;

  function setOther(cents) {
    otherCents = cents;
    otherInput.value = cents ? fmt(cents / 100) : '';
    caretToEnd();
  }
  function caretToEnd() {
    const end = otherInput.value.length;
    if (document.activeElement === otherInput) otherInput.setSelectionRange(end, end);
  }
  function otherChanged(cents) {
    setOther(cents);
    const n = cents / 100;
    if (!n) { showOtherError(''); setDraft(null, null); return; }
    if (n > ACCOUNT.currentBalance + 0.001) {
      showOtherError(`Enter ${fmt(ACCOUNT.currentBalance)} or less, your current balance.`);
      setDraft(null, null);
      return;
    }
    showOtherError('');
    // $120.00 passes through $0.01, $0.12… on the way, so the chart waits for a pause in typing
    setDraft(n, 'other', 350);
  }

  otherInput.addEventListener('input', () => {
    const digits = otherInput.value.replace(/\D/g, '').replace(/^0+/, '');
    otherChanged(digits.length > MAX_DIGITS ? otherCents : Number(digits));
  });
  // A pasted "120" or "$1,200.50" means dollars, not cents.
  otherInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const n = parseFloat(e.clipboardData.getData('text').replace(/[^0-9.]/g, ''));
    const cents = Math.round(n * 100);
    if (cents > 0 && String(cents).length <= MAX_DIGITS) otherChanged(cents);
  });
  otherInput.addEventListener('focus', () => requestAnimationFrame(caretToEnd));
  otherInput.addEventListener('click', () => {
    if (otherInput.selectionStart === otherInput.selectionEnd) caretToEnd();
  });
  otherInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (!useAmount.disabled) useAmount.click(); }
  });

  function showOtherError(msg) {
    other.classList.toggle('is-invalid', !!msg);
    otherInput.setAttribute('aria-invalid', String(!!msg));
    otherHint.textContent = msg;
  }

  function setDraft(amount, source, wait = 0) {
    draft = { amount, source };
    optionsEl.querySelectorAll('input').forEach(r => { r.checked = r.value === source; });
    other.classList.toggle('is-selected', source === 'other');
    useAmount.disabled = amount == null;
    clearTimeout(otherTimer);
    if (wait) otherTimer = setTimeout(renderCalc, wait);
    else renderCalc();
  }

  useAmount.addEventListener('click', () => {
    if (draft.amount == null) return;
    choose(draft.amount, draft.source);
    closeSheet();
  });

  // ---------- Calculator ----------
  // payment + remaining balance + estimated interest = total
  function breakdown(a) {
    const rest = Math.max(0, Math.round((ACCOUNT.currentBalance - a.amount) * 100) / 100);
    if (a.kind === 'payoff') return { pay: ACCOUNT.currentBalance, rest: 0, interest: 0, months: 1 };
    if (a.kind === 'nointerest') {
      if (interestNote().tone === 'good') return { pay: a.amount, rest, interest: 0, months: 2 };
      const pr = project(ACCOUNT.currentBalance, a.amount);
      return { pay: a.amount, rest, interest: Math.round(pr.interest * 100) / 100, months: pr.months };
    }
    if (a.kind === 'never') return { pay: a.amount, rest, interest: null, months: null };
    return { pay: a.amount, rest, interest: Math.round(a.proj.interest * 100) / 100, months: a.proj.months };
  }

  function basisText(a) {
    if (a.kind === 'payoff') return `no interest if paid by ${fmtDate(ACCOUNT.dueDate)}`;
    if (a.kind === 'nointerest') {
      return a.source === 'statement' ? 'if you pay each statement by its due date' : 'if you pay the rest on your next statement';
    }
    return a.isMinimum ? 'if you only pay the minimum each month' : `if you pay ${fmt(a.amount)} each month`;
  }

  function setSeg(id, share) {
    const el = $(id);
    el.style.width = `${share}%`;
    el.classList.toggle('is-on', share > 0);
  }

  // Show or hide the whole strip. From empty, the sections take their places unseen first,
  // so the strip grows in as one motion.
  function showBar(setShares) {
    const bar = $('bar'), calc = bar.closest('.calc');
    const fromEmpty = $('fill').getBoundingClientRect().width < 1;
    if (fromEmpty) {
      bar.classList.add('no-anim');
      setShares();
      void bar.offsetWidth;
      bar.classList.remove('no-anim');
      calc.classList.remove('is-arriving'); void calc.offsetWidth;
      calc.classList.add('is-arriving');
    } else {
      setShares();
    }
    bar.classList.add('is-filled');
  }
  function emptyBar(instant) {
    const bar = $('bar');
    bar.classList.toggle('no-anim', !!instant);
    bar.classList.remove('is-filled');
    bar.closest('.calc').classList.remove('is-arriving');
    if (instant) { void bar.offsetWidth; bar.classList.remove('no-anim'); }
  }

  let liveTimer;
  function renderCalc() {
    const box = $('calc-total'), basis = $('basis'), segInt = $('seg-int');
    let spoken = '';
    basis.className = 'basis';
    box.classList.toggle('is-empty', draft.amount == null);
    box.classList.remove('is-bad');
    segInt.classList.remove('is-growing');

    if (draft.amount == null) {
      emptyBar();
      ['num-pay', 'num-rest', 'num-int'].forEach(id => { $(id).textContent = '–'; });
      const prompt = other.classList.contains('is-invalid') ? "That's more than you owe" : 'Choose an amount to see your total';
      $('bar-prompt').textContent = prompt;
      $('total').textContent = 'Total: –';
      spoken = prompt + '.';
      $('over').textContent = ''; basis.textContent = '';
    } else {
      const a = analyze(draft.amount, draft.source);
      const d = breakdown(a);
      const never = d.interest == null;
      // With no end date there's no real share to draw, so interest takes a striped half of the bar.
      const total = never ? (d.pay + d.rest) * 2 : d.pay + d.rest + d.interest;
      showBar(() => {
        setSeg('seg-pay', d.pay / total * 100);
        setSeg('seg-rest', d.rest / total * 100);
        setSeg('seg-int', (never ? total / 2 : d.interest) / total * 100);
      });
      segInt.classList.toggle('is-growing', never);
      $('num-pay').textContent = fmt(d.pay);
      $('num-rest').textContent = fmt(d.rest);
      $('num-int').textContent = never ? 'Growing' : fmt(d.interest);
      box.classList.toggle('is-bad', never);
      $('total').textContent = never ? 'Never paid off' : `Total: ${fmt(total)}`;
      $('over').textContent = never ? 'Interest outpaces this payment'
        : d.months === 1 ? 'in 1 payment' : `over ${duration(d.months)}`;
      basis.textContent = basisText(a);
      if (a.kind === 'payoff' || a.kind === 'nointerest') {
        const good = interestNote().tone === 'good';
        const due = fmtDate(ACCOUNT.dueDate);
        if (!good) basis.textContent = state.date > ACCOUNT.dueDate ? `paid after ${due}, so interest may be added`
          : 'some interest may still be added';
        if (!good) basis.classList.add('is-warn');
      } else if (a.belowMin) {
        otherHint.textContent = `Below your ${fmt(ACCOUNT.minimum)} minimum. A late fee may apply.`;
      }
      spoken = `${$('total').textContent} ${$('over').textContent}, ${basis.textContent}. Payment ${fmt(d.pay)}, remaining balance ${fmt(d.rest)}, estimated interest ${$('num-int').textContent}.`;
    }
    clearTimeout(liveTimer); // wait for typing to pause before announcing
    liveTimer = setTimeout(() => { $('calc-live').textContent = spoken; }, 600);
  }

  // ---------- About payment options ----------
  $('about-toggle').addEventListener('click', (e) => {
    const open = e.currentTarget.getAttribute('aria-expanded') !== 'true';
    e.currentTarget.setAttribute('aria-expanded', String(open));
    $('about').classList.toggle('is-open', open);
  });

  // ---------- Choosing an amount ----------
  function choose(amount, source) {
    state.amount = amount; state.source = source;
    const label = source === 'other' ? 'Other amount' : OPTIONS.find(o => o.id === source).label;
    amountValue.textContent = fmt(amount);
    amountValue.classList.remove('link', 'amount-value-pop');
    void amountValue.offsetWidth;
    amountValue.classList.add('amount-value-pop');
    amountSource.textContent = label;
    amountSource.hidden = false;
    renderCost();
    costWrap.classList.add('is-open');
    updateSlider();
  }

  function renderCost() {
    const html = costHTML(analyze(state.amount, state.source));
    if (cost.dataset.html === html) return; // don't re-announce the same thing
    cost.dataset.html = html;
    cost.innerHTML = html;
  }

  // ---------- Bottom sheets: open/close (slide up / slide down) ----------
  let activeSheet = null;
  let lastFocus = null;
  let closeTimer = null;

  function openSheet(el, focusTarget) {
    clearTimeout(closeTimer);
    if (activeSheet && activeSheet !== el) { activeSheet.classList.remove('is-open'); activeSheet.hidden = true; }
    activeSheet = el;
    lastFocus = document.activeElement;
    el.hidden = false; backdrop.hidden = false;
    el.style.setProperty('--drag', '0px');
    void el.offsetHeight; // commit the start position so the transition runs
    el.classList.add('is-open'); backdrop.classList.add('is-open');
    screenPay.inert = true;
    window.scrollTo(0, 0); // on phones the page can be scrolled to the disclaimer
    document.documentElement.classList.add('sheet-open');
    setTimeout(() => { const t = focusTarget(); if (t) t.focus({ preventScroll: true }); }, 60);
  }

  function closeSheet() {
    const el = activeSheet;
    if (!el || !el.classList.contains('is-open')) return;
    el.classList.remove('is-open', 'is-dragging');
    backdrop.classList.remove('is-open');
    screenPay.inert = false;
    document.documentElement.classList.remove('sheet-open');
    closeTimer = setTimeout(() => {
      el.hidden = true; backdrop.hidden = true;
      el.style.setProperty('--drag', '0px');
      if (activeSheet === el) activeSheet = null;
    }, 320);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  $('open-amount').addEventListener('click', () => {
    // start from what's already on the payment screen; nothing is picked the first time
    setOther(state.source === 'other' ? Math.round(state.amount * 100) : 0);
    showOtherError('');
    setDraft(state.amount, state.source);
    sheet.querySelector('.sheet-body').scrollTop = 0;
    openSheet(sheet, () => optionsEl.querySelector('input:checked')
      || (draft.source === 'other' ? otherInput : optionsEl.querySelector('input')));
    emptyBar(true);
    renderCalc(); // fill in as the popup arrives
  });
  backdrop.addEventListener('click', closeSheet);
  document.querySelectorAll('[data-close-sheet]').forEach(b => b.addEventListener('click', closeSheet));

  document.querySelectorAll('.sheet').forEach((el) => {
    // Escape closes; Tab stays inside the sheet
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')]
        .filter(n => !n.disabled && n.offsetParent !== null && (n.type !== 'radio' || n.checked || !el.querySelector('input[type=radio]:checked')));
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Drag the grab bar or header down to dismiss
    let startY = 0, dy = 0, startT = 0, dragging = false;
    const zones = [el.querySelector('.sheet-grab'), el.querySelector('.sheet-header')];
    zones.forEach(z => z.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true; startY = e.clientY; startT = performance.now(); dy = 0;
      el.classList.add('is-dragging');
      z.setPointerCapture(e.pointerId);
    }));
    zones.forEach(z => z.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      el.style.setProperty('--drag', `${dy}px`);
      backdrop.style.opacity = String(Math.max(0.2, 1 - dy / 400));
    }));
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-dragging');
      backdrop.style.opacity = '';
      const fast = dy / Math.max(1, performance.now() - startT) > 0.6;
      if (dy > 110 || (fast && dy > 30)) closeSheet();
      else el.style.setProperty('--drag', '0px'); // springs back with the open transition
    };
    zones.forEach(z => { z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end); });
  });

  // ---------- Pay date + scrollable calendar ----------
  const dateSheet = $('date-sheet');
  const cal = $('cal');
  const MONTHS_AHEAD = 4;
  const longDay = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const shortDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  (function buildCalendar() {
    let html = '';
    for (let m = 0; m < MONTHS_AHEAD; m++) {
      const first = new Date(today.getFullYear(), today.getMonth() + m, 1);
      const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const title = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      html += `<section class="cal-month" aria-label="${title}"><h3 class="cal-title">${title}</h3><div class="cal-grid">`;
      for (let i = 0; i < first.getDay(); i++) html += '<span aria-hidden="true"></span>';
      for (let d = 1; d <= daysIn; d++) {
        const date = new Date(first.getFullYear(), first.getMonth(), d);
        const past = date < today;
        const isDue = sameDay(date, ACCOUNT.dueDate);
        const isToday = sameDay(date, today);
        const tags = [isToday && 'today', isDue && 'payment due date'].filter(Boolean).join(', ');
        html += `<button type="button" class="cal-day${isDue ? ' is-due' : ''}${isToday ? ' is-today' : ''}"
          data-date="${isoDate(date)}" aria-pressed="false" ${past ? 'disabled' : ''}
          aria-label="${longDay(date)}${tags ? ', ' + tags : ''}">
          <span class="cal-num">${d}</span>${isDue ? '<span class="cal-tag">Due</span>' : ''}</button>`;
      }
      html += '</div></section>';
    }
    cal.innerHTML = html;
  })();

  cal.addEventListener('click', (e) => {
    const btn = e.target.closest('.cal-day');
    if (!btn || btn.disabled) return;
    const [y, m, d] = btn.dataset.date.split('-').map(Number);
    setDate(new Date(y, m - 1, d));
    setTimeout(closeSheet, 220);
  });

  $('open-date').addEventListener('click', () => {
    openSheet(dateSheet, () => cal.querySelector('.cal-day[aria-pressed="true"]'));
    // bring the selected day's month into view inside the scroll area
    const sel = cal.querySelector('.cal-day[aria-pressed="true"]');
    if (sel) {
      const month = sel.closest('.cal-month');
      cal.scrollTop = month.offsetTop - cal.offsetTop;
    }
  });

  function setDate(date) {
    state.date = date;
    cal.querySelectorAll('.cal-day').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.date === isoDate(date))));
    const dateValue = $('date-value'), dateSub = $('date-sub');
    dateValue.textContent = shortDay(date);
    dateValue.classList.remove('amount-value-pop'); void dateValue.offsetWidth; dateValue.classList.add('amount-value-pop');
    const late = date > ACCOUNT.dueDate;
    dateSub.textContent = sameDay(date, today) ? 'Today'
      : sameDay(date, ACCOUNT.dueDate) ? 'Your due date'
      : late ? `After your ${fmtDate(ACCOUNT.dueDate)} due date. You may be charged a late fee of up to ${fmt0(ACCOUNT.lateFee)}.`
      : `Due ${fmtDate(ACCOUNT.dueDate)}`;
    dateSub.classList.toggle('is-warn', late);
    if (state.amount != null) renderCost(); // the interest message depends on the date
    updateSlider();
  }

  // ---------- Slide to pay ----------
  function updateSlider() {
    const ready = state.amount != null && state.date != null;
    slider.classList.toggle('is-disabled', !ready);
    handle.disabled = !ready;
    if (ready) {
      slideHint.textContent = `Pays ${fmt(state.amount)} on ${fmtDate(state.date)}`;
      handle.setAttribute('aria-label', `Slide to pay ${fmt(state.amount)} on ${fmtDate(state.date)}. Or press Enter to pay.`);
      // restart the nudge so people notice it's ready
      handle.style.animation = 'none'; void handle.offsetWidth; handle.style.animation = '';
    } else {
      slideHint.textContent = state.amount == null && state.date == null
        ? 'Choose an amount and a date to continue.'
        : state.amount == null ? 'Choose an amount to continue.' : 'Choose a date to continue.';
    }
  }

  (() => {
    let startX = 0, x = 0, max = 0, dragging = false;
    const setX = (v) => {
      x = v;
      slider.style.setProperty('--x', `${v}px`);
      sliderText.style.opacity = String(1 - Math.min(1, v / (max * 0.6)));
    };
    handle.addEventListener('pointerdown', (e) => {
      if (handle.disabled || slider.classList.contains('is-done')) return;
      dragging = true;
      handle.style.animation = 'none';
      slider.classList.remove('is-returning');
      max = slider.clientWidth - handle.offsetWidth - 8;
      startX = e.clientX - x;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      setX(Math.min(max, Math.max(0, e.clientX - startX)));
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      slider.classList.add('is-returning');
      // an interrupted gesture (pointercancel) must never pay
      if (e.type === 'pointerup' && x >= max * 0.85) { setX(max); complete(); }
      else { setX(0); sliderText.style.opacity = ''; }
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    // Keyboard alternative to dragging
    handle.addEventListener('keydown', (e) => {
      if (handle.disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        max = slider.clientWidth - handle.offsetWidth - 8;
        slider.classList.add('is-returning');
        setX(max); complete();
      }
    });
    window.resetSlider = () => {
      slider.classList.remove('is-done', 'is-returning');
      setX(0); sliderText.style.opacity = ''; sliderText.textContent = 'Slide to pay';
    };
  })();

  function complete() {
    slider.classList.add('is-done');
    sliderText.textContent = 'Paying…';
    sliderText.style.opacity = '1';
    handle.disabled = true;
    setTimeout(showDone, 650);
  }

  // ---------- Confirmation ----------
  function showDone() {
    const a = analyze(state.amount, state.source);
    $('done-amount').textContent = fmt(state.amount);
    $('done-list').innerHTML = [
      ['To', ACCOUNT.card], ['From', ACCOUNT.from], ['Date', fmtDate(state.date)],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    let note = '';
    if (a.kind === 'payoff' || a.kind === 'nointerest') note = interestNote().tone === 'good'
      ? `This is on time, so you won't be charged interest on the purchases it covers.`
      : interestNote().text;
    else if (a.kind === 'interest' && !a.isMinimum) note = `If you keep paying ${fmt(state.amount)} a month, you're on track to pay off your card in about ${duration(a.proj.months)}.`;
    else note = `Paying ${fmt(threeYearPayment(ACCOUNT.currentBalance))} a month would pay off your card in 3 years.`;
    $('done-note').textContent = note;
    screenPay.hidden = true;
    // re-trigger entrance animations
    screenDone.hidden = false;
    screenDone.querySelectorAll('.done-body > *, .check *').forEach(el => {
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    });
    $('done-title').focus();
  }

  // ---------- Reset ----------
  function reset() {
    state.amount = null; state.source = null;
    setOther(0); showOtherError(''); setDraft(null, null);
    amountValue.textContent = 'Select amount'; amountValue.classList.add('link');
    amountSource.hidden = true;
    costWrap.classList.remove('is-open');
    setTimeout(() => { if (!costWrap.classList.contains('is-open')) { cost.innerHTML = ''; cost.dataset.html = ''; } }, 400);
    setDate(today);
    window.resetSlider();
    updateSlider();
    screenDone.hidden = true; screenPay.hidden = false;
    screenPay.scrollTop = 0;
  }
  $('restart').addEventListener('click', () => { reset(); $('open-amount').focus(); });
  $('close-pay').addEventListener('click', () => { reset(); showToast('Started over'); });
  $('pay-from').addEventListener('click', () => showToast('This demo has one checking account'));

  // ---------- Toast ----------
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  // ---------- Date helpers ----------
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function sameDay(a, b) { return a.getTime() === b.getTime(); }
  function isoDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

  setDate(today);
  setDraft(null, null);
})();
