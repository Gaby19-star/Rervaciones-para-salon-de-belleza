const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const RATE_CACHE_FILE = path.join(DATA_DIR, 'rate-cache.json');

function ensureFile(file, defaultContent){
  if (!fs.existsSync(file)){
    fs.writeFileSync(file, JSON.stringify(defaultContent, null, 2));
  }
}
ensureFile(BOOKINGS_FILE, []);
ensureFile(RATE_CACHE_FILE, {});

function readJson(file){
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}
function writeJson(file, data){
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}



function getAllBookings(){
  return readJson(BOOKINGS_FILE);
}
function getBookedSlots(date){
  return getAllBookings()
    .filter(b => b.date === date)
    .map(b => b.slot);
}
function isSlotTaken(date, slot){
  return getBookedSlots(date).includes(slot);
}
function addBooking(booking){
  const bookings = getAllBookings();
  const record = { id: Date.now().toString(36), createdAt: new Date().toISOString(), ...booking };
  bookings.push(record);
  writeJson(BOOKINGS_FILE, bookings);
  return record;
}



function getCachedRate(dateKey){
  const cache = readJson(RATE_CACHE_FILE);
  return cache[dateKey] || null;
}
function setCachedRate(dateKey, rate){
  const cache = readJson(RATE_CACHE_FILE);
  cache[dateKey] = rate;
  writeJson(RATE_CACHE_FILE, cache);
}

module.exports = { getAllBookings, getBookedSlots, isSlotTaken, addBooking, getCachedRate, setCachedRate };
