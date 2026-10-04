const fs = require('fs');
const filePath = 'c:/Workspace/pos-user/hooks/useQrTelemetry.ts';
let content = fs.readFileSync(filePath, 'utf8');

const target = `      let publicIp: string | undefined = undefined;
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(2000) });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.ip) {
            publicIp = String(ipData.ip);
          }
        }
      } catch {
        // Non-blocking IP lookup fallback
      }`;

const replacement = `      let publicIp: string | undefined = undefined;
      let city: string | undefined = undefined;
      let country: string | undefined = undefined;
      let region: string | undefined = undefined;
      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;

      try {
        const geoRes = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(2500) });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.ip) {
            publicIp = String(geoData.ip);
            city = geoData.city || undefined;
            country = geoData.country_name || geoData.country || undefined;
            region = geoData.region || undefined;
            if (typeof geoData.latitude === "number") latitude = geoData.latitude;
            if (typeof geoData.longitude === "number") longitude = geoData.longitude;
          }
        }
      } catch {
        try {
          const fallbackRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(1500) });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (fallbackData && fallbackData.ip) publicIp = String(fallbackData.ip);
          }
        } catch {}
      }`;

const targetMutation = `          ipAddress: publicIp,
          deviceType: telemetry.deviceType,`;

const replacementMutation = `          ipAddress: publicIp,
          city,
          country,
          region,
          latitude,
          longitude,
          deviceType: telemetry.deviceType,`;

if (content.includes(target) && content.includes(targetMutation)) {
  content = content.replace(target, replacement);
  content = content.replace(targetMutation, replacementMutation);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated useQrTelemetry.ts with GeoIP (City, Country, Region, Lat/Long)');
} else {
  console.log('Target insertion points not found');
}
