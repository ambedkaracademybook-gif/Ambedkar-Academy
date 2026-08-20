import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON requests
  app.use(express.json());

  // Ensure data folder exists
  const DATA_DIR = path.join(process.cwd(), "data");
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const DATA_FILE = path.join(DATA_DIR, "registrations.json");
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }

  // API Route: Register Lead
  app.post("/api/register", async (req, res) => {
    try {
      const {
        fullName,
        whatsAppNumber,
        preparingFor,
        currentPosition,
        previousCoaching,
        location,
      } = req.body;

      // Basic validation
      if (!fullName || !whatsAppNumber || !preparingFor || !currentPosition || !previousCoaching) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      // Read current registrations
      let registrations = [];
      try {
        const fileContent = fs.readFileSync(DATA_FILE, "utf-8");
        registrations = JSON.parse(fileContent);
      } catch (e) {
        registrations = [];
      }

      // Check duplicate using whatsAppNumber
      const isDuplicate = registrations.some(
        (r: any) => r.whatsAppNumber === whatsAppNumber
      );

      const timestamp = new Date().toISOString();
      const newLead = {
        id: registrations.length + 1,
        timestamp,
        fullName,
        whatsAppNumber,
        preparingFor,
        currentPosition,
        previousCoaching,
        location: location || "",
      };

      if (isDuplicate) {
        console.log(`[Registration] Duplicate lead received: ${fullName} (${whatsAppNumber}). Skipping database append & Google Sheets sync.`);
        return res.status(200).json({
          success: true,
          message: "Seat reserved already",
          sheetStatus: "duplicate_skipped",
          leadId: -1,
        });
      }

      // If not duplicate, append to local JSON file
      registrations.push(newLead);
      fs.writeFileSync(DATA_FILE, JSON.stringify(registrations, null, 2));

      // Forward to Google Sheets (Direct OAuth Integration) or Webhook Fallback
      let sheetStatus = "not_configured";
      const SHEETS_CONFIG_FILE = path.join(DATA_DIR, "sheets_config.json");

      console.log(`[Registration] New lead received: ${fullName} (${whatsAppNumber})`);

      if (fs.existsSync(SHEETS_CONFIG_FILE)) {
        try {
          const config = JSON.parse(fs.readFileSync(SHEETS_CONFIG_FILE, "utf-8"));
          const { spreadsheetId, accessToken, sheetTitle = "Sheet1" } = config;

          console.log(`[Google Sheets Direct] Attempting to write lead to spreadsheet: ${spreadsheetId}`);

          const range = `${sheetTitle}!A:A`;
          const rowData = [
            fullName,
            whatsAppNumber,
            preparingFor,
            currentPosition,
            previousCoaching,
            location || "",
            timestamp,
          ];

          const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                values: [rowData],
              }),
            }
          );

          console.log(`[Google Sheets Direct] Response Status: ${response.status} ${response.statusText}`);

          if (response.ok) {
            sheetStatus = "success";
            console.log(`[Google Sheets Direct] Lead successfully logged to Google Sheet.`);
          } else {
            const errBody = await response.json().catch(() => ({}));
            sheetStatus = `failed_status_${response.status}`;
            console.error(`[Google Sheets Direct] Google Sheets API error:`, errBody);
          }
        } catch (sheetError: any) {
          console.error("[Google Sheets Direct] Error writing to sheet:", sheetError);
          sheetStatus = `error: ${sheetError.message}`;
        }
      }

      // Fallback/direct attempt using Webhook if Direct Sync was not configured or if it failed (e.g. expired token)
      if (sheetStatus !== "success") {
        let configWebhook = "";
        if (fs.existsSync(SHEETS_CONFIG_FILE)) {
          try {
            const cfg = JSON.parse(fs.readFileSync(SHEETS_CONFIG_FILE, "utf-8"));
            configWebhook = cfg.webhookUrl || "";
          } catch (e) {}
        }
        const webhookUrl = (configWebhook || process.env.GOOGLE_SHEETS_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbxCTs_bMnrR3LV-UwSB9VOKtaQtW063tfeHNqi91XgivuFFivr-8njptAAobAwOVoMpdA/exec").trim();
        
        if (webhookUrl !== "") {
          console.log(`[Sheets Webhook] Attempting to forward lead to Webhook URL: ${webhookUrl} (Direct Status: ${sheetStatus})`);
          try {
            const sheetPayload = {
              fullName,
              whatsAppNumber,
              preparingFor,
              currentPosition,
              previousCoaching,
              location: location || "",
              timestamp: new Date().toLocaleString(),
            };

            const response = await fetch(webhookUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(sheetPayload),
              redirect: "follow",
            });

            console.log(`[Sheets Webhook] Response Status: ${response.status} ${response.statusText}`);

            if (response.ok || response.status === 302 || response.status === 200) {
              sheetStatus = "success";
              console.log(`[Sheets Webhook] Lead successfully logged to Google Sheet via Webhook.`);
            } else {
              sheetStatus = `${sheetStatus}_and_webhook_failed_status_${response.status}`;
              console.error(`[Sheets Webhook] Failed to log lead via Webhook.`);
            }
          } catch (webhookError: any) {
            console.error("[Sheets Webhook] Network error forwarding to webhook:", webhookError);
            sheetStatus = `${sheetStatus}_and_webhook_error_${webhookError.message}`;
          }
        } else {
          if (sheetStatus === "not_configured") {
            console.warn(`[Sheets Direct / Webhook] No Sheets configuration or GOOGLE_SHEETS_WEBHOOK_URL found. Lead saved locally in registrations.json only.`);
          } else {
            console.warn(`[Sheets Direct] Direct Sheets sync failed (${sheetStatus}) and no GOOGLE_SHEETS_WEBHOOK_URL fallback is configured.`);
          }
        }
      }

      // Dispatch WhatsApp message via AiSensy Campaign API
      let aiSensyStatus = "not_configured";
      const AISENSY_CONFIG_FILE = path.join(DATA_DIR, "aisensy_config.json");
      let aiSensyApiKey = process.env.AISENSY_API_KEY || "";
      if (!aiSensyApiKey && fs.existsSync(AISENSY_CONFIG_FILE)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(AISENSY_CONFIG_FILE, "utf-8"));
          aiSensyApiKey = cfg.apiKey || "";
        } catch (e) {}
      }

      if (aiSensyApiKey && aiSensyApiKey.trim() !== "") {
        try {
          const cleanNum = (whatsAppNumber || "").replace(/\D/g, "");
          const destination = cleanNum.length === 10 ? `91${cleanNum}` : cleanNum;

          const aiSensyPayload = {
            apiKey: aiSensyApiKey.trim(),
            campaignName: "thanks msg for registrents",
            destination,
            userName: fullName || "Ambedkar Academy",
            templateParams: [fullName || "Student"],
            source: "new-landing-page form",
            media: {
              url: "https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6353da2e153a147b991dd812/4958901_highanglekidcheatingschooltestmin.jpg",
              filename: "sample_media",
            },
            buttons: [],
            carouselCards: [],
            location: {},
            attributes: {},
            paramsFallbackValue: {},
          };

          console.log(`[AiSensy WhatsApp] Sending confirmation message to destination ${destination}...`);
          const aiSensyRes = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(aiSensyPayload),
          });

          const aiSensyData = await aiSensyRes.json().catch(() => ({}));
          console.log(`[AiSensy WhatsApp] Response (${aiSensyRes.status}):`, aiSensyData);
          if (aiSensyRes.ok) {
            aiSensyStatus = "success";
          } else {
            aiSensyStatus = `failed_${aiSensyRes.status}`;
          }
        } catch (aiSensyErr: any) {
          console.error("[AiSensy WhatsApp] Error sending message:", aiSensyErr);
          aiSensyStatus = `error_${aiSensyErr.message}`;
        }
      } else {
        console.log("[AiSensy WhatsApp] No AISENSY_API_KEY provided; skipping WhatsApp notification.");
      }

      return res.status(200).json({
        success: true,
        message: isDuplicate ? "Seat reserved already" : "Registration successful",
        sheetStatus,
        aiSensyStatus,
        leadId: newLead.id,
      });
    } catch (error: any) {
      console.error("Registration endpoint error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: AiSensy Config & Status
  app.get("/api/aisensy/config", (req, res) => {
    try {
      const AISENSY_CONFIG_FILE = path.join(DATA_DIR, "aisensy_config.json");
      let configured = Boolean(process.env.AISENSY_API_KEY && process.env.AISENSY_API_KEY.trim());
      let maskedKey = "";
      if (process.env.AISENSY_API_KEY) {
        const key = process.env.AISENSY_API_KEY.trim();
        maskedKey = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : "********";
      } else if (fs.existsSync(AISENSY_CONFIG_FILE)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(AISENSY_CONFIG_FILE, "utf-8"));
          if (cfg.apiKey && cfg.apiKey.trim()) {
            configured = true;
            const key = cfg.apiKey.trim();
            maskedKey = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : "********";
          }
        } catch (e) {}
      }
      return res.json({ success: true, isConfigured: configured, maskedKey });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Save AiSensy API Key
  app.post("/api/aisensy/save-key", (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({ success: false, error: "API key is required" });
      }
      const AISENSY_CONFIG_FILE = path.join(DATA_DIR, "aisensy_config.json");
      fs.writeFileSync(AISENSY_CONFIG_FILE, JSON.stringify({ apiKey: apiKey.trim(), updatedAt: new Date().toISOString() }, null, 2));
      return res.json({ success: true, message: "AiSensy API key saved successfully" });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Test AiSensy WhatsApp message
  app.post("/api/aisensy/test", async (req, res) => {
    try {
      const { destination, apiKey: overrideKey } = req.body;
      if (!destination) {
        return res.status(400).json({ success: false, error: "Destination phone number is required" });
      }
      const AISENSY_CONFIG_FILE = path.join(DATA_DIR, "aisensy_config.json");
      let activeKey = overrideKey || process.env.AISENSY_API_KEY || "";
      if (!activeKey && fs.existsSync(AISENSY_CONFIG_FILE)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(AISENSY_CONFIG_FILE, "utf-8"));
          activeKey = cfg.apiKey || "";
        } catch (e) {}
      }
      if (!activeKey) {
        return res.status(400).json({ success: false, error: "No AiSensy API key found. Please save a key or set AISENSY_API_KEY." });
      }

      const cleanNum = destination.replace(/\D/g, "");
      const formattedDest = cleanNum.length === 10 ? `91${cleanNum}` : cleanNum;

      const aiSensyPayload = {
        apiKey: activeKey.trim(),
        campaignName: "thanks msg for registrents",
        destination: formattedDest,
        userName: "Ambedkar Academy",
        templateParams: ["Aspirant"],
        source: "new-landing-page form",
        media: {
          url: "https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6353da2e153a147b991dd812/4958901_highanglekidcheatingschooltestmin.jpg",
          filename: "sample_media",
        },
        buttons: [],
        carouselCards: [],
        location: {},
        attributes: {},
        paramsFallbackValue: {},
      };

      const aiSensyRes = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiSensyPayload),
      });
      const data = await aiSensyRes.json().catch(() => ({}));
      return res.status(aiSensyRes.status).json({ success: aiSensyRes.ok, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Get Sheets Config
  app.get("/api/sheets/config", (req, res) => {
    try {
      const SHEETS_CONFIG_FILE = path.join(DATA_DIR, "sheets_config.json");
      if (fs.existsSync(SHEETS_CONFIG_FILE)) {
        const config = JSON.parse(fs.readFileSync(SHEETS_CONFIG_FILE, "utf-8"));
        return res.json({
          success: true,
          isConnected: true,
          spreadsheetId: config.spreadsheetId,
          spreadsheetUrl: config.spreadsheetUrl,
          sheetTitle: config.sheetTitle || "Sheet1",
          updatedAt: config.updatedAt,
        });
      }
      return res.json({ success: true, isConnected: false });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Connect / Setup Google Sheet
  app.post("/api/sheets/setup", async (req, res) => {
    try {
      const { accessToken, spreadsheetId: inputSpreadsheetId } = req.body;
      if (!accessToken) {
        return res.status(400).json({ success: false, error: "Access token is required" });
      }

      const SHEETS_CONFIG_FILE = path.join(DATA_DIR, "sheets_config.json");
      let spreadsheetId = inputSpreadsheetId;
      let spreadsheetUrl = "";
      let sheetTitle = "Sheet1";

      if (spreadsheetId) {
        // Verify and get existing spreadsheet info
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          return res.status(response.status).json({
            success: false,
            error: `Failed to retrieve spreadsheet: ${errData.error?.message || response.statusText}`,
          });
        }

        const data: any = await response.json();
        spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        sheetTitle = data.sheets?.[0]?.properties?.title || "Sheet1";
      } else {
        // Create new spreadsheet
        const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            properties: {
              title: "TNPSC Workshop Registrations 2026",
            },
          }),
        });

        if (!createResponse.ok) {
          const errData = await createResponse.json().catch(() => ({}));
          return res.status(createResponse.status).json({
            success: false,
            error: `Failed to create spreadsheet: ${errData.error?.message || createResponse.statusText}`,
          });
        }

        const data: any = await createResponse.json();
        spreadsheetId = data.spreadsheetId;
        spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        sheetTitle = data.sheets?.[0]?.properties?.title || "Sheet1";

        // Write header row to the newly created spreadsheet
        const headerRange = `${sheetTitle}!A1:F1`;
        const headers = [
          "Timestamp",
          "Full Name",
          "WhatsApp Number",
          "Preparing For",
          "Current Position",
          "Previous Coaching",
        ];

        const appendResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${headerRange}:append?valueInputOption=USER_ENTERED`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              values: [headers],
            }),
          }
        );

        if (!appendResponse.ok) {
          console.warn("[Sheets Setup] Header append failed:", appendResponse.statusText);
        }
      }

      // Save config locally
      const config = {
        spreadsheetId,
        spreadsheetUrl,
        sheetTitle,
        accessToken,
        updatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(SHEETS_CONFIG_FILE, JSON.stringify(config, null, 2));

      return res.json({
        success: true,
        message: inputSpreadsheetId ? "Connected to existing Google Sheet successfully" : "Created and connected new Google Sheet successfully",
        spreadsheetId,
        spreadsheetUrl,
        sheetTitle,
      });
    } catch (error: any) {
      console.error("Sheets setup error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Sync All Registrations to Google Sheet
  app.post("/api/sheets/sync-all", async (req, res) => {
    try {
      const { accessToken } = req.body;
      if (!accessToken) {
        return res.status(400).json({ success: false, error: "Access token is required" });
      }

      const SHEETS_CONFIG_FILE = path.join(DATA_DIR, "sheets_config.json");
      if (!fs.existsSync(SHEETS_CONFIG_FILE)) {
        return res.status(404).json({ success: false, error: "Google Sheets is not connected" });
      }

      const config = JSON.parse(fs.readFileSync(SHEETS_CONFIG_FILE, "utf-8"));
      const { spreadsheetId, sheetTitle = "Sheet1" } = config;

      // Read registrations
      let registrations = [];
      try {
        const fileContent = fs.readFileSync(DATA_FILE, "utf-8");
        registrations = JSON.parse(fileContent);
      } catch (e) {
        registrations = [];
      }

      if (registrations.length === 0) {
        return res.json({ success: true, message: "No registrations to sync.", syncedCount: 0 });
      }

      // Format data rows
      const rows = registrations.map((r: any) => [
        r.timestamp,
        r.fullName,
        r.whatsAppNumber,
        r.preparingFor,
        r.currentPosition,
        r.previousCoaching,
      ]);

      // Clear the sheet first to avoid duplicate or ghost entries
      const clearResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetTitle}!A2:F10000:clear`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!clearResponse.ok) {
        console.warn("[Sheets Sync] Clear range failed:", clearResponse.statusText);
      }

      // Write values to the sheet starting from A2
      const range = `${sheetTitle}!A2:F${1 + registrations.length}`;
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            values: rows,
          }),
        }
      );

      if (!updateResponse.ok) {
        const errData = await updateResponse.json().catch(() => ({}));
        return res.status(updateResponse.status).json({
          success: false,
          error: `Failed to write data: ${errData.error?.message || updateResponse.statusText}`,
        });
      }

      // Update the saved configuration with the latest active accessToken and updatedAt timestamp
      config.accessToken = accessToken;
      config.updatedAt = new Date().toISOString();
      fs.writeFileSync(SHEETS_CONFIG_FILE, JSON.stringify(config, null, 2));

      return res.json({
        success: true,
        message: `Successfully synced ${registrations.length} registrations to Google Sheet!`,
        syncedCount: registrations.length,
      });
    } catch (error: any) {
      console.error("Sheets sync-all error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Disconnect Sheets
  app.post("/api/sheets/disconnect", (req, res) => {
    try {
      const SHEETS_CONFIG_FILE = path.join(DATA_DIR, "sheets_config.json");
      if (fs.existsSync(SHEETS_CONFIG_FILE)) {
        fs.unlinkSync(SHEETS_CONFIG_FILE);
      }
      return res.json({ success: true, message: "Disconnected successfully" });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Get all registrations (For validation/viewing in development)
  app.get("/api/registrations", (req, res) => {
    try {
      const fileContent = fs.readFileSync(DATA_FILE, "utf-8");
      const registrations = JSON.parse(fileContent);
      res.json({ success: true, count: registrations.length, data: registrations });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite development middleware vs production static server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
