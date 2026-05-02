const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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
    </div>
  `);
}

app.get('/', (req, res) => {
  res.send(`
    <html>
    <body style="font-family:Arial;text-align:center;background:#f4f4f4;padding:40px;">
      <img src="/public/logo.png" style="width:420px;max-width:90%;">
      <h1>Sistema de Verificación de Certificados Técnicos</h1>
      <p>Certificación técnica y validación documental</p>

      <input id="codigo" placeholder="Ej: AMTC-2026-0001" style="padding:12px;width:300px;">
      <button onclick="verificar()" style="padding:12px;">Verificar</button>

      <script>
        function verificar() {
          const codigo = document.getElementById('codigo').value.trim();
          if (codigo) window.location.href = '/verifica/' + codigo;
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/admin', auth, (req, res) => {
  res.send(`
    <html>
    <body style="font-family:Arial;max-width:800px;margin:auto;padding:40px;">
      <div style="text-align:center;">
        <img src="/public/logo.png" style="width:420px;max-width:90%;">
        <h1>Panel Administrador</h1>
      </div>

      <input id="proyecto" placeholder="Proyecto" style="width:100%;padding:12px;margin-bottom:10px;"><br>
      <input id="empresa" placeholder="Empresa" style="width:100%;padding:12px;margin-bottom:10px;"><br>
      <input id="clasificacion" placeholder="Clasificación F60" style="width:100%;padding:12px;margin-bottom:10px;"><br>
      <input id="ubicacion" placeholder="Ubicación" style="width:100%;padding:12px;margin-bottom:10px;"><br>

      <button onclick="crear()" style="padding:12px 20px;">Crear Certificado</button>

      <div id="resultado" style="margin-top:25px;"></div>

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
              '<p><a target="_blank" href="/verifica/' + d.codigo + '">Abrir verificación</a></p>';
          });
        }
      </script>
    </body>
    </html>
  `);
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
    fecha: '24/04/2026'
  };

  certificados.push(nuevo);
  guardarCertificados(certificados);

  res.json({
    codigo,
    url: `/verifica/${codigo}`
  });
});

app.get('/verifica/:codigo', (req, res) => {
  const certificados = cargarCertificados();
  const cert = certificados.find(c => c.codigo === req.params.codigo);

  if (!cert) {
    return res.send(`
      <h2 style="color:red;text-align:center;font-family:Arial;">❌ Certificado no válido</h2>
    `);
  }

  res.send(`
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Verificación de Certificado</title>
      <style>
        body {
          font-family: Arial;
          background: #f4f4f4;
          margin: 0;
          text-align: center;
        }
        .logo {
          width: 420px;
          max-width: 90%;
          margin-top: 30px;
        }
        h1 {
          margin-top: 20px;
          font-size: 30px;
        }
        .subtitle {
          color: #555;
        }
        .line {
          width: 90%;
          height: 4px;
          background: #d60000;
          margin: 25px auto;
        }
        .status {
          color: green;
          font-size: 32px;
          font-weight: bold;
          text-align: left;
          width: 90%;
          margin: auto;
        }
        .card {
          width: 90%;
          margin: 25px auto;
          background: #eee;
          padding: 25px;
          border-radius: 8px;
          text-align: left;
          font-size: 18px;
        }
        b {
          display: inline-block;
          width: 150px;
        }
      </style>
    </head>

    <body>
      <img src="/public/logo.png?v=999" class="logo" />

      <h1>Verificación de Certificado Técnico</h1>
      <div class="subtitle">Sistema oficial de validación documental</div>

      <div class="line"></div>

      <div class="status">✔ Certificado Válido</div>

      <div class="card">
        <p><b>Código:</b> ${cert.codigo}</p>
        <p><b>Proyecto:</b> ${cert.proyecto}</p>
        <p><b>Empresa:</b> ${cert.empresa}</p>
        <p><b>Ubicación:</b> ${cert.ubicacion}</p>
        <p><b>Clasificación:</b> ${cert.clasificacion}</p>
        <p><b>Estado:</b> Vigente</p>
        <p><b>Fecha:</b> 24/04/2026</p>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/verifica/:codigo', (req, res) => {
  const certificados = cargarCertificados();
  const cert = certificados.find(c => c.codigo === req.params.codigo);

  if (!cert) return res.json({ estado: 'invalido' });

  res.json(cert);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('AMTC funcionando en puerto ' + PORT);
});
