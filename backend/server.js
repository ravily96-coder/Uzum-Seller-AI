const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get("/", (req, res) => {
    res.json({
        status: "ok",
        service: "Uzum Seller AI Backend"
    });
});

app.post("/api/analyze", async (req, res) => {
    try {
        const { image, mimeType, sellerHint = "" } = req.body;

        if (!image) {
            return res.status(400).json({
                error: "Изображение не передано"
            });
        }

        if (!GEMINI_API_KEY) {
            return res.status(500).json({
                error: "GEMINI_API_KEY не настроен на сервере"
            });
        }

        const prompt = `
Ты — профессиональный AI-аналитик товаров для маркетплейса Uzum Market.

Проанализируй фотографию товара.

Определи только то, что можно reasonably определить по изображению.
Не выдумывай материал, состав, размеры или другие характеристики,
если их невозможно достоверно определить по фотографии.

Верни результат строго в JSON следующего вида:

{
  "productType": "",
  "category": "",
  "color": "",
  "material": "",
  "designFeatures": "",
  "visualFeatures": "",
  "confidence": {
    "productType": 0,
    "category": 0,
    "color": 0,
    "material": 0
  }
}

Числа confidence указывай от 0 до 100.

Дополнительная информация от продавца:
${sellerHint}
`;

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
            encodeURIComponent(GEMINI_API_KEY),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: mimeType || "image/jpeg",
                                        data: image
                                    }
                                },
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.2
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Gemini API error:", data);

            return res.status(response.status).json({
                error: "Ошибка Gemini API",
                details: data
            });
        }

        const text =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return res.status(500).json({
                error: "Gemini не вернул результат"
            });
        }

        let result;

        try {
            result = JSON.parse(text);
        } catch (parseError) {
            console.error("JSON parse error:", text);

            return res.status(500).json({
                error: "Gemini вернул некорректный JSON",
                raw: text
            });
        }

        res.json(result);

    } catch (error) {
        console.error("Server error:", error);

        res.status(500).json({
            error: "Внутренняя ошибка сервера",
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Uzum Seller AI backend запущен на порту ${PORT}`);
});
