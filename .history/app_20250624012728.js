﻿import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import dotenv from 'dotenv'
import axios from 'axios'
dotenv.config()

const PORT = process.env.PORT ?? 3009

export const provider = createProvider(Provider, {
  jwtToken: process.env.jwtToken,
  numberId: process.env.numberId,
  verifyToken: process.env.verifyToken,
  version: process.env.version
})

const afirmaciones = ['SI', 'SÍ', 'CLARO', 'DALE', 'LISTO', 'ACEPTO', 'VOY', 'DE UNA', 'OK']
const negaciones = ['NO', 'NO GRACIAS', 'NUNCA', 'NEGADO', 'AHORA NO', 'NO DESEARÍA', 'PASO']

const INACTIVITY_MINUTES = 0.5
const inactivityTimers = new Map()
const reminderCounts = new Map()
const PRE_ENCUESTA = -1 // paso especial para el mensaje inicial

function clearReminder(user, paso = null) {
  if (inactivityTimers.has(user)) {
    clearTimeout(inactivityTimers.get(user))
    inactivityTimers.delete(user)
  }
  if (paso !== null) {
    reminderCounts.delete(${user}-${paso})
  }
}

function scheduleReminder(user, paso, state) {
  clearReminder(user)

  const key = ${user}-${paso}
  const currentCount = reminderCounts.get(key) || 0
  if (currentCount >= 2) return

  const timeoutId = setTimeout(async () => {
    const datos = await state.getMyState()
    if (!datos || datos.paso !== paso) return

    try {
      if (paso === PRE_ENCUESTA) {
        await provider.sendText(
          user,
          '👋 Hola, ¿aún te interesa participar en una breve encuesta? Tu opinión es muy importante. Responde sí o no para continuar.'
        )
      } else {
        await provider.sendText(
          user,
          Tu opinión es muy valiosa para nosotros 🙏, ¿podrías ayudarnos respondiendo la pregunta ${paso + 1}?
        )
      }
    } catch (e) {
      console.error('❌ Error al enviar recordatorio:', e.message)
    }

    reminderCounts.set(key, currentCount + 1)
    scheduleReminder(user, paso, state)
  }, INACTIVITY_MINUTES * 60 * 1000)

  inactivityTimers.set(user, timeoutId)
}

const encuestaFlow = addKeyword(afirmaciones)
  .addAction(async (ctx, { state, flowDynamic }) => {
    clearReminder(ctx.from, PRE_ENCUESTA)
    const { data } = await axios.get('http://localhost:7003/datos-encuesta')
    const { saludos, contactos, preguntas } = data
    const usuario = contactos.find(u => u.num === ctx.from);

    if (!usuario) {
      await flowDynamic('❌ No se encontró una encuesta asignada para ti.');
      return;
    }

    const yaInicializado = await state.get('preguntas')
    if (yaInicializado) return

    await state.update({
      preguntas,
      respuestas: [],
      paso: 0,
      nombre: usuario.nombre,
      despedida: saludos[0]?.saludo3 || '✅ Gracias por participar en la encuesta.',
    })

    await flowDynamic(✅ ¡Hola ${usuario.nombre}! Empecemos con tu encuesta.)

    const p0 = preguntas[0]
    let msg0 = ⿡ ${p0.pregunta}

    if (p0.textoIni && p0.tipoRespuesta === 'RANGO') {
      msg0 += \n*Califica del rango ${p0.rangoIni} al ${p0.rangoFin}*
      msg0 += \n${p0.textoIni.split('=').map(s => s.replace('-', ' - ').trim()).join('\n')}
    } else if (p0.textoIni) {
      msg0 += \n${p0.textoIni.split('=').map(s => s.replace('-', ' - ').trim()).join('\n')}
    }

    await flowDynamic(msg0)
    scheduleReminder(ctx.from, 0, state)
  })
  .addAnswer(null, { capture: true }, async (ctx, { state, flowDynamic, gotoFlow }) => {
    clearReminder(ctx.from)

    const datos = await state.getMyState()
    if (!datos || !datos.preguntas) return

    let { preguntas, respuestas, paso, despedida } = datos
    const preguntaActual = preguntas[paso]
    const respuesta = ctx.body.trim()

    if (preguntaActual.tipoRespuesta === 'RANGO') {
      const valor = parseInt(respuesta, 10)
      if (isNaN(valor) || valor < preguntaActual.rangoIni || valor > preguntaActual.rangoFin) {
        await flowDynamic(❌ Por favor responde con un número entre ${preguntaActual.rangoIni} y ${preguntaActual.rangoFin}.)
        return gotoFlow(encuestaFlow)
      }
    } else if (preguntaActual.tipoRespuesta === 'CONFIRMA') {
      const aceptadas = ['SI', 'NO', 'SÍ']
      if (!aceptadas.includes(respuesta.toUpperCase())) {
        await flowDynamic('❌ Responde solo con "SI" o "NO".')
        return gotoFlow(encuestaFlow)
      }
    }

    respuestas.push(respuesta)
    paso++

    if (paso >= preguntas.length) {
      await state.clear()
      const resumen = respuestas.map((r, i) => ❓ ${preguntas[i].pregunta}\n📝 ${r}).join('\n\n')

      const payload = respuestas.map((r, i) => ({
        idContacto: ctx.from,
        idEncuesta: preguntas[i].idEncuesta,
        idEmpresa: preguntas[i].idEmpresa,
        pregunta: preguntas[i].pregunta,
        respuesta: r,
        tipo: preguntas[i].tipoRespuesta,
        idPregunta: preguntas[i].id
      }))

      console.log('📦 Payload de respuestas:', payload)

      try {
        await axios.post('http://localhost:7003/guardar-respuestas', payload)
        await flowDynamic('📩 Tus respuestas fueron enviadas exitosamente.')

        await axios.post('http://localhost:7003/api', {
  numero: ctx.from,
  texto: 'finalizado'
})
        console.log('✅ Encuesta finalizada en backend.')
      } catch (e) {
        console.error('Error al guardar respuestas o finalizar encuesta:', e.message)
        await flowDynamic('⚠ Hubo un problema al guardar tus respuestas o cerrar la encuesta.')
      }

      await flowDynamic(despedida)
      await flowDynamic(✅ Tus respuestas:\n\n${resumen})
      return await flowDynamic('🎉 ¡Encuesta finalizada! Muchas gracias por tu tiempo y tu opinión.')
    }

    const siguiente = preguntas[paso]
    let mensaje = ${paso + 1}⃣ ${siguiente.pregunta}

    if (siguiente.textoIni && siguiente.tipoRespuesta === 'RANGO') {
      mensaje += \n*Califica del rango ${siguiente.rangoIni} al ${siguiente.rangoFin}*
      mensaje += \n${siguiente.textoIni.split('=').map(s => s.replace('-', ' - ').trim()).join('\n')}
    } else if (siguiente.textoIni) {
      mensaje += \n${siguiente.textoIni.split('=').map(s => s.replace('-', ' - ').trim()).join('\n')}
    }

    await state.update({ preguntas, respuestas, paso, despedida })
    await flowDynamic(mensaje)
    scheduleReminder(ctx.from, paso, state)
    return gotoFlow(encuestaFlow)
  })

const negacionFlow = addKeyword(negaciones)
  .addAction(async (ctx, { flowDynamic, state }) => {
    const { data } = await axios.get('http://localhost:7003/datos-encuesta')
    const { contactos } = data
    const usuario = contactos.find(u => u.num === ctx.from)

    if (!usuario) {
      await flowDynamic('❌ No se encontró una encuesta asignada para ti.')
      return
    }
    await state.clear()
    await flowDynamic('✅ Gracias por tu tiempo. Si deseas participar en otro momento, estaré disponible.')
    return
  })

const defaultFlow = addKeyword(EVENTS.WELCOME)
  .addAction(async (ctx, { flowDynamic, state }) => {
    if (!ctx.body || ctx.body.trim() === '') return

    const { data } = await axios.get('http://localhost:7003/datos-encuesta')
    const { contactos } = data
    const usuario = contactos.find(u => u.num === ctx.from)

    if (!usuario) {
      await flowDynamic('❌ No se encontró una encuesta asignada para ti.')
      return
    }

    await state.update({ paso: PRE_ENCUESTA })
    await flowDynamic('👋 ¡Hola! ¿Deseas participar en una breve encuesta? Responde sí o no para continuar.')
    console.log(🕒 Programando recordatorio para ${ctx.from}, paso ${PRE_ENCUESTA})
    scheduleReminder(ctx.from, PRE_ENCUESTA, state)
  })

const main = async () => {
  const adapterFlow = createFlow([encuestaFlow, negacionFlow, defaultFlow])
  const adapterDB = new Database()

  const { httpServer } = await createBot({
    flow: adapterFlow,
    provider,
    database: adapterDB
  })

  provider.server.get('/v1/prueba', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('✅ Ruta activa: /v1/prueba (GET)')
  })

  httpServer(+PORT)
}

main()
d