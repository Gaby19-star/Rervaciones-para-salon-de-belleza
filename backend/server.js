const express = require('express');
const path = require('path');
const CONFIG = require('./config');
const store = require('./store');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;

app.get('/api/config', (req, res) => {
  const { exchangeRateApiUrl, fallbackRate, ...publicConfig } = CONFIG;
  res.json(publicConfig);
});


app.get('/api/availability/:date', (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)){
    return res.status(400).json({ error: 'Formato de fecha inválido, usa YYYY-MM-DD' });
  }
  res.json({ date, bookedSlots: store.getBookedSlots(date) });
});


app.get('/api/exchange-rate', async (req, res) => {
  const todayKey = new Date().toISOString().slice(0, 10);
  const cached = store.getCachedRate(todayKey);
  if (cached){
    return res.json({ rate: cached, date: todayKey, source: 'cache' });
  }
  try{
    const r = await fetch(CONFIG.exchangeRateApiUrl);
    const data = await r.json();
    const rate = data.promedio || data.venta || data.compra || CONFIG.fallbackRate;
    store.setCachedRate(todayKey, rate);
    res.json({ rate, date: todayKey, source: 'api' });
  } catch (err){
    res.json({ rate: CONFIG.fallbackRate, date: todayKey, source: 'fallback' });
  }
});


app.post('/api/bookings', async (req, res) => {
  const { serviceId, extraQty = {}, date, slot, name, phone, note, paymentMethod } = req.body;

  const service = CONFIG.services.find(s => s.id === serviceId);
  if (!service) return res.status(400).json({ error: 'Servicio inválido' });
  if (!date || !slot) return res.status(400).json({ error: 'Falta fecha u hora' });
  if (!name || !phone) return res.status(400).json({ error: 'Falta nombre o teléfono' });
  if (!CONFIG.paymentMethods.includes(paymentMethod)){
    return res.status(400).json({ error: 'Método de pago inválido' });
  }
  if (store.isSlotTaken(date, slot)){
    return res.status(409).json({ error: 'Esa hora ya fue reservada. Elige otra.' });
  }

  let total = service.price;
  const extrasApplied = [];
  for (const ex of CONFIG.extras){
    const qty = Math.max(0, Math.min(ex.maxQty, Number(extraQty[ex.id]) || 0));
    if (qty > 0){
      total += qty * ex.price;
      extrasApplied.push({ id: ex.id, name: ex.name, qty, price: ex.price });
    }
  }



  const todayKey = new Date().toISOString().slice(0, 10);
  let rate = store.getCachedRate(todayKey);
  if (!rate){
    try{
      const r = await fetch(CONFIG.exchangeRateApiUrl);
      const d = await r.json();
      rate = d.promedio || d.venta || d.compra || CONFIG.fallbackRate;
      store.setCachedRate(todayKey, rate);
    } catch { rate = CONFIG.fallbackRate; }
  }
  const totalBs = total * rate;

  const booking = store.addBooking({
    serviceId, serviceName: service.name, extras: extrasApplied,
    date, slot, name, phone, note: note || '', paymentMethod,
    total, totalBs, rate,
  });

  const message =
    `Hola! *Nueva reserva* de ${name}.\n` +
    `Servicio: ${service.name}${extrasApplied.length ? ' + ' + extrasApplied.map(e => e.name + (e.qty > 1 ? ' x' + e.qty : '')).join(', ') : ''}\n` +
    `Fecha: ${date} a las ${slot}\n` +
    `Total: ${CONFIG.currency}${total.toFixed(2)} (${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.)\n` +
    `Pago: ${paymentMethod}\n` +
    `Teléfono del cliente: ${phone}` +
    (note ? `\nNota: ${note}` : '');

  res.status(201).json({
    booking,
    whatsappUrl: `https://wa.me/${CONFIG.phone}?text=${encodeURIComponent(message)}`,
  });
});



app.get('/api/bookings', (req, res) => {
  res.json(store.getAllBookings());
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
