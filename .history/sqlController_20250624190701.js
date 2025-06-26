const sql = require('mssql');
const { poolPromise, sqlConfig } = require('./config/config.js');
const wsResponse = require('./controllers/wsResponse.js');

const sqlController = {};

sqlController.CARGA_ENCUESTA = async () => {
  try {
    let pool = await sql.connect(sqlConfig);
    let resultado = await pool.request().execute('[dbo].[SP_CARGA_ENCUESTA_ACTIVA]');
    await sql.close();
    return resultado.recordset;
  } catch (err) {
    console.error('Error al ejecutar el procedimiento:', err);
    return [];
  }
};

sqlController.CARGA_EMPRESA = async (idEmpresa, idEncuesta) => {
  try {
    let pool = await sql.connect(sqlConfig);
    let resultado = await pool.request()
      .input('empresa', sql.Int, idEmpresa)
      .input('encuesta', sql.Int, idEncuesta)
      .execute('[dbo].[SP_CARGA_EMPRESA]');
    await sql.close();
    return resultado.recordset;
  } catch (err) {
    console.error('Error al ejecutar el procedimiento:', err);
    return [];
  }
};

sqlController.CONSULTA_CLIENTE = async (idEmpresa) => {
  try {
    let pool = await sql.connect(sqlConfig);
    let resultado = await pool.request()
      .input('idEmpresa', sql.Int, idEmpresa)
      .execute('[dbo].[SP_CONSULTA_CLIENTE]');
    await sql.close();
    return resultado.recordset;
  } catch (err) {
    console.error('Error al ejecutar el procedimiento:', err);
    return [];
  }
};

sqlController.CARGA_DATOS_ENCUESTA_COMPLETO = async () => {
  try {
    let pool = await sql.connect(sqlConfig);
    let result = await pool.request().execute('[dbo].[SP_CARGA_DATOS_ENCUESTA_COMPLETO]');
    await sql.close();
    return {
      saludos: result.recordsets[0],
      contactos: result.recordsets[1],
      preguntas: result.recordsets[2]
    };
  } catch (err) {
    console.error('❌ Error al ejecutar SP_CARGA_DATOS_ENCUESTA_COMPLETO:', err);
    return { saludos: [], contactos: [], preguntas: [] };
  }
};

sqlController.GUARDAR_RESPUESTAS = async (req, res) => {
  const respuestas = req.body;
  if (!Array.isArray(respuestas) || respuestas.length === 0) {
    return res.status(400).json({ message: 'No se recibieron respuestas válidas.' });
  }
  try {
    const pool = await sql.connect(sqlConfig);
    for (const item of respuestas) {
     await pool.request()
  .input('idContacto', sql.NVarChar, item.idContacto)
  .input('respuesta', sql.NVarChar, item.respuesta)
  .input('pregunta', sql.NVarChar, item.pregunta)
  .input('tipo', sql.NVarChar, item.tipo)
  .input('idEncuesta', sql.Int, item.idEncuesta)
  .input('idEmpresa', sql.Int, item.idEmpresa)
  .input('idPregunta', sql.Int, item.idPregunta) // ✅ nuevo campo
  .execute('[dbo].[SP_INSERTAR_RESPUESTA]');

    }
    return res.status(200).json({ message: '✅ Respuestas guardadas correctamente.' });
  } catch (err) {
    console.error('❌ Error al guardar respuestas:', err);
    return res.status(500).json({ message: '❌ Error interno del servidor.' });
  }
};

sqlController.ENVIAR_RECORDATORIO = async (idEncuesta) => {
  try {
    const pool = await sql.connect(sqlConfig);
    const result = await pool.request()
      .input('idEncuesta', sql.Int, idEncuesta)
      .execute('[dbo].[SP_ENVIAR_RECORDATORIO]');
    await sql.close();
    return result.recordset;
  } catch (err) {
    console.error('❌ Error en ENVIAR_RECORDATORIO:', err);
    await sql.close();
    return [];
  } 
};

sqlController.OBTENER_CONTACTOS_PARA_RECORDATORIO = async () => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT c.num, c.nombre, e.idEncuesta, e.idEmpresa, e.id
    FROM tb_estadoEncuesta e
    JOIN contactos c ON e.idContacto = c.id
    WHERE e.estadoEncuesta = 'no iniciado'
      AND e.FechaRespuesta IS NULL
      AND e.FechaEnvioInicial IS NOT NULL
      AND e.FechaUltimoRecordatorio IS NULL
      AND DATEDIFF(HOUR, e.FechaEnvioInicial, GETDATE()) >= 24
  `);
  return result.recordset;
};

sqlController.MARCAR_RECORDATORIO_ENVIADO = async (idEstadoEncuesta) => {
  const pool = await poolPromise;
  await pool.request().query(`
    UPDATE tb_estadoEncuesta
    SET FechaUltimoRecordatorio = GETDATE()
    WHERE id = ${idEstadoEncuesta}
  `);
};

sqlController.MARCAR_FECHA_ENVIO_INICIAL = async (idContacto) => {
  const pool = await poolPromise;
  await pool.request().query(`
    UPDATE tb_estadoEncuesta
    SET FechaEnvioInicial = GETDATE()
    WHERE idContacto = ${idContacto}
  `);
};

sqlController.GESTIONAR_ESTADO_ENCUESTA = async (idEmpresa, idEncuesta, idContacto) => {
  const pool = await sql.connect(sqlConfig);
  await pool.request()
    .input('idEmpresa', sql.Int, idEmpresa)
    .input('idEncuesta', sql.Int, idEncuesta)
    .input('idContacto', sql.Int, idContacto)
    .execute('SP_GESTIONAR_ESTADO_ENCUESTA');
};

/**
 * Marca un contacto como respondido en contactos.estadoEncuesta = 1
 */
sqlController.marcarContactoRespondido = async (idContacto) => {
  try {
    const pool = await sql.connect(sqlConfig);
    await pool.request()
      .input('idContacto', sql.BigInt, idContacto)
      .query(`
        UPDATE contactos
          SET estadoEncuesta = 1
        WHERE id = @idContacto
      `);
    await sql.close();
  } catch (err) {
    console.error('❌ Error al marcar contacto respondido:', err);
  }
};




module.exports = sqlController;
