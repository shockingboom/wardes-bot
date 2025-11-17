"use strict";
require("dotenv").config();
require("colors");
const express = require("express");
const qr = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

const config = {
  SERVER: {
    PORT: process.env.PORT || 6666,
    BASE_PATH: "/api",
  },
  WHATSAPP: {
    PUPPETEER_OPTIONS: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
};

function formatPhoneNumber(number) {
  let formatted = number.replace(/\D/g, "");
  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.slice(1);
  }
  return formatted;
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: config.WHATSAPP.PUPPETEER_OPTIONS,
});

function initializeWhatsApp() {
  client.on("qr", (qrCode) => {
    qr.generate(qrCode, { small: true });
    console.log("QR Code generated, scan it with your phone.");
  });

  client.on("authenticated", () => console.log("Authenticated successfully!"));
  client.on("ready", () => console.log("WhatsApp client is ready!"));

  client.on("message", async (message) => {
    if (message.body === "!ping") {
      await message.reply("pong");
    }
  });

  client.initialize();
}

async function sendWhatsAppMessage(phoneNumber, message) {
  const chatId = `${phoneNumber}@c.us`;
  await client.sendMessage(chatId, message);
  return { number: phoneNumber, message };
}

const app = express();
app.use(express.json());

app.post("/api/send-message", async (req, res) => {
  try {
    const { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({
        success: false,
        message: "Number and message are required",
      });
    }

    const formattedNumber = formatPhoneNumber(number);
    const result = await sendWhatsAppMessage(formattedNumber, message);

    res.json({
      success: true,
      message: "Message sent successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error sending message:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message,
    });
  }
});

(async () => {
  try {
    console.log("⚡".yellow + " Starting server...".cyan);

    app.listen(config.SERVER.PORT, () => {
      console.log(`Server running on port ${config.SERVER.PORT}`);
    });

    console.log("📱".yellow + " Initializing WhatsApp client...".cyan);
    initializeWhatsApp();

    console.log("✅ Server and WhatsApp client initialized!".green.bold);
  } catch (error) {
    console.error("❌ Error starting server:".red.bold, error.message.red);
    process.exit(1);
  }
})();