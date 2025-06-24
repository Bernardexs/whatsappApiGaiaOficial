'use strict';

// Dependencies
const request      = require('request');
const express      = require('express');
const body_parser  = require('body-parser');
const https        = require('https');
const http         = require('http');
const fs           = require('fs');
const dotenv       = require('dotenv');
const cron         = require('node-cron');
const axios        = require('axios');
const mssql        = require('mssql');

dotenv.config();

// Express App Setup
const app  = express().use(body_parser.json());
const PORT = process.env.PORT || 7003;

// Controllers y módulos
const wsResponse    = require('./controllers/wsResponse.js');
const configFile    = require('./config/config.js');
const sqlController = require('./sqlController.js');

// Lista de afirmaciones para iniciar el flujo Builderbot
const AFFIRMATIONS = ['si','sí','claro','dale','listo','acepto','voy','de una','ok'];

// URL de tu bot Builderbot
const BOT_WEBHOOK_URL = 'http://localhost:3008/webhook';

// --- Servidores ---
app.listen(7003, () => console.log('🔓 webhook listening on port 7003'));

https.createServer({
  ca:   fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/ca_bundle.crt'),
  key:  fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/private.key'),
  cert: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/certificate.crt')
}, app).listen(process.env.PORT, () => console.log(`🔒 HTTPS listening on port ${process.env.PORT}`));

http.createServer({}, app).listen(189, () => console.log('🌐 HTTP listening on port 189'));


// --- RUTAS DE ENCUESTA ---
app.get('/iniciar_encuesta', async (req, res) => {
  try {
    const encuestaActiva    = await sqlController.CARGA_ENCUESTA();
    const idEmpresaConfig   = encuestaActiva[0].idEmpresa;
    const idEncuestaConfig  = encuestaActiva[0].idEncuesta;
    const saludoEmpresa     = await sqlController.CARGA_EMPRESA(idEmpresaConfig, idEncuestaConfig);
    const datosUsuario      = await sqlController.CONSULTA_CLIENTE(idEmpresaConfig);

    if (!datosUsuario || datosUsuario.length === 0) {
      return res.status(404).json({ success: false, message: 'No hay usuarios para esta empresa.' });
    }

    for (const user of datosUsuario) {
      if (!user.idContacto) continue;
      await sqlController.GESTIONAR_ESTADO_ENCUESTA(idEmpresaConfig, idEncuestaConfig, user.idContacto);
    }

    await wsResponse.EnviarWsSaludo(datosUsuario, saludoEmpresa, res);
  } catch (error) {
    console.error('❌ Error al cargar encuesta:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error al obtener la encuesta activa' });
    }
  }
});

app.get('/datos-encuesta', async (req, res) => {
  try {
    const datos = await sqlController.CARGA_DATOS_ENCUESTA_COMPLETO();
    res.status(200).json(datos);
  } catch (error) {
    console.error('❌ Error al cargar encuesta:', error);
    res.status(500).json({ success: false, message: 'Error al obtener la encuesta activa' });
  }
});

app.post('/guardar-respuestas', sqlController.GUARDAR_RESPUESTAS);

app.get('/enviar-recordatorio/:idEncuesta', async (req, res) => {
  const { idEncuesta } = req.params;
  const datosUsuario   = await sqlController.ENVIAR_RECORDATORIO(idEncuesta);
  await wsResponse.RecordatorioWs(datosUsuario, res);
});

app.get('/enviar-recordatorios-unicos', async (req, res) => {
  try {
    const pendientes = await sqlController.OBTENER_CONTACTOS_PARA_RECORDATORIO();
    for (const usuario of pendientes) {
      await wsResponse.EnviarRecordatorioPlantilla(usuario.num, usuario.nombre);
      await sqlController.MARCAR_RECORDATORIO_ENVIADO(usuario.id);
    }
    console.log('🔔 Recordatorios enviados a:');
    pendientes.forEach(u => console.log(` - ${u.nombre} (${u.num})`));
    res.status(200).json({ success: true, enviados: pendientes.length });
  } catch (error) {
    console.error('❌ Error al enviar recordatorios:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/recordatorio-inactivos', async (req, res) => {
  const contactosInactivos = await sqlController.OBTENER_INACTIVOS_24H();
  const pool = await mssql.connect(configFile.sqlConfig);
  for (const contacto of contactosInactivos) {
    await wsResponse.EnviarRecordatorioPlantilla(contacto.num, contacto.nombre);
    await pool.request().query(`
      UPDATE tb_estadoEncuesta
      SET FechaUltimoRecordatorio = GETDATE()
      WHERE idEncuesta = ${contacto.idEncuesta}
        AND idEmpresa  = ${contacto.idEmpresa}
        AND idContacto = (
          SELECT id FROM contactos WHERE num = '${contacto.num}'
        )
    `);
  }
  res.status(200).json({ success: true, totalEnviados: contactosInactivos.length });
});

app.post('/sendmessage', (req, res) => {
  wsResponse.EnviaWsText(req.body.numero, req.body.datos.text, '100408852712996');
  res.sendStatus(200);
});

app.post('/solicitudsms', (req, res) => {
  const { objSmsSaludo, numCliente, nombreCliente } = req.body;
  wsResponse.EnviaWsText(numCliente, '👋 ' + objSmsSaludo.saludo1 + ' *' + nombreCliente + '*', '100408852712996');
  wsResponse.EnviaWsText(numCliente, '🤖 ' + objSmsSaludo.saludo2, '100408852712996');
  wsResponse.EnviaWsText(numCliente, objSmsSaludo.saludo3, '100408852712996');
  wsResponse.EnviaWsText(numCliente,
    'Por favor ayúdeme indicando si podría realizar la encuesta\nDigite únicamente:\n\t1️⃣ Sí\n\t2️⃣ No',
    '100408852712996'
  );
  res.sendStatus(200);
});

app.post('/api', async (req, res) => {
  res.send('Enviado Correctamente');
  const cadena = req.body.texto;
  const pool   = await mssql.connect(configFile.sqlConfig);

  if (cadena.includes("finalizado")) {
    await wsResponse.EnviaWsText(req.body.numero, cadena, '100408852712996');
    await pool.request().query(`
      UPDATE tb_estadoEncuesta
      SET estadoEncuesta = 'completado', FechaRespuesta = GETDATE()
      WHERE idContacto = (
        SELECT id FROM contactos WHERE codNum = '${req.body.numero}'
      )
    `);

    const datos1 = {
      title: "Desea realizar otra demostración",
      options: [
        { label: "Visión 360|Persona Natural",       value: { input: { text: "PGCIUD" } } },
        { label: "Entorno Competitivo|Persona Jurídica", value: { input: { text: "SPCIAS" } } },
        { label: "Ninguna|Gracias",                  value: { input: { text: "OPCIONVACIA" } } }
      ],
      description: "Escoja una automatización de prueba|Gaia Consultores|Automatizaciones",
      response_type: "option"
    };

    await wsResponse.EnviaWsOptions(req.body.numero, datos1, '100408852712996');
    return;
  }

  await pool.request().query(`
    UPDATE tb_estadoEncuesta
    SET estadoEncuesta = 'en progreso'
    WHERE idContacto = (
      SELECT id FROM contactos WHERE codNum = '${req.body.numero}'
    ) AND estadoEncuesta = 'no iniciado'
  `);

  if (req.body.type === undefined) {
    await wsResponse.EnviaWsText(req.body.numero, cadena, '100408852712996');
  } else {
    await wsResponse.EnviaWsMedia(req.body.numero, '100408852712996', cadena);
  }
});


// -----------------------
//   NUEVO WEBHOOK B2B
// -----------------------
app.post('/webhook', async (req, res) => {
  // 1) siempre contestamos 200
  res.sendStatus(200);

  // 2) parseamos
  const change = req.body.entry?.[0]?.changes?.[0]?.value;
  const msg    = change?.messages?.[0];
  if (!msg) return;

  const from    = msg.from;
  let   text    = '';
  const phoneId = change.metadata.phone_number_id;

  // 3) Watson como antes
  if (msg.type === 'text') {
    text = msg.text.body.trim().toLowerCase();
    await wsResponse.EnviaWatson(from, text, phoneId);
  } else if (msg.type === 'interactive') {
    if (msg.interactive.list_reply) {
      text = msg.interactive.list_reply.id.trim().toLowerCase();
    } else if (msg.interactive.button) {
      text = msg.interactive.button.text.trim().toLowerCase();
    }
    await wsResponse.EnviaWatson(from, text, phoneId);
  }

  // 4) si es afirmación, reenvía al bot Builderbot
  if (AFFIRMATIONS.includes(text)) {
    try {
      await axios.post(BOT_WEBHOOK_URL, req.body);
      console.log(`✅ Reenviado afirmación "${text}" de ${from} al bot Builderbot`);
    } catch (err) {
      console.error('❌ Error reenviando al bot Builderbot:', err.message);
    }
  }
});

// Verificación GET de webhook (igual que antes)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.verifyToken; //"7S8DV-8DSH6A5DJ-FH8SHFD8DHF-8DHF8SDHF";
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ WEBHOOK_VERIFIED');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});


// --- CRON para recordatorios cada hora ---
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Ejecutando recordatorio automático...');
  try {
    const response = await axios.get(`http://localhost:${process.env.PORT}/enviar-recordatorios-unicos`);
    console.log(`✅ Recordatorios enviados automáticamente: ${response.data.enviados}`);
  } catch (error) {
    console.error('❌ Error ejecutando cron:', error.message);
  }
});
