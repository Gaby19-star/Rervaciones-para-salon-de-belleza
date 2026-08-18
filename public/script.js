const state = {
  config: null,
  service: null,
  extras: {},
  day: null,
  slot: null,
  payment: null,
  rate: null,
  bookedSlots: [],
};

const DOW = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function dateKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isSameDay(a,b){ return dateKey(a) === dateKey(b); }
function fmt(n){ return state.config.currency + n.toFixed(2); }
function fmtBs(n){
  const bs = n * (state.rate || 40);
  return bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs.';
}
function slotToMinutes(s){
  const [time, ampm] = s.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h*60 + m;
}

async function init(){
  state.config = await fetch('/api/config').then(r => r.json());
  const CONFIG = state.config;

  document.getElementById('cfg-emoji').textContent = CONFIG.emoji;
  document.getElementById('cfg-category').textContent = CONFIG.category.toUpperCase();
  document.getElementById('cfg-name').textContent = CONFIG.name;
  document.getElementById('cfg-name-2').textContent = CONFIG.name;
  document.getElementById('cfg-phone').textContent = CONFIG.phone;

  renderServices();
  renderExtras();
  await renderDays();
  renderPayMethods();
  loadExchangeRate();
}



function calcExtrasTotal(){
  return state.config.extras.reduce((sum, ex) => sum + (state.extras[ex.id] || 0) * ex.price, 0);
}
function calcGrandTotal(){
  return (state.service ? state.service.price : 0) + calcExtrasTotal();
}
function updateQuote(){
  document.getElementById('quote-amount').textContent = fmt(calcGrandTotal());
}



function renderServices(){
  const list = document.getElementById('service-list');
  state.config.services.forEach(svc => {
    const el = document.createElement('div');
    el.className = 'service-card';
    el.innerHTML = `
      <div class="info"><b>${svc.name}</b><span>${svc.duration}</span></div>
      <div class="price">${fmt(svc.price)}</div>`;
    el.addEventListener('click', () => {
      document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      state.service = svc;
      document.getElementById('btn-to-extras').disabled = false;
      updateQuote();
    });
    list.appendChild(el);
  });
}



function renderExtras(){
  const list = document.getElementById('extra-list');
  state.config.extras.forEach(ex => {
    state.extras[ex.id] = 0;
    const el = document.createElement('div');
    el.className = 'extra-row';
    el.innerHTML = `
      <span class="name">${ex.name}</span>
      <div class="right">
        <span class="add-price">+${fmt(ex.price)}</span>
        <div class="qty-stepper">
          <button type="button" class="qty-btn minus">−</button>
          <span class="qty-val">1</span>
          <button type="button" class="qty-btn plus">+</button>
        </div>
      </div>`;
    const qtyVal = el.querySelector('.qty-val');
    const minusBtn = el.querySelector('.minus');
    const plusBtn = el.querySelector('.plus');

    function setQty(q){
      q = Math.max(0, Math.min(ex.maxQty, q));
      state.extras[ex.id] = q;
      qtyVal.textContent = q;
      el.classList.toggle('selected', q > 0);
      updateQuote();
    }
    el.addEventListener('click', (e) => {
      if (e.target === minusBtn || e.target === plusBtn) return;
      setQty(state.extras[ex.id] > 0 ? 0 : 1);
    });
    minusBtn.addEventListener('click', (e) => { e.stopPropagation(); setQty(state.extras[ex.id] - 1); });
    plusBtn.addEventListener('click', (e) => { e.stopPropagation(); setQty(state.extras[ex.id] + 1); });

    list.appendChild(el);
  });
  updateQuote();
}



const dayRow = document.getElementById('day-row');
const slotGrid = document.getElementById('slot-grid');
const emptyNote = document.getElementById('empty-note');
const monthYearLabel = document.getElementById('month-year');

function buildUpcomingDays(){
  const today = new Date();
  today.setHours(0,0,0,0);
  const days = [];
  for (let i = 0; i < state.config.daysToShow; i++){
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}
function generateDaySlots(){
  const CONFIG = state.config;
  const slots = [];
  let totalMinutes = CONFIG.openHour * 60;
  const endMinutes = CONFIG.closeHour * 60;
  while (totalMinutes < endMinutes){
    const h24 = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    slots.push(`${h12}:${String(m).padStart(2,'0')} ${ampm}`);
    totalMinutes += CONFIG.slotMinutes;
  }
  return slots;
}

async function renderDays(){
  const days = buildUpcomingDays();
  days.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'day' + (i === 0 ? ' active' : '');
    const today = new Date();
    el.innerHTML = `<span class="dow">${DOW[d.getDay()]}</span><span class="num">${d.getDate()}</span>${isSameDay(d, today) ? '<span class="tag">HOY</span>' : ''}`;
    el.addEventListener('click', async () => {
      document.querySelectorAll('.day').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      state.day = d;
      monthYearLabel.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      await renderSlots(d);
    });
    dayRow.appendChild(el);
  });
  state.day = days[0];
  monthYearLabel.textContent = `${MONTHS[state.day.getMonth()]} ${state.day.getFullYear()}`;
  await renderSlots(state.day);
}

async function renderSlots(day){
  const key = dateKey(day);



  
  const res = await fetch(`/api/availability/${key}`).then(r => r.json());
  state.bookedSlots = res.bookedSlots;

  const ALL_SLOTS = generateDaySlots();
  const today = new Date();
  const isToday = isSameDay(day, today);
  const available = ALL_SLOTS.filter(s => !isToday || slotToMinutes(s) > (today.getHours()*60 + today.getMinutes()));

  slotGrid.innerHTML = '';
  if (available.length === 0){
    emptyNote.style.display = 'block';
    slotGrid.style.display = 'none';
  } else {
    emptyNote.style.display = 'none';
    slotGrid.style.display = 'grid';
    available.forEach(s => {
      const el = document.createElement('div');
      const isTaken = state.bookedSlots.includes(s);
      el.className = 'slot' + (isTaken ? ' disabled' : '');
      el.textContent = isTaken ? `${s} · Ocupado` : s;
      if (!isTaken){
        el.addEventListener('click', () => {
          document.querySelectorAll('.slot').forEach(x => x.classList.remove('active'));
          el.classList.add('active');
          state.slot = s;
          document.getElementById('btn-to-step3').disabled = false;
        });
      }
      slotGrid.appendChild(el);
    });
  }
  state.slot = null;
  document.getElementById('btn-to-step3').disabled = true;
}


async function loadExchangeRate(){
  const res = await fetch('/api/exchange-rate').then(r => r.json());
  state.rate = res.rate;
  if (document.getElementById('step-3').classList.contains('active')) renderSummary();
}


const payWrap = document.getElementById('pay-methods');
const payInfoBox = document.getElementById('pay-info');
const PAY_LABELS = { banco:"Banco", cuenta:"Cuenta", titular:"Titular", rif:"RIF", telefono:"Teléfono", cedula:"Cédula" };

function renderPayMethods(){
  state.config.paymentMethods.forEach(m => {
    const el = document.createElement('div');
    el.className = 'pay-method';
    el.textContent = m;
    el.addEventListener('click', () => {
      document.querySelectorAll('.pay-method').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      state.payment = m;
      renderPayInfo();
      checkConfirmReady();
    });
    payWrap.appendChild(el);
  });
}
function renderPayInfo(){
  const info = state.config.paymentInfo[state.payment];
  if (!info){ payInfoBox.innerHTML = ''; payInfoBox.style.display = 'none'; return; }
  payInfoBox.style.display = 'block';
  payInfoBox.innerHTML = Object.entries(info)
    .map(([k, v]) => `<div class="pay-info-row"><span>${PAY_LABELS[k] || k}</span><span>${v}</span></div>`)
    .join('');
}

function renderSummary(){
  const svc = state.service;
  if (!svc) { document.getElementById('summary').innerHTML = ''; return; }
  const extraRows = state.config.extras
    .filter(ex => state.extras[ex.id] > 0)
    .map(ex => `
      <div class="summary-row muted">
        <span>${ex.name} ${state.extras[ex.id] > 1 ? '×' + state.extras[ex.id] : ''}</span>
        <span>${fmt(ex.price * state.extras[ex.id])}</span>
      </div>`).join('');

  const total = calcGrandTotal();
  const dayLabel = state.day ? `${DOW[state.day.getDay()]} ${state.day.getDate()} de ${MONTHS[state.day.getMonth()]}` : '--';

  document.getElementById('summary').innerHTML = `
    <div class="summary-row"><span>${svc.name}</span><span>${fmt(svc.price)}</span></div>
    ${extraRows}
    <div class="summary-row muted"><span>Fecha</span><span>${dayLabel} · ${state.slot || '--'}</span></div>
    <div class="summary-row total"><span>Total a cobrar</span><span>${fmt(total)}</span></div>
    <div class="summary-row muted"><span>Equivalente en bolívares</span><span>${fmtBs(total)}</span></div>
    <div class="rate-note">Tasa del día: 1 ${state.config.currency}1.00 ≈ ${fmtBs(1)}</div>
  `;
}

function checkConfirmReady(){
  const name = document.getElementById('f-name').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  document.getElementById('btn-confirm').disabled = !(name && phone && state.payment);
}
document.getElementById('f-name').addEventListener('input', checkConfirmReady);
document.getElementById('f-phone').addEventListener('input', checkConfirmReady);



function goTo(step){
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + step).classList.add('active');
  if (step === '3') renderSummary();
}
document.getElementById('btn-to-extras').addEventListener('click', () => goTo('extras'));
document.getElementById('btn-to-step2').addEventListener('click', () => goTo('2'));
document.getElementById('btn-to-step3').addEventListener('click', () => goTo('3'));
document.querySelectorAll('[data-back]').forEach(b => {
  b.addEventListener('click', () => goTo(b.dataset.back));
});



document.getElementById('btn-confirm').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm');
  btn.disabled = true;
  btn.textContent = 'Reservando...';

  const payload = {
    serviceId: state.service.id,
    extraQty: state.extras,
    date: dateKey(state.day),
    slot: state.slot,
    name: document.getElementById('f-name').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    note: document.getElementById('f-note').value.trim(),
    paymentMethod: state.payment,
  };

  try{
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok){


      alert(data.error || 'No se pudo completar la reserva.');
      await renderSlots(state.day);
      btn.disabled = false;
      btn.textContent = 'Confirmar reserva';
      return;
    }

    window.open(data.whatsappUrl, '_blank');

    const dayLabel = `${DOW[state.day.getDay()]} ${state.day.getDate()} de ${MONTHS[state.day.getMonth()]}`;
    document.getElementById('confirm-detail').textContent =
      `${state.service.name} el ${dayLabel} a las ${state.slot}. Total: ${fmt(data.booking.total)} (${fmtBs(data.booking.total)}). Te contactaremos por WhatsApp para confirmar.`;
    goTo('4');
  } catch (err){
    alert('No se pudo conectar con el servidor. Intenta de nuevo.');
  } finally {
    btn.textContent = 'Confirmar reserva';
  }
});

document.getElementById('btn-restart').addEventListener('click', async () => {
  state.service = null; state.slot = null; state.payment = null;
  state.config.extras.forEach(ex => state.extras[ex.id] = 0);
  document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.extra-row').forEach(c => {
    c.classList.remove('selected');
    c.querySelector('.qty-val').textContent = '1';
  });
  document.querySelectorAll('.pay-method').forEach(c => c.classList.remove('active'));
  payInfoBox.innerHTML = ''; payInfoBox.style.display = 'none';
  document.getElementById('f-name').value = '';
  document.getElementById('f-phone').value = '';
  document.getElementById('f-note').value = '';
  document.getElementById('btn-to-extras').disabled = true;
  document.getElementById('btn-confirm').disabled = true;
  updateQuote();
  await renderSlots(state.day);
  goTo('1');
});

init();
