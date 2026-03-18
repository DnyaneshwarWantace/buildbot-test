import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import net from "node:net";
import type { GeneratedSiteSpec } from "./generate";

const PROJECTS_BASE =
  process.env.PROJECTS_BASE || path.join(process.cwd(), "projects");
const DOMAIN = process.env.DOMAIN || "wantace.org";
const PORT_START = Number(process.env.PORT_START) || 5000;
const PORT_END = Number(process.env.PORT_END) || 6000;
const NGINX_SITES_AVAILABLE = process.env.NGINX_SITES_AVAILABLE || "";

const STATIC_DOCKERFILE = `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
`;

export type DeployResult = {
  port: number;
  liveUrl: string;
  nginxConfigured: boolean;
};

function getFreePort(start: number, end: number): Promise<number> {
  return new Promise((resolve, reject) => {
    function tryPort(port: number) {
      if (port >= end) {
        reject(new Error("No free ports available"));
        return;
      }
      const server = net.createServer();
      server.once("error", () => {
        server.close();
        tryPort(port + 1);
      });
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, "127.0.0.1");
    }
    tryPort(start);
  });
}

function runCommand(command: string, cwd?: string): void {
  const options: { shell: string; cwd?: string } = { shell: "/bin/sh" };
  if (cwd) options.cwd = cwd;
  execSync(command, options);
}

function resolveSafePath(projectPath: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    throw new Error(`Path traversal rejected (absolute): ${filePath}`);
  }
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolved = path.resolve(projectPath, normalized);
  const projectRoot = path.resolve(projectPath);
  if (!resolved.startsWith(projectRoot)) {
    throw new Error(`Path traversal rejected: ${filePath}`);
  }
  return resolved;
}

export async function materializeProject(
  subdomain: string,
  spec: GeneratedSiteSpec,
): Promise<string> {
  const projectPath = path.join(PROJECTS_BASE, subdomain);
  console.log("[deploy] materializeProject start", { subdomain, projectPath, fileCount: spec.files.length });

  await fs.mkdir(projectPath, { recursive: true });

  for (const file of spec.files) {
    const filePath = resolveSafePath(projectPath, file.path);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.content, "utf8");
    console.log("[deploy] wrote file", file.path);
  }

  const dockerfilePath = path.join(projectPath, "Dockerfile");
  await fs.writeFile(dockerfilePath, STATIC_DOCKERFILE, "utf8");
  console.log("[deploy] materializeProject done", projectPath);

  return projectPath;
}

export async function deployContainer(
  subdomain: string,
): Promise<{ port: number }> {
  const projectPath = path.join(PROJECTS_BASE, subdomain);
  const imageName = subdomain;
  const containerName = subdomain;

  console.log("[deploy] docker build start", { subdomain, projectPath });
  runCommand(`docker build -t ${imageName} .`, projectPath);
  console.log("[deploy] docker build done", subdomain);

  try {
    runCommand(`docker rm -f ${containerName}`);
    console.log("[deploy] removed existing container", containerName);
  } catch {
    // ignore if container did not exist
  }

  const port = await getFreePort(PORT_START, PORT_END);
  console.log("[deploy] docker run", { subdomain, port });
  runCommand(
    `docker run -d -p ${port}:80 --name ${containerName} ${imageName}`,
    undefined,
  );
  console.log("[deploy] container running", { containerName, port });

  return { port };
}

export async function setupNginx(
  subdomain: string,
  port: number,
): Promise<boolean> {
  if (!NGINX_SITES_AVAILABLE) {
    console.log("[deploy] nginx skip (NGINX_SITES_AVAILABLE not set)");
    return false;
  }

  console.log("[deploy] nginx setup start", { subdomain, port });
  const serverBlock = `server {
    listen 80;
    server_name ${subdomain}.${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
`;

  const configPath = path.join(NGINX_SITES_AVAILABLE, subdomain);
  await fs.writeFile(configPath, serverBlock, "utf8");
  runCommand(`ln -sf ${configPath} /etc/nginx/sites-enabled/${subdomain}`);
  runCommand("nginx -t");
  runCommand("systemctl reload nginx");
  console.log("[deploy] nginx setup done", subdomain);

  return true;
}

export async function deployProject( subdomain: string, spec: GeneratedSiteSpec ): Promise<DeployResult> {
  
  console.log("[deploy] deployProject start", subdomain);

  await materializeProject(subdomain, spec);
  const { port } = await deployContainer(subdomain);
  const nginxConfigured = await setupNginx(subdomain, port);

  const liveUrl = nginxConfigured ? `http://${subdomain}.${DOMAIN}` : `http://127.0.0.1:${port}`;

  console.log("[deploy] deployProject done", { subdomain, liveUrl, port, nginxConfigured });

  return {
    port,
    liveUrl,
    nginxConfigured,
  };
}
