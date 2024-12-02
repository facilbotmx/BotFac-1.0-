const { createBot, createProvider, createFlow, addKeyword } = require('@bot-whatsapp/bot');
const BaileysProvider = require('@bot-whatsapp/provider/baileys');
const MockAdapter = require('@bot-whatsapp/database/mock');
const puppeteer = require('puppeteer');
require('dotenv').config();

// Función para rastrear guía usando Puppeteer
async function rastrearGuia(trackingNumber) {
    const trackingPrefix = ''; // Prefijo vacío

    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto('https://volarisy4.smartkargo.com/', { waitUntil: 'networkidle2' });

        // Ingresar el número de guía sin prefijo
        await page.type('#ctl00_ContentPlaceHolder1_txtPrefix', trackingPrefix);
        await page.type('#ctl00_ContentPlaceHolder1_txtTrack', trackingNumber);

        // Capturar ventana emergente al hacer clic en rastrear
        const [popup] = await Promise.all([
            new Promise(resolve => browser.once('targetcreated', async target => {
                const newPage = await target.page();
                if (newPage) {
                    await newPage.setDefaultTimeout(100000);
                    resolve(newPage);
                }
            })),
            page.click('#ctl00_ContentPlaceHolder1_btnTrack')
        ]);

        let data;
        if (popup) {
            await popup.waitForSelector('body', { timeout: 10000 });
            data = await popup.evaluate(() => document.body.innerText);
            console.log('Texto crudo recibido:', data); // Imprimir texto crudo en terminal
            await popup.close();
        } else {
            data = 'No se detectó información de la guía.';
        }

        await browser.close();
        return data;
    } catch (error) {
        console.error('Error al rastrear la guía:', error.message);
        return 'Ocurrió un error al rastrear la guía. Por favor, intenta de nuevo más tarde.';
    } finally {
        if (browser) await browser.close();
    }
}

// Función para procesar y formatear la información del rastreo
function procesarResultado(rawData) {
    // Última actividad
    const ultimaActividad = rawData.match(/Last Activity\s*([\s\S]*?)\n\n/)?.[1]?.trim() || 'Sin información';

    // Detalles de entrega: Buscar eventos relacionados con "Delivered"
    const detallesEntregaMatch = rawData.match(/Delivered at\s*(\w+)\s*[\s\S]*?\n\s*(\d{2}\/\d{2}\/\d{4}\s*\d{2}:\d{2})/) || [];
    const lugarEntrega = detallesEntregaMatch[1]?.trim() || 'Sin información';
    const fechaEntrega = detallesEntregaMatch[2]?.trim() || 'Sin información';

    // Información de reservación y aceptación
    const bookingInfoMatch = rawData.match(/Booking and Acceptance Information[\s\S]*?Booked\s*(.*)/);
    const acceptedInfoMatch = rawData.match(/Accepted\s*(.*)/);
    const booked = bookingInfoMatch?.[1]?.trim() || 'Sin información';
    const accepted = acceptedInfoMatch?.[1]?.trim() || 'Sin información';

    // Historial de estado
    const statusHistoryMatch = rawData.match(/Status History([\s\S]*?)Delivery Orders/);
    const statusHistory = statusHistoryMatch?.[1]?.trim().split('\n').filter(line => line.trim() !== '').map(line => `- ${line.trim()}`).join('\n') || 'Sin información';

    // Recibido por
    const recibidoPor = rawData.match(/Issued To\s*(?:\/\/)?\s*(.+)/)?.[1]?.trim() || 'Sin información';

    // Formatear el mensaje con emojis
    const mensajeFormateado = `
📍 *Última Actividad:*

${ultimaActividad}

📦 *Detalles de Entrega:*

- Lugar: ${lugarEntrega}
- Fecha y hora: ${fechaEntrega}

📑 *Información de Reservación y Aceptación:*

- Booked: ${booked}
- Accepted: ${accepted}

🕒 *Historial de Estado:*

${statusHistory}

🤝 *Recibido por:*

${recibidoPor}
    `;

    return mensajeFormateado;
}

// Flujo principal del bot
const flowRastreo = addKeyword(['hola', 'rastreo', 'iniciar'])
    .addAnswer(
        '¡Bienvenido al Bot de rastreo de guías! 🤖\n\nPor favor, envíame el número de guía que deseas rastrear.📦⬇️',
        { capture: true },
        async (ctx, ctxFn) => {
            const trackingNumber = ctx.body.trim();

            // Llamar a la función de Puppeteer para rastrear la guía
            const rawData = await rastrearGuia(trackingNumber);

            // Procesar y formatear el resultado
            const mensajeFormateado = procesarResultado(rawData);

            // Enviar respuesta al usuario
            await ctxFn.flowDynamic(mensajeFormateado);
        }
    )
    .addAnswer('Escribe rastreo para volver a buscar otra guía 🤖👍🏻');
 

// Configuración del bot
async function main() {
    const adapterDB = new MockAdapter();
    const adapterFlow = createFlow([flowRastreo]);
    const adapterProvider = createProvider(BaileysProvider);

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });
}

main();
