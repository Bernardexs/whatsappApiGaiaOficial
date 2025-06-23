'use strict';

// → Dependencias
const express     = require('express')
const body_parser = require('body-parser')
const https       = require('https')
const http        = require('http')
const fs          = require('fs')
const dotenv      = require('dotenv')
const cron        = require('node-cron')
const axios       = require('axios')
const mssql       = require('mssql')

dotenv.config()

// → Inicializa Express
const app = express().use(body_parser.json())
const PORT = process.env.PORT || 7003

// → Controladores y módulos internos
const wsResponse    = require('./controllers/wsResponse.js')
const configFile    = require('./config/config.js')
const sqlController = require('./sqlController.js')

// === SERVIDORES ===
// HTTP simple (puerto 189)
http.createServer({}, app).listen(189, () => console.log('HTTP listening on 189'))
// HTTPS seguro (puerto definido en .env)
https.createServer({
  ca:  fs.readFileSync('C:/Users/berna/.../ca_bundle.crt'),
  key: fs.readFileSync('C:/Users/berna/.../private.key'),
  cert:fs.readFileSync('C:/Users/berna/.../certificate.crt')
}, app).listen(PORT, () => console.log(`HTTPS listening on ${PORT}`))

// === RUTAS DE GESTIÓN DE ENCUESTA ===
app.get('/iniciar_encuesta', async (req, res) => {
  try {
    const encuestaActiva   = await sqlController.CARGA_ENCUESTA()
    const { idEmpresa, idEncuesta } = encuestaActiva[0]
    const saludoEmpresa    = await sqlController.CARGA_EMPRESA(idEmpresa, idEncuesta)
    const datosUsuario     = await sqlController.CONSULTA_CLIENTE(idEmpresa)

    if (!datosUsuario.length) {
      return res.status(404).json({ success:false, message:'No hay usuarios.' })
    }

    for (const u of datosUsuario) {
      if (!u.idContacto) continue
      await sqlController.GESTIONAR_ESTADO_ENCUESTA(idEmpresa, idEncuesta, u.idContacto)
    }

    await wsResponse.EnviarWsSaludo(datosUsuario, saludoEmpresa, res)
  } catch (e) {
    console.error('Error iniciar_encuesta:', e)
    if (!res.headersSent) res.status(500).json({ success:false, message:'Error interno' })
  }
})

app.get('/datos-encuesta',      async (req, res) => {
  try { res.status(200).json(await sqlController.CARGA_DATOS_ENCUESTA_COMPLETO()) }
  catch (e) { console.error(e); res.status(500).json({ success:false }) }
})

app.post('/guardar-respuestas', sqlController.GUARDAR_RESPUESTAS)
app.get('/enviar-recordatorio/:idEncuesta', async (req, res) => {
  const datos = await sqlController.ENVIAR_RECORDATORIO(req.params.idEncuesta)
  await wsResponse.RecordatorioWs(datos, res)
})
app.get('/enviar-recordatorios-unicos', async (req, res) => {
  try {
    const pendientes = await sqlController.OBTENER_CONTACTOS_PARA_RECORDATORIO()
    for (const u of pendientes) {
      await wsResponse.EnviarRecordatorioPlantilla(u.num, u.nombre)
      await sqlController.MARCAR_RECORDATORIO_ENVIADO(u.id)
    }
    res.json({ success:true, enviados:pendientes.length })
  } catch (e) {
    console.error(e)
    res.status(500).json({ success:false, error:e.message })
  }
})
app.get('/recordatorio-inactivos', async (req, res) => {
  const inactivos = await sqlController.OBTENER_INACTIVOS_24H()
  const pool      = await mssql.connect(configFile.sqlConfig)
  for (const c of inactivos) {
    await wsResponse.EnviarRecordatorioPlantilla(c.num, c.nombre)
    await pool.request().query(`
      UPDATE tb_estadoEncuesta
      SET FechaUltimoRecordatorio = GETDATE()
      WHERE idEncuesta = ${c.idEncuesta}
        AND idEmpresa  = ${c.idEmpresa}
        AND idContacto = (SELECT id FROM contactos WHERE num = '${c.num}')
    `)
  }
  res.json({ success:true, totalEnviados: inactivos.length })
})

// == Envío manual de sms/ws ==
app.post('/sendmessage',   (req, res) => { wsResponse.EnviaWsText(req.body.numero, req.body.datos.text, '100408852712996') })
app.post('/solicitudsms',   (req, res) => {
  const { objSmsSaludo, numCliente, nombreCliente } = req.body
  wsResponse.EnviaWsText(numCliente, `👋 ${objSmsSaludo.saludo1} *${nombreCliente}*`, '100408852712996')
  wsResponse.EnviaWsText(numCliente, `🤖 ${objSmsSaludo.saludo2}`, '100408852712996')
  wsResponse.EnviaWsText(numCliente, objSmsSaludo.saludo3, '100408852712996')
  wsResponse.EnviaWsText(numCliente,
    'Por favor indique si desea contestar la encuesta:\n1️⃣ Sí\n2️⃣ No',
    '100408852712996'
  )
})

// === WEBHOOK DE WHATSAPP BUSINESS ===
app.post('/webhook', async (req, res) => {
  // Siempre devuelve 200 rápidamente
  res.sendStatus(200)

  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  if (!msg || msg.type !== 'text') return

  const from  = msg.from
  const text  = msg.text.body.trim().toLowerCase()

  // 1) sigue usando Watson si lo deseas
  wsResponse.EnviaWatson(from, text, req.body.entry[0].changes[0].value.metadata.phone_number_id)

  // 2) si responde “sí” -> lo reenvías al bot Builderbot
  if (['sí','si','1','ok','claro'].includes(text)) {
    try {
      await axios.post('http://localhost:3008/webhook', req.body)
      console.log(`✅ Reenviado al bot: ${from}`)
    } catch (e) {
      console.error('❌ Error reenviando al bot:', e.message)
    }
  }
})

// == Verificación GET webhook ==
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = "7S8DV-8DSH6A5DJ-FH8SHFD8DHF-8DHF8SDHF"
  const mode        = req.query['hub.mode']
  const token       = req.query['hub.verify_token']
  const challenge   = req.query['hub.challenge']

  if (mode==='subscribe' && token===VERIFY_TOKEN) {
    console.log('✅ WEBHOOK_VERIFIED')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// == CRON ==
cron.schedule('0 * * * *', async () => {
  try {
    const r = await axios.get(`http://localhost:${PORT}/enviar-recordatorios-unicos`)
    console.log(`⏰ Recordatorios automáticos: ${r.data.enviados}`)
  } catch (e) {
    console.error('❌ Error cron:', e.message)
  }
})
