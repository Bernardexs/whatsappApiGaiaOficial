const axios = require('axios');
const fs = require('fs');
const config1 = require('../config/config.js');
const wsResponse = {};

let ddd;
config1.waID.forEach(element => {
    if (element.wabaID === '100408852712996') {
        ddd = element.watsonURL;
    }
});

// 🟢 Enviar media con documento usando plantilla con header
wsResponse.EnviaWsMedia1OLD = async (number1, numberId, doc, ca) => {
    let urlFb = `https://graph.facebook.com/v21.0/${numberId}/messages`;

    const config = {
        headers: {
            Authorization: `Bearer ${process.env.APITOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    const bodyParameters = {
        messaging_product: 'whatsapp',
        to: number1,
        type: 'template',
        template: {
            name: 'event_details_reminder_2',
            language: { code: 'es' },
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'document',
                            document: {
                                filename: doc,
                                link: `https://api.df1.app:2444/${ca}.pdf`
                            }
                        }
                    ]
                },
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            text: doc
                        }
                    ]
                }
            ]
        }
    };

    try {
        const response = await axios.post(urlFb, bodyParameters, config);
        if (response.data) {
            console.log('✅ Media enviada:', response.data.messages[0].id);
            // sqlController.mensajesEnviados(number1, numberId, doc, response.data.messages[0].id, "-");
        }
    } catch (error) {
        console.error('❌ Error enviando media:', error.response?.data || error.message);
    }
};

// 🟢 Media dinámica (imagen o PDF)
wsResponse.EnviaWsMedia1 = async (number1, numberId, doc) => {
    let urlFb = `https://graph.facebook.com/v13.0/${numberId}/messages`;
    const config = {
        headers: {
            Authorization: `Bearer ${process.env.APITOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    let bodyParameters;
    if (doc.includes('.pdf')) {
        bodyParameters = {
            messaging_product: 'whatsapp',
            to: number1,
            type: 'document',
            document: {
                link: doc,
                filename: 'Catalogo Oriental'
            }
        };
    } else {
        bodyParameters = {
            messaging_product: 'whatsapp',
            to: number1,
            type: 'image',
            image: {
                link: doc,
                caption: 'CHILILEE'
            }
        };
    }

    try {
        const response = await axios.post(urlFb, bodyParameters, config);
        if (response.data) {
            console.log('✅ Media enviada:', response.data.messages[0].id);
        }
    } catch (error) {
        console.error('❌ Error enviando media:', error.response?.data || error.message);
    }
};

// 🟢 Enviar texto simple
wsResponse.EnviaWsText = async (number1, text1, numberId) => {
    const urlFb = `https://graph.facebook.com/v22.0/${numberId}/messages`;
    const config = {
        headers: {
            Authorization: `Bearer ${process.env.APITOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    const bodyParameters = {
        messaging_product: 'whatsapp',
        to: number1,
        type: 'template',
        template: {
            name: 'saludo_gaia',
            language: {
                code: 'es_MX'
            }
        }
    };

    try {
        const response = await axios.post(urlFb, bodyParameters, config);
        console.log('✅ Texto enviado:', response.data);
    } catch (error) {
        console.error('❌ Error enviando texto:', error.response?.data || error.message);
    }
};

// 🟢 Enviar mensaje tipo lista (interactivo)
wsResponse.EnviaWsOptions = async (number1, text1, numberId) => {
    const urlFb = `https://graph.facebook.com/v13.0/${numberId}/messages`;
    const config = {
        headers: {
            Authorization: `Bearer ${process.env.APITOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    const encabezado = text1.description.split('|');
    const opciones = text1.options.map(opt => {
        const [title, description] = opt.label.split('|');
        return {
            id: opt.value.input.text,
            title,
            description
        };
    });

    const bodyParameters = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: number1,
        type: 'interactive',
        interactive: {
            type: 'list',
            header: {
                type: 'text',
                text: text1.title
            },
            body: {
                text: encabezado[0]
            },
            footer: {
                text: encabezado[1]
            },
            action: {
                button: 'PRESIONE AQUI',
                sections: [
                    {
                        title: encabezado[2],
                        rows: opciones
                    }
                ]
            }
        }
    };

    try {
        const response = await axios.post(urlFb, bodyParameters, config);
        console.log('✅ Opciones enviadas:', response.data);
    } catch (error) {
        console.error('❌ Error enviando opciones:', error.response?.data || error.message);
    }
};

// 🟢 Watson integration
wsResponse.EnviaWatson = async (idWhatsapp, texto, numberEntry) => {
    const watsonUrl = ddd || 'http://192.168.88.4:8020/watson';
    const config = {
        headers: { 'Content-Type': 'application/json' }
    };

    const bodyParameters = {
        intanciaWhatsapp: 1,
        textMensajeReq: texto,
        idChat: idWhatsapp,
        idCanal: 1
    };

    try {
        const response = await axios.post(watsonUrl, bodyParameters, config);
        const respuestas = response.data.respuesta;

        for (const item of respuestas) {
            switch (item.response_type) {
                case 'text':
                    await wsResponse.EnviaWsText(idWhatsapp, item.text, numberEntry);
                    break;
                case 'option':
                    try {
                        await wsResponse.EnviaWsOptions(idWhatsapp, item, numberEntry);
                    } catch (err) {
                        let respuesta = `${item.title}\n` + item.options.map(o => o.label).join('\n');
                        await wsResponse.EnviaWsText(idWhatsapp, respuesta, numberEntry);
                    }
                    break;
                case 'image':
                    await wsResponse.EnviaWsMedia1(idWhatsapp, numberEntry, item.source);
                    break;
                case 'rapid':
                    await wsResponse.EnviaWsMediaRapid(idWhatsapp, numberEntry, item.text);
                    break;
            }
        }
    } catch (error) {
        console.error('❌ Error en Watson:', error.response?.data || error.message);
    }
};

// 🟢 Enviar saludo personalizado
wsResponse.EnviarWsSaludo = async (datosUsuario, saludoEmpresa, res) => {
    for (const user of datosUsuario) {
        const saludo1 = saludoEmpresa[0].saludo1 || 'Hola';
        const nombre = user.nombre || 'Usuario';
        const presentacion = saludoEmpresa[0].saludo2 || 'Gracias por participar';
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
            await axios.post(
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
        }
    }

    res.status(200).send('✅ Mensajes enviados correctamente');
};

// 🟢 Recordatorio
wsResponse.RecordatorioWs = async (datosUsuario, res) => {
    const errores = [];

    for (const user of datosUsuario) {
        const payload = {
            messaging_product: 'whatsapp',
            to: user.num,
            type: 'template',
            template: {
                name: 'saludo_gaia',
                language: { code: 'es_MX' }
            }
        };

        try {
            await axios.post(
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

    return res.status(200).json({
        success: true,
        message: 'Mensajes enviados correctamente',
        errores
    });
};

module.exports = wsResponse;
