'use strict'

// Imports dependencies and sets up http server
const request = require('request')
const express = require('express')
const body_parser = require('body-parser')
const https = require('https')
const fs = require('fs')
const http = require('http')
const cron = require('node-cron')
require('dotenv').config()

const app = express().use(body_parser.json()) // Creates express http server

const wsResponse = require('./controllers/wsResponse.js')
const mssql = require('mssql')

const configFile = require('./config/config.js')
const sqlController = require('./sqlController.js')

// Servidor HTTP y HTTPS
app.listen(7003, () => console.log('✅ Webhook escuchando en puerto 7003'))

https
  .createServer(
    {
      ca: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/ca_bundle.crt'),
      key: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/private.key'),
      cert: fs.readFileSync('C:/Users/berna/Downloads/CERTIFICADO_API_DF1_APP/CERTIFICADO_API_DF1_APP/certificate.crt')
    },
    app
  )
  .listen(process.env.PORT, () =>
    console.log(`✅ Puerto HTTPS escuchando en ${process.env.PORT}`)
  )

http.createServer({}, app).listen(189, () =>
  console.log('✅ Puerto HTTP escuchando en 189')
)

// Endpoint para iniciar encuesta
app.get('/iniciar_encuesta', async (req, res) => {
  try {
    const encuestaActiva = await sqlController.CARGA_ENCUESTA()
    const idEmpresaConfig = encuestaActiva[0].idEmpresa
    const idEncuestaConfig = encuestaActiva[0].idEncuesta

    const saludoEmpresa = await sqlController.CARGA_EMPRESA(
      idEmpresaConfig,
      idEncuestaConfig
    )
    const datosUsuario = await sqlController.CONSULTA_CLIENTE(idEmpresaConfig)

    await wsResponse.EnviarWsSaludo(datosUsuario, saludoEmpresa, res)
  } catch (error) {
    console.error('❌ Error al cargar encuesta:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener la encuesta activa'
    })
  }
})

// Datos para el bot
app.get('/datos-encuesta', async (req, res) => {
  try {
    const datos = await sqlController.CARGA_DATOS_ENCUESTA_COMPLETO()
    res.status(200).json(datos)
  } catch (error) {
    console.error('❌ Error al cargar datos:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos'
    })
  }
})

// Guardar respuestas
app.post('/guardar-respuestas', sqlController.GUARDAR_RESPUESTAS)

// Recordatorios automáticos
app.get('/enviar-recordatorio/:idEncuesta', async (req, res) => {
  const { idEncuesta } = req.params
  const datosUsuario = await sqlController.ENVIAR_RECORDATORIO(idEncuesta)
  await wsResponse.RecordatorioWs(datosUsuario, res)
})

// Mensaje personalizado vía JSON
app.post('/sendmessage', (req, res) => {
  console.log('📩 Enviando mensaje personalizado:')
  console.log(req.body)
  wsResponse.EnviaWsText(
    req.body.numero,
    req.body.datos.text,
    '100408852712996'
  )
  res.send('✅ Mensaje enviado')
})

// Saludo manual desde frontend
app.post('/solicitudsms', (req, res) => {
  const { objSmsSaludo, numCliente, nombreCliente } = req.body

  wsResponse.EnviaWsText(
    numCliente,
    `👋 ${objSmsSaludo.saludo1} ${nombreCliente}`,
    '100408852712996'
  )
  wsResponse.EnviaWsText(
    numCliente,
    `🤖 ${objSmsSaludo.saludo2}`,
    '100408852712996'
  )
  wsResponse.EnviaWsText(
    numCliente,
    objSmsSaludo.saludo3,
    '100408852712996'
  )
  wsResponse.EnviaWsText(
    numCliente,
    'Por favor ayúdeme indicando si podría realizar la encuesta\nDigite únicamente el número de las siguientes opciones:\n\t⿡ Si, está bien\n\t⿢ No, gracias',
    '100408852712996'
  )

  res.send('✅ SMS enviados correctamente')
})

// Endpoint para Watson / generación automatizada
app.post('/api', async (req, res) => {
  res.send('✅ Enviado correctamente')
  console.log(req.body)

  const cadena = req.body.texto

  if (
    cadena.includes('El asistente virtual a finalizado con la') ||
    cadena.includes('Se ha finalizado la generacion del reporte')
  ) {
    await wsResponse.EnviaWsText(req.body.numero, cadena, '100408852712996')

    const pool = await mssql.connect()
    await pool.request().query(`
      UPDATE tb_estadoEncuesta
      SET estadoEncuesta = 'completado',
          FechaRespuesta = GETDATE()
      WHERE idContacto = (
        SELECT id FROM contactos WHERE codNum = '${req.body.numero}'
      )
    `)

    const opciones = {
      title: 'Desea realizar otra demostración',
      options: [
        {
          label: 'Visión 360|Persona Natural',
          value: { input: { text: 'PGCIUD' } }
        },
        {
          label: 'Entorno Competitivo|Persona Jurídica',
          value: { input: { text: 'SPCIAS' } }
        },
        {
          label: 'Ninguna|Gracias',
          value: { input: { text: 'OPCIONVACIA' } }
        }
      ],
      description:
        'Escoja una de nuestras automatizaciones de prueba|Gaia Consultores|Automatizaciones',
      response_type: 'option'
    }

    await wsResponse.EnviaWsOptions(req.body.numero, opciones, '100408852712996')
    return
  }

  const pool = await mssql.connect()
  await pool.request().query(`
    UPDATE tb_estadoEncuesta
    SET estadoEncuesta = 'en progreso'
    WHERE idContacto = (
      SELECT id FROM contactos WHERE codNum = '${req.body.numero}'
    )
    AND estadoEncuesta = 'no iniciado'
  `)

  if (!req.body.type) {
    await wsResponse.EnviaWsText(req.body.numero, req.body.texto, '100408852712996')
  } else {
    await wsResponse.EnviaWsMedia(req.body.numero, '100408852712996', req.body.texto)
  }
})

// Webhook POST para mensajes entrantes
app.post('/webhook', (req, res) => {
  let type, number12, numberEntry, texto1

  try {
    const msg = req.body.entry[0].changes[0].value.messages[0]
    type = msg.type
    number12 = msg.from
    numberEntry = req.body.entry[0].changes[0].value.metadata.phone_number_id

    switch (type) {
      case 'text':
        texto1 = msg.text.body
        break
      case 'interactive':
        texto1 = msg.interactive.list_reply.id
        break
      case 'button':
        texto1 = msg.button.text
        break
      case 'location':
        texto1 = msg.location
        break
    }

    console.log(`📥 Webhook recibido de: ${numberEntry}`)
  } catch (e) {
    console.error('❌ Error al procesar webhook:', e.message)
  }

  res.sendStatus(req.body.object ? 200 : 404)

  if (type) {
    wsResponse.EnviaWatson(number12, texto1, numberEntry)
  }
})

// Webhook GET para verificación inicial
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = '7S8DV-8DSH6A5DJ-FH8SHFD8DHF-8DHF8SDHF'
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ WEBHOOK_VERIFIED')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})



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
