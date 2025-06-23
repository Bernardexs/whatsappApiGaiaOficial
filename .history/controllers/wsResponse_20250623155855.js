
const axios = require('axios');
const wsResponse = {};
const fs = require('fs');
const config1 = require('../config/config.js');
var ddd;
config1.waID.forEach(element => {
    
    if(element.wabaID=='100408852712996'){
        ddd = element.watsonURL
    }
});
//console.log(ddd)

//curl -X POST \
//'https://graph.facebook.com/v13.0/FROM_PHONE_NUMBER_ID/media' \
//-H 'Authorization: Bearer ACCESS_TOKEN' \
//-F 'file=@/local/path/file.jpg;type=image/jpeg' 
//-F 'messaging_product=whatsapp'

wsResponse.EnviaWsMedia1OLD = async(number1,numberId,doc,ca) =>{
    //let urlFb = 'https://graph.facebook.com/v13.0/' + numberId +'/messages';
    let urlFb = `https://graph.facebook.com/v21.0/${numberId}/messages`;

    console.log(urlFb,'url1');
 
    console.log(numberId,'numerobase');
        const config = {
            headers: { Authorization: `Bearer ${process.env.APITOKEN}`, 'Content-Type': 'application/json' }
            //headers: { Authorization: `Bearer `+process.env.APITOKEN}
        };
        console.log(config,'---config'); //Name: "documento" asi estaba antes
    
        const bodyParameters=JSON.parse( `{ 
            "messaging_product": "whatsapp", 
            "to": "` + number1 + `", 
            "type": "template", 
            "template": { 
            "name": "event_details_reminder_2",
            "language": { "code": "es" },
            "components": [
            {
                "type": "header",
                "parameters": [
                    {
                        "type": "document",
                        "document": {
                            "filename": "` + doc + `",
                            "link": "https://api.df1.app:2444/` + ca + `.pdf"
                        }
                    }
                ]
            },
            {
                "type": "body",
                "parameters": [
                    {
                        "type": "text",
                        "text": "` + doc + `"
                    }
                    
                ]
            }
        ]} }`);
        
         console.log(JSON.stringify(bodyParameters, null, 4));
               await axios.post( 
                urlFb,
                  bodyParameters,
                  config
                  ).then(async response =>  {
                    if (response.data){
                       
                        console.log('-----inicio0001Media-----' + JSON.stringify(response.data.messages[0].id) + '-------------------');
                        sqlController.mensajesEnviados(number1,numberId,doc,response.data.messages[0].id,"-")
                        
            
                    }
                
                
                }).catch(async response =>  {
                    console.log('-----inicioerr-----' + JSON.stringify(response) + '-------------------');
                    if (response.data){
                       
                        console.log('-----inicioerr-----' + JSON.stringify(response.data) + '-------------------');
                       
                        
            
                    }
                
                
                });

    
};
wsResponse.EnviaWsMedia1 = async(number1,numberId,doc) =>{
    let urlFb = 'https://graph.facebook.com/v13.0/' + numberId +'/messages';
    console.log(urlFb,'url1');
 
    console.log(numberId,'numerobase1');
        const config = {
            headers: { Authorization: `Bearer `+process.env.APITOKEN, 'Content-Type': 'application/json' }
        };
        console.log(doc,'---config1');

        try {
           
            let bodyParameters;
            if(doc.includes('.pdf')){
                bodyParameters=JSON.parse( `{ "messaging_product": "whatsapp", "to": "` + number1 + `", "type": "document", "document": { "link": "` + doc + `","filename": "Catalogo Oriental"}
                }`);
            }else{
                bodyParameters=JSON.parse( `{ "messaging_product": "whatsapp", "to": "` + number1 + `", "type": "image", "image": { "link": "` + doc + `","caption": "CHILILEE"}
                }`);
            }
            
            
            
            console.log(JSON.stringify(bodyParameters, null, 4))
            await axios.post( 
                urlFb,
                  bodyParameters,
                  config
                  ).then(async response =>  {
                    if (response.data){
                       
                        console.log('-----inicio0001Media-----' + JSON.stringify(response.data.messages[0].id) + '-------------------');
                        //sqlController.mensajesEnviados(number1,numberId,doc,response.data.messages[0].id,"-")
                        
            
                    }
                
                
                }).catch(async response =>  {
                    console.log('-----inicioerrmedia-----' + JSON.stringify(response) + '-------------------');
                    if (response.data){
                       
                        console.log('-----inicioerrmedia-----' + JSON.stringify(response.data) + '-------------------');
                    }
                });

        } catch (error) {
            console.log(error,'---error al generar bodyparametroz')
        }


      
        
     
}
wsResponse.EnviaWsMedia = async(number1,numberId,doc) =>{
    let urlFb = 'https://graph.facebook.com/v13.0/' + numberId +'/messages';
    console.log(urlFb,'url1');
 
    console.log(numberId,'numerobase');
        const config = {
            headers: { Authorization: `Bearer `+process.env.APITOKEN, 'Content-Type': 'application/json' }
        };
        console.log(doc,'---config');

        try {
            const bodyParameters=JSON.parse( `{ "messaging_product": "whatsapp", "recipient_type": "individual", "to": "` + number1 + `", "type": "image", "image": { "link": "` + doc + `"} }`);
            console.log(JSON.stringify(bodyParameters, null, 4))
            await axios.post( 
                urlFb,
                  bodyParameters,
                  config
                  ).then(async response =>  {
                    if (response.data){
                       
                        console.log('-----inicio0001Media-----' + JSON.stringify(response.data.messages[0].id) + '-------------------');
                        //sqlController.mensajesEnviados(number1,numberId,doc,response.data.messages[0].id,"-")
                        
            
                    }
                
                
                }).catch(async response =>  {
                    console.log('-----inicioerrmedia-----' + JSON.stringify(response) + '-------------------');
                    if (response.data){
                       
                        console.log('-----inicioerrmedia-----' + JSON.stringify(response.data) + '-------------------');
                    }
                });

        } catch (error) {
            console.log(error,'---error al generar bodyparametroz')
        }


      
        
     
}
wsResponse.EnviaWsMediaRapid = async(number1,numberId,doc) =>{
    let urlFb = 'https://graph.facebook.com/v13.0/' + numberId +'/messages';
    console.log(urlFb,'url1');
 
    console.log(numberId,'numerobase1');
        const config = {
            headers: { Authorization: `Bearer `+process.env.APITOKEN, 'Content-Type': 'application/json' }
        };
        console.log(doc,'---config1');

        try {
        
            const bodyParameters=JSON.parse( `{ "messaging_product": "whatsapp", "to": "` + number1 + `", "type": "template", "template": { "name": "` + doc + `", "language": { "code": "es" },"components": [
                {
                    "type": "header",
                    "parameters": [
                        
                    ]
                }
            ]} }`);
            
            
            console.log(JSON.stringify(bodyParameters, null, 4))
            await axios.post( 
                urlFb,
                  bodyParameters,
                  config
                  ).then(async response =>  {
                    if (response.data){
                       
                        console.log('-----inicio0001Media-----' + JSON.stringify(response.data.messages[0].id) + '-------------------');
                        //sqlController.mensajesEnviados(number1,numberId,doc,response.data.messages[0].id,"-")
                        
            
                    }
                
                
                }).catch(async response =>  {
                    console.log('-----inicioerrmedia-----' + JSON.stringify(response) + '-------------------');
                    if (response.data){
                       
                        console.log('-----inicioerrmedia-----' + JSON.stringify(response.data) + '-------------------');
                    }
                });

        } catch (error) {
            console.log(error,'---error al generar bodyparametroz')
        }


      
        
     
}
wsResponse.EnviaWsText = async(number1,text1,numberId) =>{
   
    let urlFb = 'https://graph.facebook.com/v22.0/' + numberId +'/messages'
    console.log(urlFb);
        const config = {
            headers: { Authorization: `Bearer `+process.env.APITOKEN, 'Content-Type': 'application/json' }
        };
       
        const bodyParameters = {
            messaging_product : 'whatsapp',
            to : number1,
            
            type : 'template',
            template: {
                "name": "saludo_gaia",
                "language": {
                    "code": "es_MX"
                }
                 
            }
           
        };
        
       await axios.post( 
        urlFb,
          bodyParameters,
          config
          ).then(async response =>  {
            console.log('-----inicio0001-----' + JSON.stringify(response) + '-------------------');
            if (response.data){
               
                console.log('-----inicio0001-----' + JSON.stringify(response.data) + '-------------------');
               
                
    
            }
        
        
        }).catch(async response =>  {
            console.log('-----inicioerr-----' + JSON.stringify(response) + '-------------------');
            if (response.data){
               
                console.log('-----inicioerr-----' + JSON.stringify(response.data) + '-------------------');
               
                
    
            }
        
        
        });


}

wsResponse.EnviarRecordatorioPlantilla = async (numero, nombre) => {
  const payload = {
    messaging_product: 'whatsapp',
    to: numero,
    type: 'template',
    template: {
      name: 'recordatorio_encuesta',
      language: { code: 'es_MX' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: nombre }
        ]
      }]
    }
  };

  try {
    await axios.post(
      'https://graph.facebook.com/v22.0/100408852712996/messages'
,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.APITOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Recordatorio enviado a ${numero}`);
  } catch (err) {
    console.error(`❌ Error al enviar recordatorio a ${numero}:`, err.response?.data || err.message);
  }
};



wsResponse.EnviaWsOptions = async(number1,text1,numberId) =>{
    let urlFb = 'https://graph.facebook.com/v13.0/' + numberId +'/messages'
    console.log(urlFb);

    const config = {
        headers: { Authorization: `Bearer `+ process.env.APITOKEN, 'Content-Type': 'application/json' }
    };
    let encabezado = text1.description.split('|');
    console.log(encabezado[2]);
    
let opciones = [];

for(var x=0;x<text1.options.length;x++){
    let iniFrase = text1.options[x].label.split("|")
    opciones.push({"id": text1.options[x].value.input.text,
    "title": iniFrase[0],"description": iniFrase[1]})
}


    const bodyParameters = {
        
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": number1,
            "type": "interactive",
            "interactive": {
              "type": "list",
              "header": {
                "type": "text",
                "text": text1.title
              },
              "body": {
                "text": encabezado[0]
              },
              "footer": {
                "text": encabezado[1]
              },
              "action": {
                "button": 'PRESIONE AQUI',
                "sections": [
                  {
                    "title": encabezado[2],
                    "rows": opciones
                  }]
              }
            }
          
    };
    console.log(JSON.stringify(bodyParameters));
   await axios.post( 
    urlFb,
      bodyParameters,
      config
      ).then(async response =>  {
        console.log('-----inicio-----' + JSON.stringify(response) + '-------------------');
        if (response.data){
           
            console.log('-----inicio-----' + JSON.stringify(response.data) + '-------------------');
           
            

        }
    
    
    }).catch(async response =>  {
        console.log('-----error1-----' + JSON.stringify(response) + '-------------------');
        if (response.data){
           
            console.log('-----error1-----' + JSON.stringify(response.data) + '-------------------');
           
            

        }
    
    
    });



}
wsResponse.EnviaWatson = async(idWhatsapp,texto,numberEntry) =>{
    let watsonUrl = 'http://192.168.88.4:8020/watson'
    // config1.waID.forEach(element => {
    //     if(element.wabaID==numberEntry){
    //         watsonUrl = element.watsonURL
    //     }
    // });


console.log("solicito a watson")
    const config = {
        headers: { 'Content-Type': 'application/json' }
    };
    const bodyParameters = {
        intanciaWhatsapp : 1,
            textMensajeReq : texto,
            idChat : idWhatsapp,
            idCanal : 1
    };

   await axios.post( 
        watsonUrl,
        bodyParameters,
        config
      ).then(async response =>  {
          console.log("DATA")
        console.log(response.data)
        
        if (response.data){
            
           // console.log(JSON.stringify(response.data));
            let count1 = response.data.respuesta.length;
            console.log("contador 1")
            console.log(count1);
            for(var i =0;i<count1;i++){
             //console.log(response.data[i].response_type);
             let tipoRespuesta =response.data.respuesta[i].response_type;
             console.log("tipo de respuesta")
             console.log(tipoRespuesta)
             if (tipoRespuesta=='text'){
                let respuesta1 = response.data.respuesta[i].text;
              
                await wsResponse.EnviaWsText(idWhatsapp,respuesta1,numberEntry);
             }
             if (tipoRespuesta=='option'){
                 let respuesta1 = response.data.respuesta[i];
                 try {
                    await wsResponse.EnviaWsOptions(idWhatsapp,respuesta1,numberEntry);
            
                 } catch (error) {
                           let respuesta = respuesta1.title + '\n'
                    respuesta1.options.forEach(element => {
                   respuesta = respuesta + element.label + '\n'
               });
               await wsResponse.EnviaWsText(idWhatsapp,respuesta,numberEntry);
   
                 }
                    }

                    if (tipoRespuesta=='image'){
                        let respuesta1 = response.data.respuesta[i].source;
                      
                        await wsResponse.EnviaWsMedia1(idWhatsapp,numberEntry,respuesta1);
     

                     }else{
                        if (tipoRespuesta=='rapid'){
                            console.log(response.data.respuesta,'respuesta rapidddddddddddddddddddddddddddddddddddddddddddddddddd')
                            let respuesta1 = response.data[i].text;
                          
                            await wsResponse.EnviaWsMediaRapid(idWhatsapp,numberEntry,respuesta1);
            
                         }
                     }

                     

             //wsResponse.EnviaWsText
           }
            

        }
    
    
    }).catch(async response =>  {
        if (response.data){
           
            console.log('-----error2-----' + JSON.stringify(response.data) + '-------------------');
           
            

        }
    
    
    });
}

// Cambia la definición así:
// wsResponse.EnviarWsSaludo = async (datosUsuario, saludoEmpresa, res) => {
//     for (const user of datosUsuario) {
//         const payload = {
//             messaging_product: 'whatsapp',
//             to: user.num,
//             type: 'template',
//             template: {
//                 name: 'inicio_encuesta_gaia',
//                 language: { code: 'es_MX' },
//                 components: [
//                     {
//                         type: 'body',
//                         parameters: [
//                             { type: 'text', parameter_name: 'saludo', text: saludoEmpresa[0].saludo1 || 'Hola' },
//                             { type: 'text', parameter_name: 'nom_contacto', text: user.nombre || 'Usuario' },
//                             { type: 'text', parameter_name: 'presentacion' ,text: saludoEmpresa[0].saludo2 || 'Gracias por participar' }
//                         ]
//                     }
//                 ]
//             }
//         };

//         try {
//             const response = await axios.post(
//                 'https://graph.facebook.com/v22.0/100408852712996/messages',
//                 payload,
//                 {
//                     headers: {
//                         Authorization: `Bearer ${process.env.APITOKEN}`,
//                         'Content-Type': 'application/json'
//                     }
//                 }
//             );
//             console.log(`✅ Plantilla enviada a ${user.nombre}`);
//         } catch (err) {
//             console.error(`❌ Error con ${user.nombre}:`, err.response?.data || err.message);
//         }
//     }

//     // Ahora sí, puedes usar res aquí:
//     res.status(200).send('✅ Mensajes enviados correctamente');
// };

wsResponse.EnviarWsSaludo = async (datosUsuario, saludoEmpresa, res) => {
  for (const user of datosUsuario) {
    const saludo1      = saludoEmpresa[0].saludo1     || 'Hola';
    const nombre       = user.nombre                  || 'Usuario';
    const presentacion = saludoEmpresa[0].saludo2     || 'Gracias por participar';
    const saludoCompleto = `${saludo1} ${nombre}! ${presentacion}`;

    const payload = {
      messaging_product: 'whatsapp',
      to: user.num,
      type: 'template',
      template: {
        name: 'inicio_encuesta_chat',
        language: { code: 'es_MX' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: saludoCompleto }
            ]
          }
        ]
      }
    };

    try {
     // no se si esto dispara algo para que se ejecute algo en el otro servidor 
      await axios.post(
        `https://graph.facebook.com/v22.0/${PRO}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${process.env.APITOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Plantilla enviada a ${user.nombre}`);

      // 👇 Asegura que exista el registro en tb_estadoEncuesta
      //await sqlController.INSERTAR_ESTADO_ENCUESTA(user.idEmpresa, user.idEncuesta, user.idContacto);

      // 👇 Marca la fecha inicial si aún no existe
      //await sqlController.MARCAR_FECHA_ENVIO_INICIAL(user.idContacto);

    } catch (err) {
      console.error(`❌ Error con ${user.nombre}:`, err.response?.data || err.message);
      res.status(400).json({message: `Ocurrió un error: ${JSON.stringify(eror)}`})
    }
  }

  res.status(200).send('✅ Mensajes enviados correctamente');
};




wsResponse.RecordatorioWs = async (datosUsuario, res) => {
 
    for (const user of datosUsuario) {
        const payload = {
            messaging_product: 'whatsapp',
            to: user.num,
            type: 'template',
            template: {
                name: 'saludo_gaia',
                language: { code: 'es_MX' },
            }
        };

        try {
            const response = await axios.post(
                'https://graph.facebook.com/v22.0/100408852712996/messages',
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.APITOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`✅ Plantilla enviada a ${user.nombre}`);
        } catch (err) {
            console.error(`❌ Error con ${user.nombre}:`, err.response?.data || err.message);
            errores.push(user.nombre);
        }
    }
    // 🔥 Este es el retorno correcto
  return res.status(200).json({
    success: true,
    message: 'Mensajes enviados correctamente'
  });
};


module.exports= wsResponse