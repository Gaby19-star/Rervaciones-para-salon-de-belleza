
const CONFIG = {
  name: "Studio belleza",
  category: "Salón de belleza",
  emoji: "💇‍♀️",
  phone: "584120000000",  
  currency: "$",

  
  services: [
    { id: "s1", name: "Corte de cabello",     duration: "45 min", price: 12 },
    { id: "s2", name: "Manicure clásica",     duration: "40 min", price: 8  },
    { id: "s3", name: "Tratamiento capilar",  duration: "60 min", price: 18 },
    { id: "s4", name: "Maquillaje social",    duration: "50 min", price: 20 },
  ],


  extras: [
    { id: "e1", name: "Diseño 3D",           price: 1.00, maxQty: 1 },
    { id: "e2", name: "Efecto espejo",       price: 0.25, maxQty: 5 },
    { id: "e3", name: "Efecto aurora",       price: 0.25, maxQty: 5 },
    { id: "e4", name: "Encapsulado",         price: 0.50, maxQty: 3 },
    { id: "e5", name: "Nail art (full set)", price: 6.00, maxQty: 1 },
  ],


  daysToShow: 14,     
  openHour: 9,       
  closeHour: 19,       
  slotMinutes: 30,     


  exchangeRate: {
    apiUrl: "https://ve.dolarapi.com/v1/dolares/oficial",
  },

  paymentMethods: ["Efectivo", "Transferencia", "Pago móvil"],
  paymentInfo: {
    "Transferencia": { banco: "Banco de Venezuela", cuenta: "0102-0000-0000-0000000000", titular: "Studio belleza, C.A.", rif: "J-000000000" },
    "Pago móvil":    { banco: "Banco de Venezuela", telefono: "0412-0000000", cedula: "V-00000000" },
    "Efectivo": null,
  },
};


const state = {
  service: null,
  extras: {},
  day: null,        
  slot: null,        
  payment: null,
  rate: null,        
};


const bookedSlots = {};

const DOW = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function dateKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isSameDay(a,b){ return dateKey(a) === dateKey(b); }
function fmt(n){ return CONFIG.currency + n.toFixed(2); }
function fmtBs(n){
  const bs = n * (state.rate || CONFIG.exchangeRate.fallbackRate);
  return bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Bs.';
}


document.getElementById('cfg-emoji').textContent = CONFIG.emoji;
document.getElementById('cfg-category').textContent = CONFIG.category.toUpperCase();
document.getElementById('cfg-name').textContent = CONFIG.name;
document.getElementById('cfg-name-2').textContent = CONFIG.name;
document.getElementById('cfg-phone').textContent = CONFIG.phone;


function calcExtrasTotal(){
  return CONFIG.extras.reduce((sum, ex) => {
    const qty = state.extras[ex.id] || 0;
    return sum + qty * ex.price;
  }, 0);
}
function calcGrandTotal(){
  const base = state.service ? state.service.price : 0;
  return base + calcExtrasTotal();
}


const serviceList = document.getElementById('service-list');
CONFIG.services.forEach(svc => {
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
  serviceList.appendChild(el);
});


const extraList = document.getElementById('extra-list');
CONFIG.extras.forEach(ex => {
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

  extraList.appendChild(el);
});

function updateQuote(){
  document.getElementById('quote-amount').textContent = fmt(calcGrandTotal());
}
updateQuote();
const dayRow = document.getElementById('day-row');
const slotGrid = document.getElementById('slot-grid');
const emptyNote = document.getElementById('empty-note');
const monthYearLabel = document.getElementById('month-year');

function buildUpcomingDays(){
  const today = new Date();
  today.setHours(0,0,0,0);
  const days = [];
  for (let i = 0; i < CONFIG.daysToShow; i++){
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function generateDaySlots(){
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
const ALL_SLOTS = generateDaySlots();

function renderSlots(day){
  slotGrid.innerHTML = '';
  const key = dateKey(day);
  const taken = bookedSlots[key] || new Set();
  const today = new Date();
  const isToday = isSameDay(day, today);

  const available = ALL_SLOTS.filter(s => {
    if (!isToday) return true;
    return slotToMinutes(s) > (today.getHours()*60 + today.getMinutes());
  });

  if (available.length === 0){
    emptyNote.style.display = 'block';
    slotGrid.style.display = 'none';
  } else {
    emptyNote.style.display = 'none';
    slotGrid.style.display = 'grid';
    available.forEach(s => {
      const el = document.createElement('div');
      const isTaken = taken.has(s);
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

function slotToMinutes(s){
  const [time, ampm] = s.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h*60 + m;
}

const upcomingDays = buildUpcomingDays();
upcomingDays.forEach((d, i) => {
  const el = document.createElement('div');
  el.className = 'day' + (i === 0 ? ' active' : '');
  const today = new Date();
  el.innerHTML = `<span class="dow">${DOW[d.getDay()]}</span><span class="num">${d.getDate()}</span>${isSameDay(d, today) ? '<span class="tag">HOY</span>' : ''}`;
  el.addEventListener('click', () => {
    document.querySelectorAll('.day').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    state.day = d;
    monthYearLabel.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    renderSlots(d);
  });
  dayRow.appendChild(el);
});
state.day = upcomingDays[0];
monthYearLabel.textContent = `${MONTHS[state.day.getMonth()]} ${state.day.getFullYear()}`;
renderSlots(state.day);



async function loadExchangeRate(){
  try{
    const res = await fetch(CONFIG.exchangeRate.apiUrl);
    const data = await res.json();
    state.rate = data.promedio || data.venta || data.compra || CONFIG.exchangeRate.fallbackRate;
  } catch (err){
    state.rate = CONFIG.exchangeRate.fallbackRate;
  }
  renderRateNote();
  if (document.getElementById('step-3').classList.contains('active')) renderSummary();
}
function renderRateNote(){
  const note = document.getElementById('rate-note');
  if (!note) return;
  note.textContent = `Tasa del día: 1 ${CONFIG.currency}1.00 ≈ ${fmtBs(1)}`;
}
loadExchangeRate();


const payWrap = document.getElementById('pay-methods');
const payInfoBox = document.getElementById('pay-info');
const PAY_LABELS = { banco:"Banco", cuenta:"Cuenta", titular:"Titular", rif:"RIF", telefono:"Teléfono", cedula:"Cédula" };

CONFIG.paymentMethods.forEach(m => {
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

function renderPayInfo(){
  const info = CONFIG.paymentInfo[state.payment];
  if (!info){ payInfoBox.innerHTML = ''; payInfoBox.style.display = 'none'; return; }
  payInfoBox.style.display = 'block';
  payInfoBox.innerHTML = Object.entries(info)
    .map(([k, v]) => `<div class="pay-info-row"><span>${PAY_LABELS[k] || k}</span><span>${v}</span></div>`)
    .join('');
}

function renderSummary(){
  const svc = state.service;
  if (!svc) { document.getElementById('summary').innerHTML = ''; return; }

  const extraRows = CONFIG.extras
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
    <div class="rate-note" id="rate-note"></div>
  `;
  renderRateNote();
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

document.getElementById('btn-confirm').addEventListener('click', () => {
  const name = document.getElementById('f-name').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  const note = document.getElementById('f-note').value.trim();
  const total = calcGrandTotal();
  const dayLabel = `${DOW[state.day.getDay()]} ${state.day.getDate()} de ${MONTHS[state.day.getMonth()]}`;

 
  const key = dateKey(state.day);
  if (!bookedSlots[key]) bookedSlots[key] = new Set();
  bookedSlots[key].add(state.slot);

  const extrasText = CONFIG.extras
    .filter(ex => state.extras[ex.id] > 0)
    .map(ex => `${ex.name}${state.extras[ex.id] > 1 ? ' x' + state.extras[ex.id] : ''}`)
    .join(', ');

  const message =
    `Hola! *Nueva reserva* de ${name}.\n` +
    `Servicio: ${state.service.name}${extrasText ? ' + ' + extrasText : ''}\n` +
    `Fecha: ${dayLabel} a las ${state.slot}\n` +
    `Total: ${fmt(total)} (${fmtBs(total)})\n` +
    `Pago: ${state.payment}\n` +
    `Teléfono del cliente: ${phone}` +
    (note ? `\nNota: ${note}` : '');

  const whatsappUrl = `https://wa.me/${CONFIG.phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');

  document.getElementById('confirm-detail').textContent =
    `${state.service.name} el ${dayLabel} a las ${state.slot}. Total: ${fmt(total)} (${fmtBs(total)}). Te contactaremos por WhatsApp para confirmar.`;
  goTo('4');
});

document.getElementById('btn-restart').addEventListener('click', () => {
  state.service = null; state.slot = null; state.payment = null;
  CONFIG.extras.forEach(ex => state.extras[ex.id] = 0);
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
  renderSlots(state.day);
  goTo('1');
});