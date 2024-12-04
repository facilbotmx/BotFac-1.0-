require('dotenv').config();
const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot');
const QRPortalWeb = require('@bot-whatsapp/portal');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MockAdapter = require('@bot-whatsapp/database/mock');
const Facturapi = require('facturapi').default;

// Inicializar FacturAPI con la clave de API
const facturapi = new Facturapi(process.env.FACTURAPI_KEY);

// Objeto para manejar el estado de los usuarios
const estadoUsuarios = {};

// Función para guardar el estado
function guardarEstado(usuario, nuevoEstado) {
    if (!estadoUsuarios[usuario]) {
        estadoUsuarios[usuario] = {};
    }
    estadoUsuarios[usuario] = { ...estadoUsuarios[usuario], ...nuevoEstado };
}

// Función para cargar el estado
function cargarEstado(usuario) {
    return estadoUsuarios[usuario] || {};
}

// Función para crear una factura con FacturAPI
async function crearFactura(cliente, productos) {
    try {
        const factura = await facturapi.invoices.create({
            customer: cliente,
            items: productos,
            payment_form: '03', // Forma de pago
            use: 'CP01', // Uso de CFDI 
        });

        // Enviar la factura por correo electrónico
        await facturapi.invoices.sendByEmail(factura.id);

        return factura;
    } catch (error) {
        console.error('Error al crear la factura:', error.response?.data || error.message);
        throw error;
    }
}

// Flujo principal de bienvenida
const flowPrincipal = addKeyword(EVENTS.WELCOME)
    .addAnswer('¡Bienvenido a FácilBotMx de Facturación! 🤖🧾')
   // .addAnswer('⚠️Recuerda que este es un Bot de demostración las facturas no tienen validez.⚠️')
    .addAnswer('🚨Esta es una Prueba REAL🚨')
    .addAnswer(
        'Puedes pedirme lo siguiente: ☺️\n- Escribe "factura" para generar una factura.🧾\n- Escribe "ayuda" para conocer más opciones.ℹ️',
    );

// Flujo para generar una factura con preguntas separadas
const flowGenerarFactura = addKeyword(['factura', 'generar factura'])
    .addAnswer('Vamos a generar tu factura. ¿Cuál es tu nombre completo? 🤔', { capture: true }, async (ctx) => {
        guardarEstado(ctx.from, { nombre: ctx.body });
    })
    .addAnswer('Gracias. Ahora, por favor, ingresa tu RFC. ☝🏻', { capture: true }, async (ctx) => {
        const estado = cargarEstado(ctx.from);
        guardarEstado(ctx.from, { ...estado, rfc: ctx.body });
    })
    .addAnswer('Perfecto. ¿Cuál es tu código postal? 📪', { capture: true }, async (ctx) => {
        const estado = cargarEstado(ctx.from);
        guardarEstado(ctx.from, { ...estado, codigoPostal: ctx.body });
    })
    .addAnswer('Por último, ¿a qué correo electrónico deseas que enviemos tu factura? ✉️', { capture: true }, async (ctx, ctxFn) => {
        const estado = cargarEstado(ctx.from);
        guardarEstado(ctx.from, { ...estado, email: ctx.body });

        const datosCompletos = cargarEstado(ctx.from);

        const cliente = {
            legal_name: datosCompletos.nombre,
            tax_id: datosCompletos.rfc,
            tax_system: '601', // Régimen fiscal
            email: datosCompletos.email,
            address: { zip: datosCompletos.codigoPostal },
        };

        const productos = [
            {
                quantity: 1,
                product: {
                    description: 'Valor Razonable',
                    product_key: '80101503', // Clave SAT genérica
                    price: 40.0,
                    unit_key: 'E48', // Unidad de medida
                },
            },
        ];

        try {
            const factura = await crearFactura(cliente, productos);
            await ctxFn.flowDynamic([
                '¡Factura generada exitosamente! 🎉🎉🎉',
                'La factura se ha enviado a tu correo electrónico, Revísalo ➡️✉️',
            ]);
        } catch (error) {
            await ctxFn.flowDynamic('Lo siento, hubo un error al generar tu factura ❌. Inténtalo de nuevo 👍🏻');
        } finally {
            // Limpia el estado del usuario si es necesario
            delete estadoUsuarios[ctx.from];

            // Enviar mensaje adicional para volver al flujo principal
            await ctxFn.flowDynamic(
                'Puedes volver a realizar otra prueba 👈🏻🤖'
            );
        }
    });

// Configuración del bot
async function main() {
    const adapterDB = new MockAdapter();
    const adapterFlow = createFlow([flowPrincipal, flowGenerarFactura]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    QRPortalWeb();
}

main();

