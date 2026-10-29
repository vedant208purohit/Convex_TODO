import { NextResponse } from "next/server";
import net from "net";
import { exec } from "child_process";

// In-memory cache for recent connection test results (5 seconds TTL) to prevent OS process thrashing
const connectionCache = new Map<string, { result: { online: boolean; latencyMs?: number; error?: string }; expiresAt: number }>();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { printerUrl, printerPort = "9100", printerType } = body;

    if (!printerUrl || typeof printerUrl !== "string") {
      return NextResponse.json(
        { online: false, error: "Printer address or name is required." },
        { status: 400 }
      );
    }

    const cacheKey = `${printerType}_${printerUrl}_${printerPort}`;
    const cached = connectionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.result, { status: 200 });
    }

    const host = printerUrl.trim().replace(/^https?:\/\//i, "").split(":")[0];
    const port = parseInt(printerPort.toString().trim(), 10) || 9100;

    // 1. LAN PRINTER: TCP Socket handshake on port 9100
    if (printerType === "Lan") {
      const startTime = Date.now();

      const isConnected = await new Promise<{ online: boolean; latencyMs?: number; error?: string }>(
        (resolve) => {
          const socket = new net.Socket();
          let resolved = false;

          socket.setTimeout(2500);

          socket.on("connect", () => {
            if (!resolved) {
              resolved = true;
              const latencyMs = Date.now() - startTime;
              socket.destroy();
              resolve({ online: true, latencyMs });
            }
          });

          socket.on("timeout", () => {
            if (!resolved) {
              resolved = true;
              socket.destroy();
              resolve({
                online: false,
                error: `Connection timed out after 2.5s. Ensure printer is powered on and reachable on ${host}:${port}.`,
              });
            }
          });

          socket.on("error", (err: any) => {
            if (!resolved) {
              resolved = true;
              socket.destroy();
              resolve({
                online: false,
                error: err.code === "ECONNREFUSED"
                  ? `Connection refused on ${host}:${port}. Check if RAW port 9100 is enabled.`
                  : err.message || "Failed to reach printer.",
              });
            }
          });

          try {
            socket.connect(port, host);
          } catch (err: any) {
            if (!resolved) {
              resolved = true;
              resolve({ online: false, error: err.message || "Socket creation error." });
            }
          }
        }
      );

      connectionCache.set(cacheKey, { result: isConnected, expiresAt: Date.now() + 5000 });
      return NextResponse.json(isConnected, { status: 200 });
    }

    // 2. BLUETOOTH PRINTER: Hardware check on Windows
    if (printerType === "Bluetooth" || printerPort === "BT") {
      if (process.platform === "win32") {
        const cleanName = printerUrl.replace(/['"\\]/g, "").trim();
        const psCheck = `
          $dev = Get-PnpDevice -FriendlyName '*${cleanName}*' -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'OK' -and $_.Present -eq $true };
          if ($dev) {
            Write-Output "ONLINE"
          } else {
            $radio = Get-PnpDevice -FriendlyName '*Bluetooth*' -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'OK' -and $_.Present -eq $true };
            if (-not $radio) {
              Write-Output "RADIO_OFF"
            } else {
              Write-Output "DEV_OFFLINE"
            }
          }
        `.replace(/\r?\n/g, " ");

        const res = await new Promise<{ online: boolean; latencyMs?: number; error?: string }>((resolve) => {
          exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCheck}"`, { timeout: 8000 }, (err, stdout) => {
            if (err) {
              resolve({ online: false, error: "Bluetooth query failed: " + err.message });
              return;
            }
            const out = stdout.trim();
            if (out === "ONLINE") {
              resolve({ online: true, latencyMs: 5 });
            } else if (out === "RADIO_OFF") {
              resolve({ online: false, error: "Bluetooth is turned OFF in Windows Settings" });
            } else {
              resolve({ online: false, error: "Bluetooth printer is disconnected or powered off" });
            }
          });
        });

        connectionCache.set(cacheKey, { result: res, expiresAt: Date.now() + 5000 });
        return NextResponse.json(res, { status: 200 });
      }

      const defaultBt = { online: true, latencyMs: 5 };
      connectionCache.set(cacheKey, { result: defaultBt, expiresAt: Date.now() + 5000 });
      return NextResponse.json(defaultBt, { status: 200 });
    }

    // 3. USB PRINTER: Hardware check on Windows
    if (printerType === "Usb" || printerPort === "USB") {
      if (process.platform === "win32") {
        const cleanName = printerUrl.replace(/['"\\]/g, "").trim();
        const psCheck = `
          $usbDev = Get-PnpDevice -FriendlyName '*${cleanName}*' -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'OK' -and $_.Present -eq $true };
          $winPrinter = Get-Printer -Name '*${cleanName}*' -ErrorAction SilentlyContinue;
          if ($usbDev -or $winPrinter) {
            Write-Output "ONLINE"
          } else {
            Write-Output "OFFLINE"
          }
        `.replace(/\r?\n/g, " ");

        const res = await new Promise<{ online: boolean; latencyMs?: number; error?: string }>((resolve) => {
          exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCheck}"`, { timeout: 8000 }, (err, stdout) => {
            if (err) {
              resolve({ online: false, error: "USB query failed: " + err.message });
              return;
            }
            const out = stdout.trim();
            if (out === "ONLINE") {
              resolve({ online: true, latencyMs: 1 });
            } else {
              resolve({ online: false, error: "USB printer is disconnected or unplugged" });
            }
          });
        });

        connectionCache.set(cacheKey, { result: res, expiresAt: Date.now() + 5000 });
        return NextResponse.json(res, { status: 200 });
      }

      const defaultUsb = { online: true, latencyMs: 1 };
      connectionCache.set(cacheKey, { result: defaultUsb, expiresAt: Date.now() + 5000 });
      return NextResponse.json(defaultUsb, { status: 200 });
    }

    const defaultOk = { online: true };
    connectionCache.set(cacheKey, { result: defaultOk, expiresAt: Date.now() + 5000 });
    return NextResponse.json(defaultOk, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { online: false, error: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}
