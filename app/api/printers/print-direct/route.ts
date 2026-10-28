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

    // 3. USB PRINTER: Direct Win32 RAW Spooler (WritePrinter in RAW mode)
    // Sends exact ESC/POS binary directly to POS-80-USB without opening the browser dialog or driver margin wrapping
    if (printerType === "Usb" && process.platform === "win32") {
      const tempBin = path.join(os.tmpdir(), `receipt_usb_${Date.now()}.bin`);
      fs.writeFileSync(tempBin, escPosBuffer);

      const targetPrinterName = printerUrl && printerUrl !== "printer-80" ? printerUrl : "POS-80-USB";

      const psRawPrint = `
$cSharp = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
    public static bool SendFileToPrinter(string printerName, string filePath) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "ThermalRawDoc";
        di.pDataType = "RAW";
        if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return false; }
        if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        int written;
        bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return success && (written == bytes.Length);
    }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'RawPrinter').Type) {
    Add-Type -TypeDefinition $cSharp
}
$target = '${targetPrinterName.replace(/'/g, "")}'
$file = '${tempBin.replace(/'/g, "")}'
$printers = Get-Printer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
$matched = $printers | Where-Object { $_ -like "*$target*" -or $_ -like "*POS-80-USB*" -or $_ -like "*POS-80*" } | Select-Object -First 1
if (-not $matched) { $matched = "POS-80-USB" }
$res = [RawPrinter]::SendFileToPrinter($matched, $file)
if ($res) { exit 0 } else { exit 1 }
`;

      const psPath = path.join(os.tmpdir(), `raw_print_${Date.now()}.ps1`);
      fs.writeFileSync(psPath, psRawPrint);

      const usbSuccess = await new Promise<boolean>((resolve) => {
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psPath}"`, { timeout: 10000 }, (err) => {
          try {
            fs.unlinkSync(tempBin);
            fs.unlinkSync(psPath);
          } catch {}
          resolve(!err);
        });
      });

      if (usbSuccess) {
        return NextResponse.json({ success: true, method: "windows_raw_usb_spooler" });
      }
    }

    return NextResponse.json({ success: false, message: "Fallback to browser print mechanism." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Internal server error" }, { status: 500 });
  }
}
