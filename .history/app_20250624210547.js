'use strict';

// Dependencies
const request = require('request');
const express = require('express');
const body_parser = require('body-parser');
const https = require('https');
const fs = require('fs');
const http = require('http');
const dotenv = require('dotenv');
const cron = require('node-cron');
const axios = require('axios'); // Para hacer peticiones HTTP internas

dotenv.config();

// Express App Setup
const app = express().use(body_parser.json());

// Controllers y módulos
const wsResponse = require('./controllers/wsResponse.js');
const mssql = require('mssql');
const configFile = require('./config/config.js');
const sqlController = require('./sqlController.js');

// ✅ Importación correcta del handler global desde otro proyecto (usando .cjs para CommonJS)
let state;
(async () => {
  const { getGlobalStateHandler } = await import('../base-js-meta-memory/exportState.cjs');
  state = getGlobalStateHandler();
})();

// Servidores
app.listen(7003, () => console.log('webhook is listening 7003'));

https.createServer({
  ca: fs.readFileSync('C:/GAIA/CERTIFICADO_API_DF1_APP/ca_bundle.crt'),
  key: fs.readFileSync('C:/GAIA/CERTIFICADO_API_DF1_APP/private.key'),
  cert: fs.readFileSync('C:/GAIA/CERTIFICADO_API_DF1_APP/certificate.crt')
}, app).listen(process.env.PORT, () => console.log('Puerto escuchando en ' + process.env.PORT));

http.createServer({}, app).listen(189, () => console.log(' puerto escuchando en 189'));

// Rutas
app.get('/iniciar_encuesta', async (req, res) => {
  try {
    const encuestaActiva = await sqlController.CARGA_ENCUESTA();
    const idEmpresaConfig = encuestaActiva[0].idEmpresa;
    const idEncuestaConfig = encuestaActiva[0].idEncuesta;

    const saludoEmpresa = await sqlController.CARGA_EMPRESA(idEmpresaConfig, idEncuestaConfig);
    const datosUsuario = await sqlController.CONSULTA_CLIENTE(idEmpresaConfig);

    // Verifica que hay usuarios válidos
    if (!datosUsuario || datosUsuario.length === 0) {
      return res.status(404).json({ success: false, message: 'No hay usuarios para esta empresa.' });
    }

    // Inserta o actualiza estado en la tabla por cada usuario
    for (const user of datosUsuario) {
      if (!user.idContacto) {
        console.warn(`⚠️ El contacto ${user.nombre} no tiene idContacto definido`);
        continue;
      }
      await sqlController.GESTIONAR_ESTADO_ENCUESTA(idEmpresaConfig, idEncuestaConfig, user.idContacto);
    }

    // Envía plantillas de saludo
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
  //este es
app.get('/enviar-recordatorios-unicos', async (req, res) => {
  try {
    const pendientes = await sqlController.OBTENER_CONTACTOS_PARA_RECORDATORIO();

    for (const usuario of pendientes) {
      await wsResponse.EnviarRecordatorioPlantilla(usuario.num, usuario.nombre);
      await sqlController.MARCAR_RECORDATORIO_ENVIADO(usuario.id);
    }
    console.log('🔔 Recordatorios enviados a los siguientes contactos:');
pendientes.forEach(u => console.log(` - ${u.nombre} (${u.num})`));


    res.status(200).json({ success: true, enviados: pendientes.length });
  } catch (error) {
    console.error('❌ Error al enviar recordatorios:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.get('/recordatorio-inactivos', async function (req, res) {
  const contactosInactivos = await sqlController.OBTENER_INACTIVOS_24H();
  const pool = await mssql.connect(configFile.sqlConfig); // ✅ CORREGIDO

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

  res.status(200).json({
    success: true,
    totalEnviados: contactosInactivos.length
  });
});



app.post('/sendmessage', (req, res) => {
  console.log("Llege a enviar mensajes whatsapp----------");
  console.log(req.body);
  wsResponse.EnviaWsText(req.body.numero, req.body.datos.text, '100408852712996');
});

app.post('/solicitudsms', (req, res) => {
  const { objSmsSaludo, numCliente, nombreCliente } = req.body;
  wsResponse.EnviaWsText(numCliente, '👋 ' + objSmsSaludo.saludo1 + ' *' + nombreCliente + '*', '100408852712996');
  wsResponse.EnviaWsText(numCliente, '🤖 ' + objSmsSaludo.saludo2, '100408852712996');
  wsResponse.EnviaWsText(numCliente, objSmsSaludo.saludo3, '100408852712996');
  wsResponse.EnviaWsText(numCliente, 'Por favor ayúdeme indicando si podría realizar la encuesta\nDigite únicamente el número de las siguientes opciones:\n\t1️⃣ Si, está bien\n\t2️⃣ No, gracias', '100408852712996');
});

app.post('/api', async (req, res) => {
  res.send('Enviado Correctamente');
  console.log(req.body);

  const cadena = req.body.texto;
  const pool = await mssql.connect(configFile.sqlConfig);

  if (cadena.includes("El asistente virtual a finalizado") || cadena.includes("Se ha finalizado la generacion")) {
    await wsResponse.EnviaWsText(req.body.numero, req.body.texto, '100408852712996');

    await pool.request().query(`
      UPDATE tb_estadoEncuesta
      SET estadoEncuesta = 'completado',
          FechaRespuesta = GETDATE()
      WHERE idContacto = (
        SELECT id FROM contactos WHERE codNum = '${req.body.numero}'
      )
    `);

    const datos1 = {
      title: "Desea realizar otra demostración",
      options: [
        { label: "Visión 360|Persona Natural", value: { input: { text: "PGCIUD" } } },
        { label: "Entorno Competitivo|Persona Jurídica", value: { input: { text: "SPCIAS" } } },
        { label: "Ninguna|Gracias", value: { input: { text: "OPCIONVACIA" } } }
      ],
      description: "Escoja una de nuestras automatizaciones de prueba|Gaia Consultores|Automatizaciones",
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
    )
    AND estadoEncuesta = 'no iniciado'
  `);

  if (req.body.type === undefined) {
    await wsResponse.EnviaWsText(req.body.numero, req.body.texto, '100408852712996');
  } else {
    await wsResponse.EnviaWsMedia(req.body.numero, '100408852712996', req.body.texto);
  }
});

app.post('/webhook', (req, res) => {
  let type, number12, numberEntry, texto1;
  try {
    const message = req.body.entry[0].changes[0].value.messages[0];
    type = message.type;
    number12 = message.from;
    numberEntry = req.body.entry[0].changes[0].value.metadata.phone_number_id;
    texto1 = message.text?.body || '';
  } catch (error) {
    console.log('error');
  }

  console.log("Incoming webhook: " + JSON.stringify(req.body));
  if (req.body.object) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }

  if (type === 'text') {
    wsResponse.EnviaWatson(number12, texto1, numberEntry);
  }
  if (type === 'interactive') {
    texto1 = req.body.entry[0].changes[0].value.messages[0].interactive.list_reply.id;
    wsResponse.EnviaWatson(number12, texto1, numberEntry);
  }
  if (type === 'button') {
    texto1 = req.body.entry[0].changes[0].value.messages[0].button.text;
    wsResponse.EnviaWatson(number12, texto1, numberEntry);
  }
  if (type === 'location') {
    wsResponse.EnviaWatson(number12, "UBICACION", numberEntry);
  }
});

app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "7S8DV-8DSH6A5DJ-FH8SHFD8DHF-8DHF8SDHF";
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// CRON: Ejecutar cada hora (minuto 0 de cada hora)
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Ejecutando recordatorio automático...');
  try {
    const response = await axios.get(`http://localhost:${process.env.PORT}/enviar-recordatorios-unicos`);
    console.log(`✅ Recordatorios enviados automáticamente: ${response.data.enviados}`);
  } catch (error) {
    console.error('❌ Error ejecutando el cron de recordatorios:', error.message);
  }
});

