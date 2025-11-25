/**
 * WhatsApp Web API Server
 * 
 * Server Express.js yang menyediakan API endpoint untuk mengirim pesan WhatsApp
 * menggunakan whatsapp-web.js library dengan Puppeteer headless browser.
 * 
 * @author Your Name
 * @version 1.0.0
 */

"use strict";

// Load environment variables dari file .env
require("dotenv").config();
// Library untuk colorized console output
require("colors");

const express = require("express");
const qr = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

/**
 * Konfigurasi aplikasi
 * @constant {Object} config - Object konfigurasi utama
 */
const config = {
  SERVER: {
    // Port server, default 6666 jika PORT tidak ada di environment variable
    PORT: process.env.PORT || 6666,
    // Base path untuk semua API endpoints
    BASE_PATH: "/api",
  },
  WHATSAPP: {
    PUPPETEER_OPTIONS: {
      // Jalankan browser dalam mode headless (tanpa GUI)
      headless: true,
      // Arguments untuk Chrome/Chromium, diperlukan untuk Docker environment
      args: [
        "--no-sandbox",              // Disable sandbox untuk Docker
        "--disable-setuid-sandbox"   // Disable setuid sandbox
      ],
    },
  },
};

/**
 * Flag untuk tracking kesiapan WhatsApp client
 * @type {boolean}
 */
let isClientReady = false;

/**
 * Format nomor telepon ke format internasional WhatsApp
 * 
 * Mengubah nomor telepon Indonesia dari format lokal (08xxx) 
 * ke format internasional (628xxx) dan menghapus semua karakter non-digit.
 * 
 * @param {string} number - Nomor telepon yang akan diformat
 * @returns {string} Nomor telepon dalam format internasional
 * 
 * @example
 * formatPhoneNumber("0812-3456-7890") // Returns: "6281234567890"
 * formatPhoneNumber("62812 3456 7890") // Returns: "6281234567890"
 */
function formatPhoneNumber(number) {
  // Hapus semua karakter non-digit (spasi, dash, dll)
  let formatted = number.replace(/\D/g, "");
  
  // Jika nomor dimulai dengan 0, ganti dengan kode negara Indonesia (62)
  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.slice(1);
  }
  
  return formatted;
}

/**
 * Inisialisasi WhatsApp Web Client
 * Menggunakan LocalAuth strategy untuk menyimpan session secara lokal
 */
const client = new Client({
  // Strategy autentikasi menggunakan penyimpanan lokal
  authStrategy: new LocalAuth(),
  // Konfigurasi Puppeteer untuk headless browser
  puppeteer: config.WHATSAPP.PUPPETEER_OPTIONS,
});

/**
 * Inisialisasi dan setup event handlers untuk WhatsApp client
 * 
 * Fungsi ini mengatur semua event listener yang diperlukan:
 * - QR Code generation untuk autentikasi
 * - Authenticated event
 * - Ready event (client siap menerima/mengirim pesan)
 * - Disconnected event (handle koneksi terputus)
 * - Message event (handle pesan masuk)
 * - Loading screen event (tracking progress)
 * - Auth failure event (handle error autentikasi)
 * 
 * @function initializeWhatsApp
 */
function initializeWhatsApp() {
  /**
   * Event: QR Code generated
   * Dipicu saat WhatsApp memerlukan scan QR code untuk autentikasi
   * 
   * @param {string} qrCode - QR code string untuk di-scan
   */
  client.on("qr", (qrCode) => {
    // Generate QR code di terminal dalam format kecil
    qr.generate(qrCode, { small: true });
    console.log("🔐 QR Code generated, scan it with your phone.".yellow);
    console.log("⏳ Waiting for scan...".cyan);
  });

  /**
   * Event: Loading screen
   * Dipicu saat WhatsApp sedang memuat data
   * Berguna untuk tracking progress
   */
  client.on("loading_screen", (percent, message) => {
    console.log(`⏳ Loading: ${percent}% - ${message}`.cyan);
  });

  /**
   * Event: Authenticated
   * Dipicu setelah QR code berhasil di-scan dan autentikasi berhasil
   */
  client.on("authenticated", () => {
    console.log("✅ Authenticated successfully!".green);
    console.log("⏳ Loading WhatsApp data...".cyan);
  });

  /**
   * Event: Auth failure
   * Dipicu jika autentikasi gagal
   */
  client.on("auth_failure", (msg) => {
    console.error("❌ Authentication failure:".red, msg);
    isClientReady = false;
  });

  /**
   * Event: Ready
   * Dipicu saat client sudah sepenuhnya siap untuk mengirim/menerima pesan
   * PENTING: Ini adalah saat yang tepat untuk mulai mengirim pesan
   */
  client.on("ready", () => {
    console.log("✅ WhatsApp client is ready!".green.bold);
    console.log("📱 You can now send messages via API".green);
    // Set flag ready menjadi true
    isClientReady = true;
  });

  /**
   * Event: Disconnected
   * Dipicu saat koneksi WhatsApp terputus
   * 
   * @param {string} reason - Alasan disconnection
   */
  client.on("disconnected", (reason) => {
    console.log("⚠️  Client disconnected:".yellow, reason);
    console.log("🔄 Attempting to reconnect...".cyan);
    // Set flag ready menjadi false karena client tidak siap
    isClientReady = false;
  });

  /**
   * Event: Message
   * Dipicu saat ada pesan masuk
   * 
   * @param {Message} message - Object pesan yang diterima
   */
  client.on("message", async (message) => {
    // Auto-reply untuk command !ping
    if (message.body === "!ping") {
      await message.reply("pong");
    }
  });

  /**
   * Event: Remote session saved
   * Dipicu saat session berhasil disimpan
   */
  client.on("remote_session_saved", () => {
    console.log("💾 Session saved successfully".green);
  });

  // Mulai inisialisasi client
  console.log("🚀 Initializing WhatsApp client...".cyan);
  client.initialize().catch(err => {
    console.error("❌ Failed to initialize client:".red, err);
    isClientReady = false;
  });
}

/**
 * Kirim pesan WhatsApp ke nomor tertentu
 * 
 * Fungsi ini melakukan validasi kesiapan client dan verifikasi nomor
 * sebelum mengirim pesan ke WhatsApp.
 * 
 * @async
 * @param {string} phoneNumber - Nomor telepon tujuan (format internasional)
 * @param {string} message - Isi pesan yang akan dikirim
 * @returns {Promise<Object>} Object berisi nomor dan pesan yang terkirim
 * @throws {Error} Jika client belum ready atau nomor tidak terdaftar di WhatsApp
 * 
 * @example
 * await sendWhatsAppMessage("6281234567890", "Hello World!")
 * // Returns: { number: "6281234567890", message: "Hello World!" }
 */
async function sendWhatsAppMessage(phoneNumber, message) {
  // Validasi: Pastikan client sudah ready
  if (!isClientReady) {
    throw new Error("WhatsApp client is not ready yet. Please wait.");
  }

  // Format chat ID sesuai dengan format WhatsApp Web
  const chatId = `${phoneNumber}@c.us`;
  
  /**
   * Verifikasi apakah nomor terdaftar di WhatsApp
   * getNumberId() akan return null jika nomor tidak terdaftar
   */
  const numberId = await client.getNumberId(chatId);
  if (!numberId) {
    throw new Error(`Number ${phoneNumber} is not registered on WhatsApp`);
  }

  // Kirim pesan menggunakan serialized ID yang sudah diverifikasi
  await client.sendMessage(numberId._serialized, message);
  
  // Return data konfirmasi
  return { number: phoneNumber, message };
}

/**
 * Inisialisasi Express application
 */
const app = express();

/**
 * Middleware: Parse JSON request body
 */
app.use(express.json());

/**
 * API Endpoint: Health Check
 * 
 * Endpoint untuk mengecek status server dan WhatsApp client.
 * Berguna untuk monitoring dan debugging.
 * 
 * @route GET /api/health
 * @returns {Object} JSON response dengan status client dan info debug
 * 
 * @example
 * Response:
 * {
 *   "success": true,
 *   "status": "ready",
 *   "timestamp": "2024-01-15T10:30:00.000Z",
 *   "clientState": "CONNECTED",
 *   "info": "Client is ready to send messages"
 * }
 */
app.get("/api/health", async (req, res) => {
  try {
    // Cek state client untuk debugging
    const state = await client.getState().catch(() => null);
    
    res.json({
      success: true,
      status: isClientReady ? "ready" : "not ready",
      clientState: state || "UNKNOWN",
      timestamp: new Date().toISOString(),
      info: isClientReady 
        ? "Client is ready to send messages" 
        : "Client is still initializing. Please wait or check logs for QR code.",
    });
  } catch (error) {
    res.json({
      success: false,
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * API Endpoint: Logout/Reset Session
 * 
 * Endpoint untuk logout dan menghapus session WhatsApp.
 * Berguna jika ada masalah dengan session atau ingin scan QR code ulang.
 * 
 * @route POST /api/logout
 * @returns {Object} JSON response
 */
app.post("/api/logout", async (req, res) => {
  try {
    await client.logout();
    isClientReady = false;
    
    console.log("🔄 Client logged out. Reinitializing...".yellow);
    
    // Reinitialize after logout
    setTimeout(() => {
      initializeWhatsApp();
    }, 2000);
    
    res.json({
      success: true,
      message: "Logged out successfully. Please scan QR code again.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to logout",
      error: error.message,
    });
  }
});

/**
 * API Endpoint: Send WhatsApp Message
 * 
 * Endpoint untuk mengirim pesan WhatsApp ke nomor tertentu.
 * Melakukan validasi input, format nomor, dan verifikasi kesiapan client.
 * 
 * @route POST /api/send-message
 * @param {Object} req.body - Request body
 * @param {string} req.body.number - Nomor telepon tujuan
 * @param {string} req.body.message - Isi pesan
 * @returns {Object} JSON response
 * 
 * @example
 * Request:
 * POST /api/send-message
 * {
 *   "number": "08123456789",
 *   "message": "Hello World!"
 * }
 * 
 * Success Response (200):
 * {
 *   "success": true,
 *   "message": "Message sent successfully",
 *   "data": {
 *     "number": "6281234567890",
 *     "message": "Hello World!"
 *   }
 * }
 * 
 * Error Response (400 - Bad Request):
 * {
 *   "success": false,
 *   "message": "Number and message are required"
 * }
 * 
 * Error Response (503 - Service Unavailable):
 * {
 *   "success": false,
 *   "message": "WhatsApp client is not ready yet. Please try again in a few moments."
 * }
 * 
 * Error Response (500 - Internal Server Error):
 * {
 *   "success": false,
 *   "message": "Failed to send message",
 *   "error": "Number 6281234567890 is not registered on WhatsApp"
 * }
 */
app.post("/api/send-message", async (req, res) => {
  try {
    // Destructure request body
    const { number, message } = req.body;

    /**
     * Validasi: Pastikan number dan message ada di request
     */
    if (!number || !message) {
      return res.status(400).json({
        success: false,
        message: "Number and message are required",
      });
    }

    /**
     * Validasi: Pastikan client sudah ready sebelum memproses request
     * Return 503 (Service Unavailable) jika belum ready
     */
    if (!isClientReady) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp client is not ready yet. Please try again in a few moments.",
      });
    }

    // Format nomor telepon ke format internasional
    const formattedNumber = formatPhoneNumber(number);
    
    // Kirim pesan WhatsApp
    const result = await sendWhatsAppMessage(formattedNumber, message);

    // Return success response
    res.json({
      success: true,
      message: "Message sent successfully",
      data: result,
    });
    
  } catch (error) {
    // Log error untuk debugging
    console.error("Error sending message:", error);
    
    // Return error response
    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message,
    });
  }
});

/**
 * Main Application Entry Point
 * 
 * IIFE (Immediately Invoked Function Expression) untuk:
 * 1. Start Express server
 * 2. Initialize WhatsApp client
 * 3. Handle startup errors
 */
(async () => {
  try {
    // Log: Starting server
    console.log("⚡".yellow + " Starting server...".cyan);
    
    /**
     * Start Express server pada port yang ditentukan
     */
    app.listen(config.SERVER.PORT, () => {
      console.log(`Server running on port ${config.SERVER.PORT}`);
    });

    // Log: Initializing WhatsApp client
    console.log("📱".yellow + " Initializing WhatsApp client...".cyan);
    
    /**
     * Initialize WhatsApp client
     * Client akan mulai proses autentikasi (QR code atau session)
     */
    initializeWhatsApp();

    // Log: Success
    console.log("✅ Server initialized! Waiting for WhatsApp client to be ready...".green.bold);
    
  } catch (error) {
    // Log error dan exit process jika startup gagal
    console.error("❌ Error starting server:".red.bold, error.message.red);
    process.exit(1);
  }
})();
