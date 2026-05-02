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
    return res.send(layout(`
      <div class="header">
        <img src="/public/logo.png">
        <h1>Verificación de Certificado</h1>
      </div>

      <div class="status-error">❌ Certificado no válido</div>
      <p>El código ingresado no existe en el sistema.</p>
      <p><b>Código consultado:</b> ${req.params.codigo}</p>
    `));
  }

  res.send(layout(`
    <div class="header">
      <img src="/public/logo.png">
      <h1>Verificación de Certificado Técnico</h1>
      <p>Sistema oficial de validación documental</p>
    </div>

    <div class="status-ok">✔ Certificado Válido</div>

    <div class="box">
      <div class="row"><span class="label">Código:</span> ${cert.codigo}</div>
      <div class="row"><span class="label">Proyecto:</span> ${cert.proyecto}</div>
      <div class="row"><span class="label">Empresa:</span> ${cert.empresa}</div>
      <div class="row"><span class="label">Ubicación:</span> ${cert.ubicacion}</div>
      <div class="row"><span class="label">Clasificación:</span> ${cert.clasificacion}</div>
      <div class="row"><span class="label">Estado:</span> ${cert.estado}</div>
      <div class="row"><span class="label">Fecha:</span> ${cert.fecha}</div>
    </div>

    <br>
    <a class="btn" href="/pdf/${cert.codigo}" target="_blank">Descargar PDF profesional</a>

    <div class="footer">
      Este certificado ha sido validado por AMTC SpA. Su autenticidad puede ser verificada mediante este código único.
    </div>
  `));
});

app.get('/pdf/:codigo', async (req, res) => {
  const certificados = cargarCertificados();
  const cert = certificados.find(c => c.codigo === req.params.codigo);

  if (!cert) return res.status(404).send('Certificado no encontrado');

  const url = `https://amtcidiem.cl/verifica/${cert.codigo}`;
  const qr = await QRCode.toDataURL(url);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${cert.codigo}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 45 });
  doc.pipe(res);

  const logoPath = path.join(__dirname, 'public', 'logo.png');

  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 45, 35, { width: 230 });
  }

  doc.moveDown(6);

  doc.fontSize(20).fillColor('black').text('INFORME TÉCNICO DE CERTIFICACIÓN', {
    align: 'right'
  });

  doc.fontSize(15).text('PINTURA INTUMESCENTE', {
    align: 'right'
  });

  doc.moveDown();

  doc.fontSize(11).fillColor('red').text(`Informe N° ${cert.codigo}`, {
    align: 'right'
  });

  doc.fillColor('black').text(`Fecha de emisión: ${cert.fecha}`, {
    align: 'right'
  });

  doc.moveDown(2);

  doc.moveTo(45, doc.y).lineTo(550, doc.y).strokeColor('red').stroke();
  doc.moveDown();

  doc.fontSize(14).fillColor('black').text('1. DATOS DEL CERTIFICADO', {
    underline: true
  });

  doc.moveDown();

  doc.fontSize(11);
  doc.text(`Código: ${cert.codigo}`);
  doc.text(`Proyecto: ${cert.proyecto}`);
  doc.text(`Empresa: ${cert.empresa}`);
  doc.text(`Ubicación: ${cert.ubicacion}`);
  doc.text(`Clasificación: ${cert.clasificacion}`);
  doc.text(`Estado: ${cert.estado}`);

  doc.moveDown(2);

  doc.fontSize(14).text('2. ALCANCE', { underline: true });
  doc.moveDown();

  doc.fontSize(11).text(
    'El presente documento corresponde a la validación técnica del sistema de pintura intumescente aplicado en el proyecto indicado, asociado a la protección pasiva contra incendios en elementos estructurales metálicos.'
  );

  doc.moveDown(2);

  doc.fontSize(14).text('3. RESUMEN TÉCNICO', { underline: true });
  doc.moveDown();

  doc.fontSize(11).text('Sistema evaluado: Pintura intumescente sobre estructura metálica.');
  doc.text(`Clasificación declarada: ${cert.clasificacion}.`);
  doc.text('Resultado: Certificado válido y vigente.');
  doc.text('Verificación: Disponible mediante código único y QR.');

  doc.moveDown(2);

  doc.fontSize(14).text('4. CONCLUSIÓN', { underline: true });
  doc.moveDown();

  doc.fontSize(11).text(
    'De acuerdo con los antecedentes técnicos disponibles y la información registrada en el sistema de verificación documental, el certificado se encuentra vigente y puede ser validado en línea mediante su código único.'
  );

  doc.moveDown(4);

  doc.text('____________________________');
  doc.text('Inspector Técnico AMTC SpA');

  doc.addPage();

  doc.fontSize(18).text('VERIFICACIÓN DE AUTENTICIDAD', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(12).text(
    'Este certificado puede ser verificado en línea mediante el siguiente enlace:',
    { align: 'center' }
  );

  doc.moveDown();

  doc.fillColor('red').fontSize(13).text(url, { align: 'center' });
  doc.fillColor('black');

  doc.moveDown(2);

  doc.fontSize(12).text('También puede escanear el siguiente código QR:', {
    align: 'center'
  });

  const qrData = qr.replace(/^data:image\/png;base64,/, '');
  const qrBuffer = Buffer.from(qrData, 'base64');

  doc.image(qrBuffer, 210, 300, { width: 180 });

  doc.moveDown(12);

  doc.fontSize(11).text(`Código de verificación: ${cert.codigo}`, {
    align: 'center'
  });

  doc.moveDown();

  doc.fontSize(10).text(
    'AMTC SpA - Sistema de Verificación de Certificados Técnicos',
    { align: 'center' }
  );

  doc.end();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('AMTC funcionando en puerto ' + PORT);
});
