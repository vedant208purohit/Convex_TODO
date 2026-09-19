import { NextResponse } from "next/server";
import net from "net";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { printerUrl, printerPort = "9100", printerType } = body;

    if (!printerUrl || typeof printerUrl !== "string") {
      return NextResponse.json(
        { online: false, error: "Printer IP address or hostname is required." },
        { status: 400 }
      );
    }

    const host = printerUrl.trim().replace(/^https?:\/\//i, "").split(":")[0];
    const port = parseInt(printerPort.toString().trim(), 10) || 9100;

    // For LAN / Network printers, perform a direct TCP socket handshake check
    if (printerType === "Lan" || !printerType) {
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

      return NextResponse.json(isConnected, { status: 200 });
    }

    // For USB / Bluetooth, indicate connection check is handled via browser WebUSB/WebBluetooth
    return NextResponse.json(
      {
        online: true,
        message: `${printerType} printers are detected directly via browser device APIs.`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { online: false, error: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}
