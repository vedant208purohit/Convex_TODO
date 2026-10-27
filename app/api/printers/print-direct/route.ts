import { NextResponse } from "next/server";
import net from "net";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Standard ESC/POS Constants
const ESC = "\x1b";
const GS = "\x1d";

function convertTextToEscPos(receiptStr: string): Buffer {
  const lines = receiptStr.split("\n");
  let output = ESC + "@"; // ESC @: Initialize printer
  output += ESC + "!\x00"; // Normal font size

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      output += "\n";
      continue;
    }

    const isCentered =
      (line.startsWith("    ") && line.endsWith("    ")) ||
      trimmed === "ORDER INVOICE" ||
      trimmed === "TAX INVOICE" ||
      trimmed === "CUSTOMER DETAILS" ||
      trimmed === "ORDER DETAILS" ||
      trimmed === "ORDER SUMMARY" ||
      trimmed === "BILL DETAILS" ||
      trimmed === "PAYMENT DETAILS" ||
      trimmed === "FOOD RUNNER / ASSEMBLY SLIP" ||
      trimmed === "PLATE ASSEMBLY CHECKLIST" ||
      trimmed === "VERIFY ALL ITEMS BEFORE DISPATCH" ||
      trimmed === "KITCHEN ORDER TICKET (KOT)" ||
      trimmed.startsWith("Thank you");

    if (isCentered) {
      output += ESC + "a\x01"; // ESC a 1: Center
      output += trimmed + "\n";
      output += ESC + "a\x00"; // ESC a 0: Left
    } else {
      output += line + "\n";
    }
  }

  output += "\n\n\n\n" + GS + "V\x00"; // Feed and Full Cut
  return Buffer.from(output, "utf-8");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      receiptStr,
      printerType = "Bluetooth",
      printerUrl = "Printer001",
      printerPort = "BT",
    } = body;

    if (!receiptStr) {
      return NextResponse.json({ success: false, error: "No receipt content provided" }, { status: 400 });
    }

    const escPosBuffer = convertTextToEscPos(receiptStr);

    // 1. LAN PRINTER: Direct Raw TCP Socket (Port 9100)
    if (printerType === "Lan") {
      const host = printerUrl.trim().replace(/^https?:\/\//i, "").split(":")[0];
      const port = parseInt((printerPort || "9100").toString().trim(), 10) || 9100;

      const sent = await new Promise<boolean>((resolve) => {
        const client = new net.Socket();
        client.setTimeout(3000);
        client.connect(port, host, () => {
          client.write(escPosBuffer, () => {
            client.end();
            resolve(true);
          });
        });
        client.on("error", () => {
          client.destroy();
          resolve(false);
        });
        client.on("timeout", () => {
          client.destroy();
          resolve(false);
        });
      });

      if (sent) {
        return NextResponse.json({ success: true, method: "lan_socket" });
      }
      return NextResponse.json({ success: false, error: `Could not reach LAN printer at ${host}:${port}` });
    }

    // 2. BLUETOOTH PRINTER: ONLY when explicitly printerType === 'Bluetooth' or printerPort === 'BT'
    if (printerType === "Bluetooth" || printerPort === "BT") {
      if (process.platform === "win32") {
        const tempFile = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
        fs.writeFileSync(tempFile, escPosBuffer);

        const comSuccess = await new Promise<boolean>((resolve) => {
          const psCommand = `
            try {
              $bytes = [System.IO.File]::ReadAllBytes('${tempFile.replace(/\\/g, "\\\\")}');
              $sp = New-Object System.IO.Ports.SerialPort 'COM8', 9600, 'None', 8, 'One';
              $sp.ReadTimeout = 2000;
              $sp.WriteTimeout = 2000;
              $sp.Open();
              $sp.Write($bytes, 0, $bytes.Length);
              Start-Sleep -Milliseconds 400;
              $sp.Close();
              exit 0;
            } catch {
              exit 1;
            }
          `;
          exec(`powershell -Command "${psCommand.replace(/\r?\n/g, " ")}"`, (err) => {
            resolve(!err);
          });
        });

        try { fs.unlinkSync(tempFile); } catch {}

        if (comSuccess) {
          return NextResponse.json({ success: true, method: "windows_bluetooth_com8" });
        }
      }
      return NextResponse.json({ success: false, error: "Bluetooth printer on COM8 was not reachable." });
    }

    // 3. USB PRINTER: Out-Printer forces 10 CPI text with 0.75-inch margins that truncates text into 16-col wraps.
    // Return fallback so browser iframe prints at full 48-col width using Consolas 10px.
    if (printerType === "Usb") {
      return NextResponse.json({ success: false, message: "Fallback to browser print mechanism for USB POS printers." });
    }

    return NextResponse.json({ success: false, message: "Fallback to browser print mechanism." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}
