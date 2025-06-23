'use strict';

const express = require('express');
const request = require('request');
const body_parser = require('body-parser');
const https = require('https');
const http = require('http');
const fs = require('fs');
const dotenv = require('dotenv');
const cron = require('node-cron');
const axios = require('axios');
const mssql = require('mssql');

dotenv.config();

const app = express().use(body_parser.json());

const wsResponse = require('./controllers/wsResponse.js');
const configFile = require('./config/config.js');
const sqlController = require('./sqlController.js');

// ✅ IMPORTA el handler del bot Builderbot
import { handleCtx } from '../../base-js-meta-memory1/base-js-meta-memory/src/app.js';

// === SERVIDORES ===
app.listen(7003, () => console.log('webhook is listening 7003'));

https.createServer({
  ca: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/ca_bundle.crt'),
  key: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/private.key'),
  cert: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/certificate.crt')
}, app).listen(process.env.PORT, () => console.log('Puerto escuchando en ' + process.env.PORT));

http.createServer({}, app).listen(189, () => console.log(' puerto escuchando en 189'));

// === RUTAS ===
app.get('/iniciar_encuesta', async (req, res) => {
  try {
    const encuestaActiva = await sqlController.CARGA_ENCUESTA();
    const idEmpresaConfig = encuestaActiva[0].idEmpresa;
    const idEncuestaConfig = encuestaActiva[0].idEncuesta;
    const saludoEmpresa = await sqlController.CARGA_EMPRESA(idEmpresaConfig, idEncuestaConfig);
    const datosUsuario = await sqlController.CONSULTA_CLIENTE(idEmpresaConfig);

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
  const datosUsuario = await sqlController.ENVIAR_RECORDATORIO(idEncuesta);
  await wsResponse.RecordatorioWs(datosUsuario, res);
});

app.get('/enviar-recordatorios-unicos', async (req, res) => {
  try {
    const pendientes = await sqlController.OBTENER_CONTACTOS_PARA_RECORDATORIO();

    for (const usuario of pendientes) {
      await wsResponse.EnviarRecordatorioPlantilla(usuario.num, usuario.nombre);
      await sqlController.MARCAR_RECORDATORIO_ENVIADO(usuario.id);
    }

    console.log('🔔 Recordatorios enviados:');
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
        AND idEmpresa = ${contacto.idEmpresa}
        AND idContacto = (
          SELECT id FROM contactos WHERE num = '${contacto.num}'
        )
    `);
  }

  res.status(200).json({ success: true, totalEnviados: contactosInactivos.length });
});

app.post('/sendmessage', (req, res) => {
  console.log("Llege a enviar mensajes whatsapp----------");
  wsResponse.EnviaWsText(req.body.numero, req.body.datos.text, '100408852712996');
});

app.post('/solicitudsms', (req, res) => {
  const { objSmsSaludo, numCliente, nombreCliente } = req.body;
  wsResponse.EnviaWsText(numCliente, '👋 ' + objSmsSaludo.saludo1 + ' *' + nombreCliente + '*', '100408852712996');
  wsResponse.EnviaWsText(numCliente, '🤖 ' + objSmsSaludo.saludo2, '100408852712996');
  wsResponse.EnviaWsText(numCliente, objSmsSaludo.saludo3, '100408852712996');
  wsResponse.EnviaWsText(numCliente, 'Por favor ayúdeme indicando si podría realizar la encuesta\nDigite únicamente:\n\t1️⃣ Sí\n\t2️⃣ No', '100408852712996');
});

// ✅ NUEVO: Webhook integrado con Builderbot
app.post('/webhook', async (req, res) => {
  console.log("📩 Incoming webhook:", JSON.stringify(req.body, null, 2));

  if (req.body.object) {
    try {
      await handleCtx(req.body); // 👉 Aquí se maneja con Builderbot
    } catch (e) {
      console.error('❌ Error en handleCtx:', e.message);
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "7S8DV-8DSH6A5DJ-FH8SHFD8DHF-8DHF8SDHF";
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ WEBHOOK_VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// CRON
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Ejecutando recordatorio automático...');
  try {
    const response = await axios.get(`http://localhost:${process.env.PORT}/enviar-recordatorios-unicos`);
    console.log(`✅ Recordatorios enviados automáticamente: ${response.data.enviados}`);
  } catch (error) {
    console.error('❌ Error ejecutando cron:', error.message);
  }
});
