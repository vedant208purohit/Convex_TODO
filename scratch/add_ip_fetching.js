const fs = require('fs');
const filePath = 'c:/Workspace/pos-user/hooks/useQrTelemetry.ts';
let content = fs.readFileSync(filePath, 'utf8');

const target = `      const telemetry = getClientTelemetry();`;

const replacement = `      let publicIp: string | undefined = undefined;
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
      }

      const telemetry = getClientTelemetry();`;

const targetMutation = `          deviceType: telemetry.deviceType,`;
const replacementMutation = `          ipAddress: publicIp,
          deviceType: telemetry.deviceType,`;

if (content.includes(target) && content.includes(targetMutation)) {
  content = content.replace(target, replacement);
  content = content.replace(targetMutation, replacementMutation);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully added client-side public IP fetching to useQrTelemetry.ts');
} else {
  console.log('Target insertion points not found in useQrTelemetry.ts');
}
