import { createSign } from "crypto";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

type AccessTokenCache = {
  token: string;
  expiresAt: number;
  scopes: string;
};

let cachedToken: AccessTokenCache | null = null;

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString("base64url");
}

function parseServiceAccount(): ServiceAccount {
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
  if (!raw) {
    throw new Error("GCP_SERVICE_ACCOUNT_KEY_JSON is required");
  }
  const trimmed = raw.trim();
  const json =
    trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf8");
  const parsed = JSON.parse(json) as ServiceAccount;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid GCP service account JSON");
  }
  return parsed;
}

async function getAccessToken(scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const scopeString = scopes.join(" ");
  if (cachedToken && cachedToken.expiresAt - 60 > now && cachedToken.scopes === scopeString) {
    return cachedToken.token;
  }

  const sa = parseServiceAccount();
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  const signature = signer.sign(sa.private_key, "base64url");
  const jwt = `${data}.${signature}`;

  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", jwt);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${text}`);
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    token: tokenData.access_token,
    expiresAt: now + tokenData.expires_in,
    scopes: scopeString,
  };

  return tokenData.access_token;
}

export async function uploadObject(
  bucket: string,
  objectName: string,
  data: ArrayBuffer,
  contentType = "application/octet-stream"
): Promise<void> {
  const token = await getAccessToken([
    "https://www.googleapis.com/auth/devstorage.read_write",
  ]);
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
    bucket
  )}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body: data,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GCS upload failed: ${response.status} ${text}`);
  }
}

export async function downloadObjectText(
  bucket: string,
  objectName: string
): Promise<string | null> {
  const token = await getAccessToken([
    "https://www.googleapis.com/auth/devstorage.read_only",
  ]);
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(
    bucket
  )}/o/${encodeURIComponent(objectName)}?alt=media`;

  console.log("[DEBUG] Download URL:", url);
  console.log("[DEBUG] Bucket:", bucket);
  console.log("[DEBUG] Object:", objectName);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log("[DEBUG] Response status:", response.status);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GCS download failed: ${response.status} ${text}`);
  }

  return await response.text();
}

export async function runCloudRunJob(params: {
  projectId: string;
  region: string;
  jobName: string;
  env: Record<string, string>;
}): Promise<void> {
  const token = await getAccessToken(["https://www.googleapis.com/auth/cloud-platform"]);
  const { projectId, region, jobName, env } = params;

  const sa = parseServiceAccount();
  console.log("[DEBUG] Service Account:", sa.client_email);
  console.log("[DEBUG] Project ID:", projectId);
  console.log("[DEBUG] Region:", region);
  console.log("[DEBUG] Job Name:", jobName);

  const url = `https://run.googleapis.com/v2/projects/${encodeURIComponent(
    projectId
  )}/locations/${encodeURIComponent(region)}/jobs/${encodeURIComponent(jobName)}:run`;

  const body = {
    overrides: {
      containerOverrides: [
        {
          env: Object.entries(env).map(([name, value]) => ({
            name,
            value,
          })),
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloud Run job trigger failed: ${response.status} ${text}`);
  }
}
