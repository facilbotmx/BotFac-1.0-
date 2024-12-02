const { Configuration, OpenAIApi } = require("openai");
require('dotenv').config();

const chat = async (prompt, text) => {
    console.log("API Key:", process.env.OPENAI_API_KEY);

    if (!process.env.OPENAI_API_KEY) {
        console.error("Error: API key de OpenAI no está configurada.");
        return "ERROR: API key no configurada";
    }

    try {
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);

        console.log("Enviando solicitud a OpenAI...");
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: text },
            ],
        });

        console.log("Contenido del mensaje:", completion.data.choices[0].message.content);
        return completion.data.choices[0].message.content;
    } catch (err) {
        console.error("Error al conectar con OpenAI:", err.message);
        return "ERROR: No se pudo conectar con OpenAI";
    }
};

module.exports = chat;
