const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

const archivoCertificados = path.join(__dirname, 'certificados.json');

function cargarCertificados() {
  if (!fs.existsSync(archivoCertificados)) {
    fs.writeFileSync(archivoCertificados, JSON.stringify([]));
  }

  const data = fs.readFileSync(archivoCertificados, 'utf8');
  return JSON.parse(data);
}

function guardarCertificados(certificados) {
  fs.writeFileSync(archivoCertificados, JSON.stringify(certificados, null, 2));
}

// Página principal
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: Arial; max-width: 700px; margin: auto; padding: 40px;">
      <h1>AMTC SpA</h1>
      <p>Sistema de Verificación de Certificados Técnicos</p>
      <hr>
      <p>Servidor funcionando correctamente.</p>
      <a href="/admin">Ir al panel administrador</a>
    </div>
  `);
});

// Panel admin
app.get('/admin', (req, res) => {
  res.send(`
    <div style="font-family: Arial; max-width: 700px; margin: auto; padding: 40px;">
      <h1>AMTC - Crear Certificado</h1>

      <input id="proyecto" placeholder="Proyecto" style="width:100%; padding:10px; margin-bottom:10px;"><br>
      <input id="empresa" placeholder="Empresa" style="width:100%; padding:10px; margin-bottom:10px;"><br>
      <input id="clasificacion" placeholder="Clasificación F60" style="width:100%; padding:10px; margin-bottom:10px;"><br>

      <button onclick="crear()" style="padding:10px 20px;">Crear Certificado</button>

      <div id="resultado" style="margin-top:20px;"></div>

      <script>
        function crear() {
          fetch('/api/certificados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proyecto: document.getElementById('proyecto').value,
              empresa: document.getElementById('empresa').value,
              clasificacion: document.getElementById('clasificacion').value
            })
          })
          .then(r => r.json())
          .then(d => {
            document.getElementById('resultado').innerHTML =
              '<h3>Certificado creado</h3>' +
              '<p><b>Código:</b> ' + d.codigo + '</p>' +
              '<p><a target="_blank" href="/verifica/' + d.codigo + '">Abrir verificación</a></p>' +
              '<p><b>Link:</b> https://amtcidiem.cl/verifica/' + d.codigo + '</p>';
          });
        }
      </script>
    </div>
  `);
});

// Crear certificado
app.post('/api/certificados', (req, res) => {
  const certificados = cargarCertificados();

  const codigo = `F60-AMTC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const nuevo = {
    codigo,
    proyecto: req.body.proyecto || 'Sin proyecto',
    empresa: req.body.empresa || 'Sin empresa',
    clasificacion: req.body.clasificacion || 'F60',
    estado: 'Vigente',
    fecha: new Date().toLocaleDateString('es-CL')
  };

  certificados.push(nuevo);
  guardarCertificados(certificados);

  res.json({
    codigo: nuevo.codigo,
    url: `/verifica/${nuevo.codigo}`
  });
});

// API verificar
app.get('/api/verifica/:codigo', (req, res) => {
  const certificados = cargarCertificados();
  const cert = certificados.find(c => c.codigo === req.params.codigo);

  if (!cert) {
    return res.json({ estado: 'invalido' });
  }

  res.json(cert);
});

// Página de verificación
app.get('/verifica/:codigo', (req, res) => {
  const certificados = cargarCertificados();
  const codigo = req.params.codigo;
  const cert = certificados.find(c => c.codigo === codigo);

  if (!cert) {
    return res.send(`
      <div style="font-family: Arial; max-width: 700px; margin: auto; padding: 40px;">
        <h1>AMTC SpA</h1>
        <h2 style="color:red;">❌ Certificado no válido</h2>
        <p>El código ingresado no existe en el sistema.</p>
        <p><b>Código consultado:</b> ${codigo}</p>
      </div>
    `);
  }

  res.send(`
    <div style="font-family: Arial; max-width: 700px; margin: auto; padding: 40px;">
      <h1 style="text-align:center;">AMTC SpA</h1>
      <p style="text-align:center;">Sistema de Verificación de Certificados Técnicos</p>

      <hr>

      <h2 style="color:green;">✔ Certificado Válido</h2>

      <p><b>Código:</b> ${cert.codigo}</p>
      <p><b>Proyecto:</b> ${cert.proyecto}</p>
      <p><b>Empresa:</b> ${cert.empresa}</p>
      <p><b>Clasificación:</b> ${cert.clasificacion}</p>
      <p><b>Estado:</b> ${cert.estado}</p>
      <p><b>Fecha:</b> ${cert.fecha}</p>

      <hr>

      <p style="font-size:13px;">
        Este certificado ha sido validado por AMTC SpA. 
        Su autenticidad puede ser verificada mediante este código único.
      </p>
    </div>
  `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('AMTC funcionando en puerto ' + PORT);
});
