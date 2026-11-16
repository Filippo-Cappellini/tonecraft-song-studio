// Stampa l'indirizzo IP di questo computer nella rete locale, da aprire nel browser (anche da telefono o tablet).
// Uso: node scripts/indirizzo.mjs [porta]   (porta predefinita: APP_PORT oppure 3000)
import { createSocket } from "node:dgram";
import { networkInterfaces } from "node:os";

const port = process.argv[2] || process.env.APP_PORT || "3000";

// La scheda di rete usata per uscire: un socket UDP "connesso" non invia nessun pacchetto, serve solo a far
// scegliere al sistema l'interfaccia giusta (così si saltano VMware, WSL, Docker e simili).
function mainIp() {
  return new Promise((resolve) => {
    const s = createSocket("udp4");
    s.on("error", () => resolve(null));
    s.connect(53, "192.0.2.1", () => {
      const { address } = s.address();
      s.close();
      resolve(address && address !== "0.0.0.0" ? address : null);
    });
  });
}

const virtual = /vmware|virtualbox|vbox|vethernet|wsl|hyper-v|docker|^br-|^veth|tailscale|zerotier/i;
const fallback = Object.entries(networkInterfaces())
  .filter(([name]) => !virtual.test(name))
  .flatMap(([, list]) => list ?? [])
  .filter((n) => n.family === "IPv4" && !n.internal && !n.address.startsWith("169.254."))
  .map((n) => n.address);

const ip = (await mainIp()) ?? fallback[0];
console.log("\nTono è pronto. Aprilo dal browser (anche da telefono, nella stessa rete):");
console.log(ip ? `  http://${ip}:${port}` : `  http://localhost:${port}   (nessuna rete trovata)`);
console.log("");
