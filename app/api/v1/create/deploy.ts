import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { GeneratedSiteSpec } from "./generate";

const execAsync = promisify(exec);

const PROJECTS_BASE =
  process.env.PROJECTS_BASE || path.join(process.cwd(), "projects");
const DOMAIN = process.env.DOMAIN || "wantace.org";
const NGINX_SITES_AVAILABLE = process.env.NGINX_SITES_AVAILABLE || "";

export type DeployResult = {
  port: null;
  liveUrl: string;
  nginxConfigured: boolean;
};

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

  console.log("[deploy] materializeProject done", projectPath);
  return projectPath;
}

export async function setupNginx(subdomain: string): Promise<boolean> {
  if (!NGINX_SITES_AVAILABLE) {
    console.log("[deploy] nginx skip (NGINX_SITES_AVAILABLE not set)");
    return false;
  }

  const projectPath = path.join(PROJECTS_BASE, subdomain);
  console.log("[deploy] nginx setup start", { subdomain, projectPath });

  const serverBlock = `server {
    listen 80;
    server_name ${subdomain}.${DOMAIN};

    root ${projectPath};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`;

  const configPath = path.join(NGINX_SITES_AVAILABLE, subdomain);
  await fs.writeFile(configPath, serverBlock, "utf8");
  await execAsync(`ln -sf ${configPath} /etc/nginx/sites-enabled/${subdomain}`);
  await execAsync("nginx -t");
  await execAsync("systemctl reload nginx");
  console.log("[deploy] nginx setup done", subdomain);

  return true;
}

export async function deployProject(subdomain: string, spec: GeneratedSiteSpec): Promise<DeployResult> {
  console.log("[deploy] deployProject start", subdomain);

  await materializeProject(subdomain, spec);
  const nginxConfigured = await setupNginx(subdomain);

  const liveUrl = nginxConfigured
    ? `http://${subdomain}.${DOMAIN}`
    : `http://localhost (nginx not configured)`;

  console.log("[deploy] deployProject done", { subdomain, liveUrl, nginxConfigured });

  return {
    port: null,
    liveUrl,
    nginxConfigured,
  };
}
