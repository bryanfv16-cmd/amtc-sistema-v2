require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const QRCode = require('qrcode');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || 'https://amtcidiem.cl').replace(/\/$/, '');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Cambiar1234';
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-este-secreto-en-railway';

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/public', express.static('public'));

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. En Railway agrega PostgreSQL y enlaza las variables.');
}
async function initDb() {}

function requireAuth(req, res, next) {
  const token = req.cookies.amtc_token;
  if (!token) return res.redirect('/admin/login');
  try { jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.redirect('/admin/login'); }
}

function safe(value) {
  return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function generarCodigo(clasificacion, proyecto) {
  const cls = (clasificacion || 'CERT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'CERT';
  const base = (proyecto || 'AMTC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'AMTC';
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${cls}-AMTC-${base}${random}`;
}

function layout(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
  body{margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937}.wrap{max-width:980px;margin:38px auto;padding:0 18px}.card{background:white;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.08);padding:30px;border-top:6px solid #b91c1c}.brand{display:flex;align-items:center;gap:14px;margin-bottom:20px}.logo{width:64px;height:64px;border-radius:10px;object-fit:contain;background:#fff}.brand h1{margin:0;font-size:28px}.muted{color:#6b7280}.status{padding:16px;border-radius:10px;font-weight:700;text-align:center;margin:20px 0}.ok{background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}.bad{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #e5e7eb;padding:12px;text-align:left}th{background:#f9fafb;width:230px}.btn{display:inline-block;background:#b91c1c;color:white;text-decoration:none;border:0;border-radius:8px;padding:12px 18px;font-weight:700;cursor:pointer;margin:6px 6px 6px 0}.btn2{background:#374151}.grid{display:grid;grid-template-columns:1fr 180px;gap:24px;align-items:start}.qr{text-align:center}.qr img{width:160px;height:160px}.footer{margin-top:26px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:18px}.form input,.form select{width:100%;padding:12px;margin:8px 0 14px;border:1px solid #d1d5db;border-radius:8px;font-size:16px}.form label{font-weight:700}.topbar{text-align:right;margin-bottom:10px}@media(max-width:700px){.grid{grid-template-columns:1fr}.qr{text-align:left}}
  </style></head><body><div class="wrap"><div class="card">${body}</div></div></body></html>`;
}

app.get('/', (req, res) => res.redirect('/admin'));

app.get('/admin/login', (req, res) => {
  res.send(layout('Ingreso AMTC', `<div class="brand"><div><h1>AMTC</h1><div class="muted">Sistema privado de certificados técnicos</div></div></div><form class="form" method="post" action="/admin/login"><label>Usuario</label><input name="user" required placeholder="admin"><label>Contraseña</label><input name="pass" type="password" required><button class="btn" type="submit">Ingresar</button></form>`));
});

app.post('/admin/login', (req, res) => {
  const { user, pass } = req.body;
  if (user !== ADMIN_USER || pass !== ADMIN_PASSWORD) return res.status(401).send(layout('Error', `<div class="status bad">Usuario o contraseña incorrectos</div><a class="btn" href="/admin/login">Volver</a>`));
  const token = jwt.sign({ user }, JWT_SECRET, { expiresIn: '10h' });
  res.cookie('amtc_token', token, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 10 * 60 * 60 * 1000 });
  res.redirect('/admin');
});

app.get('/admin/logout', (req, res) => { res.clearCookie('amtc_token'); res.redirect('/admin/login'); });

app.get('/admin', requireAuth, async (req, res) => {
  const rows = (await pool.query('SELECT codigo, proyecto, empresa, clasificacion, estado, fecha_emision FROM certificados ORDER BY created_at DESC LIMIT 50')).rows;
  const lista = rows.map(r => `<tr><td>${safe(r.codigo)}</td><td>${safe(r.proyecto)}</td><td>${safe(r.empresa)}</td><td>${safe(r.clasificacion)}</td><td>${safe(r.estado)}</td><td><a href="/verifica/${safe(r.codigo)}" target="_blank">Verificar</a></td></tr>`).join('');
  res.send(layout('Panel AMTC', `<div class="topbar"><a href="/admin/logout">Salir</a></div><div class="brand"><div><h1>AMTC</h1><div class="muted">Panel de emisión y validación documental</div></div></div><h2>Crear nuevo certificado</h2><form class="form" method="post" action="/admin/certificados" enctype="multipart/form-data"><label>Proyecto</label><input name="proyecto" required placeholder="Construcción Galpón CyD"><label>Ubicación</label><input name="ubicacion" placeholder="Av. / comuna / región"><label>Empresa / destinatario</label><input name="empresa" required placeholder="CyD Inmobiliaria SpA"><label>Clasificación</label><input name="clasificacion" required value="F60"><label>Tipo de certificación</label><input name="tipo" value="Certificación y validación intumescente"><label>Espesor / observación técnica</label><input name="espesor" placeholder="Ej: Según informe adjunto"><label>Subir PDF original</label><input name="pdf" type="file" accept="application/pdf" required><button class="btn" type="submit">Crear certificado + QR</button></form><h2>Últimos certificados</h2><table><tr><th>Código</th><th>Proyecto</th><th>Empresa</th><th>Clasificación</th><th>Estado</th><th>Link</th></tr>${lista || '<tr><td colspan="6">Sin certificados aún.</td></tr>'}</table>`));
});

app.post('/admin/certificados', requireAuth, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).send('Debe subir un PDF.');
  const { proyecto, ubicacion, empresa, clasificacion, tipo, espesor } = req.body;
  const codigo = generarCodigo(clasificacion, proyecto);
  await pool.query(`INSERT INTO certificados(codigo, proyecto, ubicacion, empresa, clasificacion, tipo, espesor, pdf_nombre, pdf_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [codigo, proyecto, ubicacion || '', empresa, clasificacion, tipo || '', espesor || '', req.file.originalname, req.file.buffer]);
  res.redirect(`/admin/creado/${codigo}`);
});

app.get('/admin/creado/:codigo', requireAuth, async (req, res) => {
  const codigo = req.params.codigo;
  const url = `${PUBLIC_URL}/verifica/${codigo}`;
  const qr = await QRCode.toDataURL(url);
  res.send(layout('Certificado creado', `<div class="status ok">Certificado creado correctamente</div><table><tr><th>Código</th><td>${safe(codigo)}</td></tr><tr><th>Link público</th><td><a href="/verifica/${safe(codigo)}" target="_blank">${safe(url)}</a></td></tr></table><p><b>QR listo para descargar:</b></p><p><img src="${qr}" width="180"></p><a class="btn" href="${qr}" download="QR-${safe(codigo)}.png">Descargar QR</a><a class="btn btn2" href="/admin">Crear otro</a>`));
});

app.get('/verifica/:codigo', async (req, res) => {
  const result = await pool.query('SELECT codigo, proyecto, ubicacion, empresa, clasificacion, tipo, espesor, estado, fecha_emision FROM certificados WHERE codigo=$1', [req.params.codigo]);
  if (!result.rows.length) return res.status(404).send(layout('No válido', `<div class="brand"><div><h1>AMTC</h1><div class="muted">Sistema de Verificación de Certificados Técnicos</div></div></div><div class="status bad">❌ DOCUMENTO NO VÁLIDO O NO REGISTRADO</div><p>El código consultado no existe en el registro digital AMTC.</p>`));
  const c = result.rows[0];
  const url = `${PUBLIC_URL}/verifica/${c.codigo}`;
  const qr = await QRCode.toDataURL(url);
  res.send(layout(`Verificación ${c.codigo}`, `<div class="brand"><div><h1>AMTC SpA</h1><div class="muted">Sistema de Verificación de Certificados Técnicos</div></div></div><div class="status ok">✔ CERTIFICADO VÁLIDO Y VIGENTE</div><div class="grid"><div><table><tr><th>Código de verificación</th><td>${safe(c.codigo)}</td></tr><tr><th>Proyecto</th><td>${safe(c.proyecto)}</td></tr><tr><th>Ubicación</th><td>${safe(c.ubicacion)}</td></tr><tr><th>Empresa / destinatario</th><td>${safe(c.empresa)}</td></tr><tr><th>Clasificación</th><td>${safe(c.clasificacion)}</td></tr><tr><th>Tipo</th><td>${safe(c.tipo)}</td></tr><tr><th>Espesor / observación</th><td>${safe(c.espesor)}</td></tr><tr><th>Fecha emisión</th><td>${safe(c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString('es-CL') : '')}</td></tr><tr><th>Estado</th><td>${safe(c.estado)}</td></tr><tr><th>Fecha consulta</th><td>${new Date().toLocaleString('es-CL')}</td></tr></table><p><a class="btn" href="/pdf/${safe(c.codigo)}" target="_blank">Descargar informe PDF</a></p></div><div class="qr"><img src="${qr}"><div class="muted">Escanee para verificar autenticidad</div></div></div><div class="footer">Este documento ha sido registrado por AMTC SpA. Su autenticidad puede ser verificada mediante el código único en esta plataforma. Cualquier alteración o falsificación invalida su validez técnica.</div>`));
});

app.get('/pdf/:codigo', async (req, res) => {;
  if (!result.rows.length || !result.rows[0].pdf_data) return res.status(404).send('PDF no encontrado');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${result.rows[0].pdf_nombre || 'certificado.pdf'}"`);
  res.send(result.rows[0].pdf_data);
});

initDb().then(() => app.listen(PORT, () => console.log(`AMTC listo en puerto ${PORT}`))).catch(err => { console.error(err); process.exit(1); });
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let certificados = [];

// Crear certificado
app.post('/api/certificados', (req, res) => {

  const codigo = `F60-AMTC-${Math.random().toString(36).substring(2,8).toUpperCase()}`;

  const nuevo = {
    codigo,
    proyecto: req.body.proyecto,
    empresa: req.body.empresa,
    clasificacion: req.body.clasificacion,
    estado: "vigente"
  };

  certificados.push(nuevo);

  res.json({
    codigo,
    url: `https://amtcidiem.cl/verifica/${codigo}`
  });
});

// Verificar
app.get('/api/verifica/:codigo', (req, res) => {

  const cert = certificados.find(c => c.codigo === req.params.codigo);

  if(!cert){
    return res.json({ estado:"invalido" });
  }

  res.json(cert);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("AMTC funcionando en puerto " + PORT);
});
