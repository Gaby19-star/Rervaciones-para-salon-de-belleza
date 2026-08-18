  module.exports = {
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


  exchangeRateApiUrl: "https://ve.dolarapi.com/v1/dolares/oficial",


  paymentMethods: ["Efectivo", "Transferencia", "Pago móvil"],
  paymentInfo: {
    "Transferencia": { banco: "Banco de Venezuela", cuenta: "0102-0000-0000-0000000000", titular: "Studio Aurora, C.A.", rif: "J-000000000" },
    "Pago móvil":    { banco: "Banco de Venezuela", telefono: "0412-0000000", cedula: "V-00000000" },
    "Efectivo": null,
  },
};
