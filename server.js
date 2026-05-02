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

app.get('/', (req, res) => {
  res.send(`
    <div style="font-family:Arial;max-width:800px;margin:auto;padding:40px;text-align:center;">
      <img src="/public/logo.png" style="max-width:360px;margin-bottom:30px;">
      <h1>AMTC SpA</h1>
      <p>Sistema de Verificación de Certificados Técnicos</p>
      <hr>
      <h2>Verificar certificado</h2>
      <input id="codigo" placeholder="Ingrese código" style="padding:12px;width:70%;">
      <button onclick="verificar()" style="padding:12px;">Verificar</button>
      <script>
        function verificar(){
          const codigo = document.getElementById('codigo').value.trim();
          if(codigo) window.location.href = '/verifica/' + codigo;
        }
      </script>
      <br><br>
      <a href="/admin">Panel administrador</a>
    </div>
  `);
});

app.get('/admin', (req, res) => {
  res.send(`
    <div style="font-family:Arial;max-width:800px;margin:auto;padding:40px;">
      <img src="/public/logo.png" style="max-width:320px;margin-bottom:25px;">
      <h1>AMTC - Crear Certificado</h1>

      <input id="proyecto" placeholder="Proyecto" style="width:100%;padding:12px;margin-bottom:10px;">
      <input id="empresa" placeholder="Empresa" style="width:100%;padding:12px;margin-bottom:10px;">
      <input id="clasificacion" placeholder="Clasificación F60" style="width:100%;padding:12px;margin-bottom:10px;">
      <input id="ubicacion" placeholder="Ubicación" style="width:100%;padding:12px;margin-bottom:10px;">

      <button onclick="crear()" style="padding:12px 24px;">Crear Certificado</button>

      <div id="resultado" style="margin-top:25px;"></div>

      <script>
        function crear() {
          fetch('/api/certificados', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
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
              '<h3>Certificado creado</h3>' +
              '<p><b>Código:</b> ' + d.codigo + '</p>' +
              '<p><a target="_blank" href="/verifica/' + d.codigo + '">Abrir verificación</a></p>' +
              '<p><a target="_blank" href="/pdf/' + d.codigo + '">Descargar PDF profesional</a></p>';
          });
        }
      </script>
    </div>
  `);
});

app.post('/api/certificados', (req, res) => {
  const certificados = cargarCertificados();

  const codigo = `F60-AMTC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
      <div style="font-family:Arial;max-width:800px;margin:auto;padding:40px;text-align:center;">
        <img src="/public/logo.png" style="max-width:320px;margin-bottom:25px;">
        <h1>AMTC SpA</h1>
        <h2 style="color:red;">❌ Certificado no válido</h2>
        <p>El código ingresado no existe en el sistema.</p>
        <p><b>Código:</b> ${req.params.codigo}</p>
      </div>
    `);
  }

  res.send(`
    <div style="font-family:Arial;max-width:800px;margin:auto;padding:40px;">
      <div style="text-align:center;">
        <img src="/public/logo.png" style="max-width:360px;margin-bottom:20px;">
        <h1>AMTC SpA</h1>
        <p>Sistema de Verificación de Certificados Técnicos</p>
      </div>

      <hr>

      <h2 style="color:green;">✔ Certificado Válido</h2>

      <p><b>Código:</b> ${cert.codigo}</p>
      <p><b>Proyecto:</b> ${cert.proyecto}</p>
      <p><b>Empresa:</b> ${cert.empresa}</p>
      <p><b>Ubicación:</b> ${cert.ubicacion}</p>
      <p><b>Clasificación:</b> ${cert.clasificacion}</p>
      <p><b>Estado:</b> ${cert.estado}</p>
      <p><b>Fecha:</b> ${cert.fecha}</p>

      <hr>

      <p>Este certificado ha sido validado por AMTC SpA. Su autenticidad puede ser verificada mediante este código único.</p>

      <p><a href="/pdf/${cert.codigo}" target="_blank">Descargar PDF profesional</a></p>
    </div>
  `);
});

app.get('/pdf/:codigo', async (req, res) => {
  const certificados = cargarCertificados();
  const cert = certificados.find(c => c.codigo === req.params.codigo);

  if (!cert) return res.status(404).send('Certificado no encontrado');

  const url = `https://amtcidiem.cl/verifica/${cert.codigo}`;
  const qr = await QRCode.toDataURL(url);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${cert.codigo}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  const logoPath = path.join(__dirname, 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 40, { width: 220 });
  }

  doc.moveDown(5);
  doc.fontSize(20).text('INFORME DE INSPECCIÓN', { align: 'right' });
  doc.fontSize(16).text('PINTURA INTUMESCENTE', { align: 'right' });
  doc.moveDown();

  doc.fontSize(11).text(`Informe N° ${cert.codigo}`, { align: 'right' });
  doc.text(`Fecha de emisión: ${cert.fecha}`, { align: 'right' });

  doc.moveDown(2);
  doc.fontSize(14).text('DATOS DEL CERTIFICADO', { underline: true });
  doc.moveDown();

  doc.fontSize(11);
  doc.text(`Código: ${cert.codigo}`);
  doc.text(`Proyecto: ${cert.proyecto}`);
  doc.text(`Empresa: ${cert.empresa}`);
  doc.text(`Ubicación: ${cert.ubicacion}`);
  doc.text(`Clasificación: ${cert.clasificacion}`);
  doc.text(`Estado: ${cert.estado}`);

  doc.moveDown(2);
  doc.fontSize(14).text('RESUMEN TÉCNICO', { underline: true });
  doc.moveDown();

  doc.fontSize(11).text(
    'Se deja constancia que el presente certificado corresponde a la validación técnica del sistema de pintura intumescente aplicado en el proyecto indicado, conforme a los antecedentes disponibles y criterios técnicos asociados a la clasificación declarada.'
  );

  doc.moveDown();
  doc.text('Resultado: Certificado válido y vigente.');
  doc.text('Sistema: Pintura intumescente sobre estructura metálica.');
  doc.text(`Clasificación declarada: ${cert.clasificacion}.`);

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
  doc.fontSize(12).text('También puede escanear el siguiente código QR:', { align: 'center' });

  const qrData = qr.replace(/^data:image\\/png;base64,/, '');
  const qrBuffer = Buffer.from(qrData, 'base64');

  doc.image(qrBuffer, 210, 300, { width: 180 });

  doc.moveDown(12);
  doc.fontSize(11).text(`Código de verificación: ${cert.codigo}`, { align: 'center' });
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
