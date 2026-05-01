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
app.get('/admin', (req, res) => {
  res.send(`
    <h2>AMTC - Crear Certificado</h2>

    <input id="proyecto" placeholder="Proyecto"><br><br>
    <input id="empresa" placeholder="Empresa"><br><br>
    <input id="clasificacion" placeholder="F60"><br><br>

    <button onclick="crear()">Crear Certificado</button>

    <script>
      function crear(){
        fetch('/api/certificados', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            proyecto: document.getElementById('proyecto').value,
            empresa: document.getElementById('empresa').value,
            clasificacion: document.getElementById('clasificacion').value
          })
        })
        .then(r => r.json())
        .then(d => {
          alert("Código: " + d.codigo);
          window.open('/verifica/' + d.codigo);
        });
      }
    </script>
  `);
});
