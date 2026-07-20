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
        district,
        preparingFor,
        currentPosition,
        previousCoaching,
        utmParameters = {},
      } = req.body;

      // Basic validation
      if (!fullName || !whatsAppNumber || !district || !preparingFor || !currentPosition || !previousCoaching) {
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
        district,
        preparingFor,
        currentPosition,
        previousCoaching,
        utmSource: utmParameters.utm_source || "",
        utmMedium: utmParameters.utm_medium || "",
        utmCampaign: utmParameters.utm_campaign || "",
        utmContent: utmParameters.utm_content || "",
        utmTerm: utmParameters.utm_term || "",
        landingPageUrl: utmParameters.landing_page_url || "",
      };

      if (!isDuplicate) {
        registrations.push(newLead);
        fs.writeFileSync(DATA_FILE, JSON.stringify(registrations, null, 2));
      }

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
            timestamp,
            fullName,
            whatsAppNumber,
            district,
            preparingFor,
            currentPosition,
            previousCoaching,
            utmParameters.utm_source || "",
            utmParameters.utm_medium || "",
            utmParameters.utm_campaign || "",
            utmParameters.landing_page_url || ""
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
      } else {
        // Fallback to Google Sheets Webhook / Apps Script if configured in environment
        const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
        if (webhookUrl && webhookUrl.trim() !== "") {
          console.log(`[Sheets Webhook] Attempting to forward lead to Webhook URL: ${webhookUrl}`);
          try {
            const sheetPayload = {
              timestamp,
              fullName,
              whatsAppNumber,
              district,
              preparingFor,
              currentPosition,
              previousCoaching,
              utmSource: utmParameters.utm_source || "",
              utmMedium: utmParameters.utm_medium || "",
              utmCampaign: utmParameters.utm_campaign || "",
              utmContent: utmParameters.utm_content || "",
              utmTerm: utmParameters.utm_term || "",
              landingPageUrl: utmParameters.landing_page_url || "",
            };

            const response = await fetch(webhookUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(sheetPayload),
            });

            console.log(`[Sheets Webhook] Response Status: ${response.status} ${response.statusText}`);

            if (response.ok) {
              sheetStatus = "success";
              console.log(`[Sheets Webhook] Lead successfully logged to Google Sheet.`);
            } else {
              sheetStatus = `failed_status_${response.status}`;
              console.error(`[Sheets Webhook] Failed to log lead. Server returned non-200 response.`);
            }
          } catch (webhookError: any) {
            console.error("[Sheets Webhook] Network error forwarding to webhook:", webhookError);
            sheetStatus = `error: ${webhookError.message}`;
          }
        } else {
          console.warn(`[Sheets Direct / Webhook] No Sheets configuration or GOOGLE_SHEETS_WEBHOOK_URL found. Lead saved locally in registrations.json only.`);
        }
      }

      return res.status(200).json({
        success: true,
        message: isDuplicate ? "Seat reserved already" : "Registration successful",
        sheetStatus,
        leadId: newLead.id,
      });
    } catch (error: any) {
      console.error("Registration endpoint error:", error);
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
        const headerRange = `${sheetTitle}!A1:K1`;
        const headers = [
          "Timestamp",
          "Full Name",
          "WhatsApp Number",
          "District",
          "Preparing For",
          "Current Position",
          "Previous Coaching",
          "UTM Source",
          "UTM Medium",
          "UTM Campaign",
          "Landing Page URL",
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
