const sql = require('mssql');

const sqlConfig = {
  user: 'usergaia',
  password: 'Gaia2020*',
  server: '192.168.88.3',
  port: 8282,
  database: 'encuestasGaia_Prueba',
  options: {
    encrypt: true,
    enableArithAbort: true,
    trustServerCertificate: true
  }
};

const poolPromise = new sql.ConnectionPool(sqlConfig)
  .connect()
  .then(pool => {
    console.log('✅ Conexión a SQL Server establecida');
    return pool;
  })
  .catch(err => {
    console.error('❌ Error al conectar a la base de datos:', err);
  });

module.exports = {
  poolPromise,
  sqlConfig,
  waID: [
    {
      wabaID: '100408852712996',
      watsonURL: 'http://192.168.88.4:8020/watson'
    },
    {
      wabaID: '108812755302466',
      watsonURL: 'http://192.168.88.4:8020/watson'
    }
  ],
  config_Encuesta: {
    IdEmpresa: 22,
    IdEncuesta: 25,
    MsgRangoFirst: ''
  }
};
