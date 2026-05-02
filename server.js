const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'amtc2026';

const archivoCertificados = path.join(__dirname, 'certificados.json');

function cargarCertificados() {
  if (!fs.existsSync(archivoCertificados)) {
    fs.writeFileSync(archivoCertificados, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(archivoCertificados, 'utf8'));
}

function guardarCertificados(certificados) {
  fs.writeFileSync(archivoCertificados, JSON.stringify(certificados, null, 2));
}

function auth(req, res, next) {
  const { user, pass } = req.query;

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return next();
  }

  res.send(`
    <div style="font-family:Arial;max-width:600px;margin:80px auto;text-align:center;">
      <h1>AMTC SpA</h1>
      <h2>Acceso restringido</h2>
      <p>Debe ingresar con usuario y contraseña autorizados.</p>
      <p>Ejemplo:</p>
      <code>/admin?user=admin&pass=CLAVE</code>
    </div>
  `);
}

function layout(contenido) {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>AMTC - Verificación Técnica</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f3f4f6;
        color: #222;
      }
      .container {
        max-width: 900px;
        margin: 40px auto;
        background: white;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.08);
      }
      .header {
        text-align: center;
        border-bottom: 4px solid #d71920;
        padding-bottom: 25px;
        margin-bottom: 30px;
      }
      .header img {
        max-width: 420px;
        margin-bottom: 20px;
      }
      h1, h2 {
        margin: 10px 0;
      }
      .status-ok {
        color: #008000;
        font-size: 28px;
        font-weight: bold;
      }
      .status-error {
        color: #c00000;
        font-size: 28px;
        font-weight: bold;
      }
      .box {
        border: 1px solid #ccc;
        padding: 20px;
        margin-top: 20px;
        border-radius: 6px;
        background: #fafafa;
      }
      .row {
        margin: 12px 0;
        font-size: 18px;
      }
      .label {
        font-weight: bold;
      }
      input {
        width: 70%;
        padding: 14px;
        font-size: 16px;
        border: 1px solid #aaa;
        border-radius: 4px;
      }
      button, .btn {
        padding: 14px 22px;
        background: #d71920;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 16px;
        cursor: pointer;
        text-decoration: none;
        display: inline-block;
      }
      .footer {
        margin-top: 35px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        font-size: 13px;
        color: #555;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="container">
      ${contenido}
    </div>
  </body>
  </html>
  `;
}

app.get('/', (req, res) => {
  res.send(layout(`
    <div class="header">
      <img src="/public/logo.png">
      <h1>Sistema de Verificación de Certificados Técnicos</h1>
      <p>Certificación técnica y validación documental</p>
    </div>

    <h2>Validar certificado</h2>
    <p>Ingrese el código único del certificado para validar su autenticidad.</p>

    <input id="codigo" placeholder="Ej: AMTC-2026-0001">
    <button onclick="verificar()">Verificar</button>

    <script>
      function verificar() {
        const codigo = document.getElementById('codigo').value.trim();
        if (codigo) window.location.href = '/verifica/' + codigo;
      }
    </script>

    <div class="footer">
      AMTC SpA - Sistema de Verificación de Certificados Técnicos
    </div>
  `));
});

app.get('/admin', auth, (req, res) => {
  res.send(layout(`
    <div class="header">
      <img src="/public/logo.png">
      <h1>Panel Administrador</h1>
      <p>Creación de certificados técnicos</p>
    </div>

    <input id="proyecto" placeholder="Proyecto"><br><br>
    <input id="empresa" placeholder="Empresa"><br><br>
    <input id="clasificacion" placeholder="Clasificación F60"><br><br>
    <input id="ubicacion" placeholder="Ubicación"><br><br>

    <button onclick="crear()">Crear Certificado</button>

    <div id="resultado" class="box"></div>

    <script>
      function crear() {
        fetch('/api/certificados', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proyecto: proyecto.value,
            empresa: empresa.value,
            clasificacion: clasificacion.value,
            ubicacion: ubicacion.value
          })
        })
        .then(r => r.json())
        .then(d => {
          resultado.innerHTML =
            '<h3>Certificado creado correctamente</h3>' +
            '<p><b>Código:</b> ' + d.codigo + '</p>' +
            '<p><a class="btn" target="_blank" href="/verifica/' + d.codigo + '">Abrir verificación</a></p>' +
            '<p><a class="btn" target="_blank" href="/pdf/' + d.codigo + '">Descargar PDF profesional</a></p>';
        });
      }
    </script>
  `));
});

app.post('/api/certificados', (req, res) => {
  const certificados = cargarCertificados();

  const correlativo = String(certificados.length + 1).padStart(4, '0');
  const codigo = `AMTC-2026-${correlativo}`;

  const nuevo = {
    codigo,
    proyecto: req.body.proyecto || 'Sin proyecto',
    empresa: req.body.empresa || 'Sin empresa',
    clasificacion: req.body.clasificacion || 'F60',
    ubicacion: req.body.ubicacion || 'No indicada',
    estado: 'Vigente',
    fecha: new Date().toLocaleDateString('es-CL')
  };

  certificados.push(nuevo);
  guardarCertificados(certificados);

  res.json({
    codigo,
    url: `/verifica/${codigo}`,
    pdf: `/pdf/${codigo}`
  });
});

app.get('/api/verifica/:codigo', (req, res) => {
  const certificados = cargarCertificados();
  const cert = certificados.find(c => c.codigo === req.params.codigo);

  if (!cert) return res.json({ estado: 'invalido' });

  res.json(cert);
});

app.get('/verifica/:codigo', (req, res) => {
  const certificados = cargarCertificados();
  const cert = certificados.find(c => c.codigo === req.params.codigo);

  if (!cert) {
    return res.send(`
      <h2 style="color:red; text-align:center;">❌ Certificado no válido</h2>
    `);
  }

  res.send(`
    <html>
    <head>
      <title>Verificación de Certificado</title>
      <style>
        body {
          font-family: Arial;
          text-align: center;
          padding: 50px;
          background: #f4f4f4;
        }
        .card {
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          display: inline-block;
        }
        h1 { color: green; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>✔ Certificado Válido</h1>
        <p><b>Código:</b> ${cert.codigo}</p>
        <p><b>Proyecto:</b> ${cert.proyecto}</p>
        <p><b>Empresa:</b> ${cert.empresa}</p>
        <p><b>Clasificación:</b> ${cert.clasificacion}</p>
        <p><b>Estado:</b> Vigente</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/pdf/:codigo', async (req, res) => {
  const certificados = cargarCertificados();
  const cert = certificados.find(c => c.codigo === req.params.codigo);

  if (!cert) return res.status(404).send('Certificado no encontrado');

  const url = `https://amtcidiem.cl/verifica/${cert.codigo}`;
  const qr = await QRCode.toDataURL(url);

  res.setHeader('Content-Type', 'application/pdf');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  const logo = path.join(__dirname, 'public', 'logo.png');

  // ===== PORTADA =====
  if (fs.existsSync(logo)) {
    doc.image(logo, 50, 40, { width: 220 });
  }

  doc.moveDown(5);

  doc.fontSize(18).text('INFORME DE INSPECCIÓN', { align: 'right' });
  doc.fontSize(14).text('PINTURA INTUMESCENTE', { align: 'right' });

  doc.moveDown();

  doc.fillColor('red').text(`Informe N° ${cert.codigo}`, { align: 'right' });
  doc.fillColor('black').text(`Fecha: 24/04/2026`, { align: 'right' });

  doc.moveDown(2);

  doc.fontSize(13).text(`Obra: ${cert.proyecto}`);
  doc.text(`Empresa: ${cert.empresa}`);
  doc.text(`Ubicación: ${cert.ubicacion}`);

  doc.moveDown(3);

  doc.fontSize(10).text('División Tecnología de la Construcción');
  doc.text('Unidad de Inspección Técnica');

  doc.addPage();

  // ===== ALCANCE =====
  doc.fontSize(14).text('1. ALCANCE', { underline: true });

  doc.moveDown();
  doc.fontSize(11).text(
    `El presente informe técnico tiene como objetivo verificar las características del sistema de pintura intumescente aplicado en la obra "${cert.proyecto}".`
  );

  doc.moveDown();

  doc.text('Los objetivos de inspección son:');
  doc.text('1. Verificar características intumescentes.');
  doc.text('2. Detectar contaminación.');
  doc.text('3. Medir espesores aplicados.');

  // ===== METODOLOGÍA =====
  doc.addPage();

  doc.fontSize(14).text('2. METODOLOGÍA', { underline: true });

  doc.moveDown();
  doc.fontSize(11).text('Se realizaron las siguientes actividades:');
  doc.text('- Inspección visual.');
  doc.text('- Ensayo de intumescencia.');
  doc.text('- Ensayo químico.');
  doc.text('- Medición de espesores.');

  // ===== INSPECCIÓN =====
  doc.addPage();

  doc.fontSize(14).text('3. INSPECCIÓN', { underline: true });

  doc.moveDown();
  doc.fontSize(11).text(
    'La inspección fue realizada el día 24 de abril de 2026.'
  );

  doc.text(
    'Se verificó el correcto estado del sistema de pintura intumescente aplicado sobre estructura metálica.'
  );

  // ===== RESULTADOS =====
  doc.addPage();

  doc.fontSize(14).text('4. RESULTADOS', { underline: true });

  doc.moveDown();
  doc.fontSize(11).text('Prueba de intumescencia: Cumple.');
  doc.text('Ensayo químico: Sin contaminación.');
  doc.text('Espesores: Dentro de rango aceptable.');

  // ===== CONCLUSIÓN =====
  doc.addPage();

  doc.fontSize(14).text('5. CONCLUSIONES', { underline: true });

  doc.moveDown();
  doc.fontSize(11).text(
    'El sistema de pintura intumescente cumple con los requisitos técnicos establecidos.'
  );

  doc.text(
    `Clasificación de resistencia al fuego verificada: ${cert.clasificacion}`
  );

  doc.moveDown(3);

  doc.text('____________________________');
  doc.text('Inspector Técnico');
  doc.text('AMTC SpA');

  // ===== QR =====
  doc.addPage();

  doc.fontSize(16).text('VERIFICACIÓN DIGITAL', { align: 'center' });

  doc.moveDown(2);

  doc.fontSize(12).text(url, { align: 'center' });

  const qrData = qr.replace(/^data:image\/png;base64,/, '');
  const qrBuffer = Buffer.from(qrData, 'base64');

  doc.image(qrBuffer, 200, 250, { width: 180 });

  doc.moveDown(12);

  doc.text(`Código: ${cert.codigo}`, { align: 'center' });

  doc.end();
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('AMTC funcionando en puerto ' + PORT);
});
