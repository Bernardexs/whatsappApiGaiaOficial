import express from 'express';
import bodyParser from 'body-parser';
import https from 'https';
import fs from 'fs';
import http from 'http';
import dotenv from 'dotenv';
import cron from 'node-cron';
import axios from 'axios';
import mssql from 'mssql';

// Archivos locales
import wsResponse from './controllers/wsResponse.js';
import { sqlConfig, poolPromise, waID, config_Encuesta } from './config/config.js';
import sqlController from './sqlController.js';

// Importa el handler del bot (asegúrate de exportar correctamente `handleCtx`)
import { handleCtx } from '../../base-js-meta-memory1/base-js-meta-memory/src/app.js';

dotenv.config();
const app = express().use(bodyParser.json());
const PORT = process.env.PORT || 7003;

// HTTPS Server
https.createServer({
  ca: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/ca_bundle.crt'),
  key: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/private.key'),
  cert: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/certificate.crt')
}, app).listen(PORT, () => console.log('🟢 HTTPS listening on port ' + PORT));

// HTTP Server alternativo (puerto 189)
http.createServer({}, app).listen(189, () => console.log('🟢 HTTP listening on port 189'));

// ----------- RUTAS DE SERVICIO -----------

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
    console.error('❌ Error al iniciar encuesta:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error al iniciar encuesta' });
    }
  }
});

app.get('/datos-encuesta', async (req, res) => {
  try {
    const datos = await sqlController.CARGA_DATOS_ENCUESTA_COMPLETO();
    res.status(200).json(datos);
  } catch (error) {
    console.error('❌ Error al cargar datos encuesta:', error);
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

    res.status(200).json({ success: true, enviados: pendientes.length });
  } catch (error) {
    console.error('❌ Error al enviar recordatorios únicos:', error);
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

// ----------- INTEGRACIÓN CON BOT DE ENCUESTAS -----------

app.post('/webhook', async (req, res) => {
  try {
    if (req.body.object) {
      await handleCtx(req.body); // << integración con Builderbot
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error('❌ Error en webhook:', err.message);
    res.sendStatus(500);
  }
});

app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "7S8DV-8DSH6A5DJ-FH8SHFD8DHF-8DHF8SDHF";
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// ----------- CRONJOB AUTOMÁTICO -----------

cron.schedule('0 * * * *', async () => {
  console.log('⏰ Ejecutando recordatorio automático...');
  try {
    const response = await axios.get(`http://localhost:${PORT}/enviar-recordatorios-unicos`);
    console.log(`✅ Recordatorios enviados automáticamente: ${response.data.enviados}`);
  } catch (error) {
    console.error('❌ Error ejecutando el cron de recordatorios:', error.message);
  }
});
