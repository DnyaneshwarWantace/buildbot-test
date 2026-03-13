export type CreatePayload = {
  subdomain: string;
  companyName?: string;
  companyWebsite: string;
  competitorWebsites?: string[];
  clientRequirements: string;
};

export async function createProject(payload: CreatePayload) {
  const response = await fetch("/api/v1/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "message" in data && (data as any).message) ||
      "Failed to create project";

    throw new Error(String(message));
  }

  return data;
}

