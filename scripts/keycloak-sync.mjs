#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const config = {
  baseUrl: env("KEYCLOAK_ADMIN_URL", "http://localhost:8080").replace(
    /\/$/,
    "",
  ),
  adminRealm: env("KEYCLOAK_ADMIN_REALM", "master"),
  username: env("KEYCLOAK_ADMIN_USERNAME", "admin"),
  password: env("KEYCLOAK_ADMIN_PASSWORD", "admin123"),
  exportPath: env(
    "KEYCLOAK_REALM_EXPORT",
    path.join(rootDir, "infra/keycloak/realm-soundmeet.json"),
  ),
  serviceAccountRoleAssignmentsPath: env(
    "KEYCLOAK_SERVICE_ACCOUNT_ROLE_ASSIGNMENTS",
    path.join(rootDir, "infra/keycloak/service-account-role-assignments.json"),
  ),
  apiClientSecret: env(
    "KEYCLOAK_API_CLIENT_SECRET",
    "soundmeet-api-local-secret",
  ),
  googleClientId: env("GOOGLE_KEYCLOAK_CLIENT_ID", ""),
  googleClientSecret: env("GOOGLE_KEYCLOAK_CLIENT_SECRET", ""),
};

function env(key, fallback) {
  return process.env[key] && process.env[key].trim()
    ? process.env[key].trim()
    : fallback;
}

async function main() {
  const realm = JSON.parse(await readFile(config.exportPath, "utf8"));
  const serviceAccountRoleAssignments = JSON.parse(
    await readFile(config.serviceAccountRoleAssignmentsPath, "utf8"),
  );
  const token = await getAdminToken();
  const api = createApi(token);

  await upsertRealm(api, realm);
  await upsertRealmRoles(api, realm);
  await upsertIdentityProviders(api, realm);
  propagateContextMappers(realm);

  const clientIdToUuid = new Map();
  for (const client of realm.clients ?? []) {
    const uuid = await upsertClient(api, realm.realm, client);
    clientIdToUuid.set(client.clientId, uuid);
    await upsertClientRoles(api, realm, client.clientId, uuid);
    await upsertProtocolMappers(api, realm.realm, uuid, client);
  }

  await assignServiceAccountRoles(
    api,
    realm,
    clientIdToUuid,
    serviceAccountRoleAssignments,
  );

  for (const group of realm.groups ?? []) {
    await upsertGroupTree(api, realm.realm, group, null, clientIdToUuid);
  }

  console.log(`Keycloak realm '${realm.realm}' synchronized successfully.`);
}

async function getAdminToken() {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username: config.username,
    password: config.password,
  });

  const response = await fetch(
    `${config.baseUrl}/realms/${config.adminRealm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to authenticate on Keycloak: ${response.status} ${await response.text()}`,
    );
  }

  const payload = await response.json();
  return payload.access_token;
}

function createApi(token) {
  return async function api(
    method,
    pathname,
    body,
    expected = [200, 201, 204],
  ) {
    const response = await fetch(`${config.baseUrl}/admin${pathname}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!expected.includes(response.status)) {
      throw new Error(
        `${method} ${pathname} failed: ${response.status} ${await response.text()}`,
      );
    }

    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
}

async function upsertRealm(api, realm) {
  const exists = await resourceExists(api, `/realms/${realm.realm}`);
  const representation = pickDefined({
    realm: realm.realm,
    enabled: realm.enabled,
    displayName: realm.displayName,
    registrationAllowed: realm.registrationAllowed,
    registrationEmailAsUsername: realm.registrationEmailAsUsername,
    loginWithEmailAllowed: realm.loginWithEmailAllowed,
    duplicateEmailsAllowed: realm.duplicateEmailsAllowed,
    resetPasswordAllowed: realm.resetPasswordAllowed,
    editUsernameAllowed: realm.editUsernameAllowed,
    bruteForceProtected: realm.bruteForceProtected,
    permanentLockout: realm.permanentLockout,
    failureFactor: realm.failureFactor,
    waitIncrementSeconds: realm.waitIncrementSeconds,
    maxFailureWaitSeconds: realm.maxFailureWaitSeconds,
    accessTokenLifespan: realm.accessTokenLifespan,
    ssoSessionIdleTimeout: realm.ssoSessionIdleTimeout,
    ssoSessionMaxLifespan: realm.ssoSessionMaxLifespan,
    offlineSessionIdleTimeout: realm.offlineSessionIdleTimeout,
    sslRequired: realm.sslRequired,
  });

  if (exists) {
    await api("PUT", `/realms/${realm.realm}`, representation);
    return;
  }

  await api("POST", "/realms", representation);
}

async function upsertIdentityProviders(api, realm) {
  const providers = realm.identityProviders ?? [];
  if (!providers.length) return;

  for (const provider of providers) {
    if (provider.alias === "google" && !config.googleClientId) {
      console.log(
        "  Skipping Google identity provider — GOOGLE_KEYCLOAK_CLIENT_ID not set",
      );
      continue;
    }

    const enriched = enrichProviderCredentials(provider);
    const pathname = `/realms/${realm.realm}/identity-provider/instances/${provider.alias}`;
    const exists = await resourceExists(api, pathname);

    if (exists) {
      await api("PUT", pathname, enriched);
    } else {
      await api(
        "POST",
        `/realms/${realm.realm}/identity-provider/instances`,
        enriched,
      );
    }
    console.log(
      `  Identity provider '${provider.alias}' ${exists ? "updated" : "created"}`,
    );
  }
}

function enrichProviderCredentials(provider) {
  if (provider.alias === "google") {
    return {
      ...provider,
      config: {
        ...provider.config,
        clientId: config.googleClientId || provider.config?.clientId || "",
        clientSecret:
          config.googleClientSecret || provider.config?.clientSecret || "",
      },
    };
  }
  return provider;
}

async function upsertRealmRoles(api, realm) {
  for (const role of realm.roles?.realm ?? []) {
    const pathname = `/realms/${realm.realm}/roles/${encodeURIComponent(role.name)}`;
    if (await resourceExists(api, pathname)) {
      await api("PUT", pathname, role);
    } else {
      await api("POST", `/realms/${realm.realm}/roles`, role);
    }
  }
}

async function upsertClient(api, realmName, client) {
  const existing = await findClient(api, realmName, client.clientId);
  const representation = {
    ...client,
    ...(client.clientId === "soundmeet-api"
      ? { secret: config.apiClientSecret }
      : {}),
  };

  if (existing) {
    await api("PUT", `/realms/${realmName}/clients/${existing.id}`, {
      ...existing,
      ...representation,
      id: existing.id,
    });
    return existing.id;
  }

  await api("POST", `/realms/${realmName}/clients`, representation);
  const created = await findClient(api, realmName, client.clientId);
  if (!created) {
    throw new Error(`Client ${client.clientId} was not created`);
  }
  return created.id;
}

async function upsertClientRoles(api, realm, clientId, clientUuid) {
  const roles = realm.roles?.client?.[clientId] ?? [];
  for (const role of roles) {
    const pathname = `/realms/${realm.realm}/clients/${clientUuid}/roles/${encodeURIComponent(role.name)}`;
    if (await resourceExists(api, pathname)) {
      await api("PUT", pathname, role);
    } else {
      await api(
        "POST",
        `/realms/${realm.realm}/clients/${clientUuid}/roles`,
        role,
      );
    }
  }
}

async function upsertProtocolMappers(api, realmName, clientUuid, client) {
  const mappers = client.protocolMappers ?? [];
  if (!mappers.length) {
    return;
  }

  const existing = await api(
    "GET",
    `/realms/${realmName}/clients/${clientUuid}/protocol-mappers/models`,
  );
  const existingByName = new Map(
    existing.map((mapper) => [mapper.name, mapper]),
  );

  for (const mapper of mappers) {
    const current = existingByName.get(mapper.name);
    if (current) {
      await api(
        "PUT",
        `/realms/${realmName}/clients/${clientUuid}/protocol-mappers/models/${current.id}`,
        {
          ...current,
          ...mapper,
          id: current.id,
        },
      );
    } else {
      await api(
        "POST",
        `/realms/${realmName}/clients/${clientUuid}/protocol-mappers/models`,
        mapper,
      );
    }
  }
}

async function upsertGroupTree(
  api,
  realmName,
  group,
  parentId,
  clientIdToUuid,
) {
  const current = await findGroup(api, realmName, group.name, parentId);
  const representation = pickDefined({
    name: group.name,
    attributes: group.attributes,
    realmRoles: group.realmRoles,
    clientRoles: group.clientRoles,
  });

  let groupId = current?.id;
  if (groupId) {
    await api("PUT", `/realms/${realmName}/groups/${groupId}`, {
      ...current,
      ...representation,
    });
  } else if (parentId) {
    await api(
      "POST",
      `/realms/${realmName}/groups/${parentId}/children`,
      representation,
    );
    groupId = (await findGroup(api, realmName, group.name, parentId))?.id;
  } else {
    await api("POST", `/realms/${realmName}/groups`, representation);
    groupId = (await findGroup(api, realmName, group.name, null))?.id;
  }

  if (!groupId) {
    throw new Error(`Group ${group.name} was not created`);
  }

  await assignGroupRoles(api, realmName, groupId, group, clientIdToUuid);

  for (const child of group.subGroups ?? []) {
    await upsertGroupTree(api, realmName, child, groupId, clientIdToUuid);
  }
}

async function assignGroupRoles(
  api,
  realmName,
  groupId,
  group,
  clientIdToUuid,
) {
  if (group.realmRoles?.length) {
    const assigned = await api(
      "GET",
      `/realms/${realmName}/groups/${groupId}/role-mappings/realm`,
    );
    const assignedNames = new Set(assigned.map((role) => role.name));
    const roles = await Promise.all(
      group.realmRoles
        .filter((roleName) => !assignedNames.has(roleName))
        .map((roleName) =>
          api(
            "GET",
            `/realms/${realmName}/roles/${encodeURIComponent(roleName)}`,
          ),
        ),
    );
    if (roles.length) {
      await api(
        "POST",
        `/realms/${realmName}/groups/${groupId}/role-mappings/realm`,
        roles,
      );
    }
  }

  for (const [clientId, roleNames] of Object.entries(group.clientRoles ?? {})) {
    const clientUuid = clientIdToUuid.get(clientId);
    if (!clientUuid) {
      throw new Error(`Client ${clientId} not found for group role mapping`);
    }
    const assigned = await api(
      "GET",
      `/realms/${realmName}/groups/${groupId}/role-mappings/clients/${clientUuid}`,
    );
    const assignedNames = new Set(assigned.map((role) => role.name));
    const roles = await Promise.all(
      roleNames
        .filter((roleName) => !assignedNames.has(roleName))
        .map((roleName) =>
          api(
            "GET",
            `/realms/${realmName}/clients/${clientUuid}/roles/${encodeURIComponent(roleName)}`,
          ),
        ),
    );
    if (roles.length) {
      await api(
        "POST",
        `/realms/${realmName}/groups/${groupId}/role-mappings/clients/${clientUuid}`,
        roles,
      );
    }
  }
}

async function assignServiceAccountRoles(
  api,
  realm,
  clientIdToUuid,
  assignments,
) {
  for (const [clientId, rolesByTargetClient] of Object.entries(
    assignments ?? {},
  )) {
    const clientUuid = clientIdToUuid.get(clientId);
    if (!clientUuid) {
      throw new Error(
        `Client ${clientId} not found for service account role assignment`,
      );
    }

    const serviceAccountUser = await api(
      "GET",
      `/realms/${realm.realm}/clients/${clientUuid}/service-account-user`,
    );

    for (const [targetClientId, roleNames] of Object.entries(
      rolesByTargetClient,
    )) {
      const targetClient = await findClient(api, realm.realm, targetClientId);
      if (!targetClient) {
        throw new Error(
          `Target client ${targetClientId} not found for service account role assignment`,
        );
      }

      const assigned = await api(
        "GET",
        `/realms/${realm.realm}/users/${serviceAccountUser.id}/role-mappings/clients/${targetClient.id}`,
      );
      const assignedNames = new Set(assigned.map((role) => role.name));
      const roles = await Promise.all(
        roleNames
          .filter((roleName) => !assignedNames.has(roleName))
          .map((roleName) =>
            api(
              "GET",
              `/realms/${realm.realm}/clients/${targetClient.id}/roles/${encodeURIComponent(roleName)}`,
            ),
          ),
      );

      if (roles.length) {
        await api(
          "POST",
          `/realms/${realm.realm}/users/${serviceAccountUser.id}/role-mappings/clients/${targetClient.id}`,
          roles,
        );
        console.log(
          `  Service account of '${clientId}' granted [${roleNames.join(", ")}] on '${targetClientId}'`,
        );
      }
    }
  }
}

function propagateContextMappers(realm) {
  const apiClientId = "soundmeet-api";
  const apiClient = realm.clients?.find(
    (client) => client.clientId === apiClientId,
  );
  const contextMappers = apiClient?.protocolMappers ?? [];

  for (const client of realm.clients ?? []) {
    if (client.clientId === apiClientId) {
      continue;
    }

    const mappersByName = new Map(
      (client.protocolMappers ?? []).map((mapper) => [mapper.name, mapper]),
    );
    for (const mapper of contextMappers) {
      if (!mappersByName.has(mapper.name)) {
        mappersByName.set(mapper.name, mapper);
      }
    }

    const audienceMapper = {
      name: "soundmeet-api-audience",
      protocol: "openid-connect",
      protocolMapper: "oidc-audience-mapper",
      config: {
        "included.client.audience": apiClientId,
        "access.token.claim": "true",
        "id.token.claim": "false",
      },
    };
    if (!mappersByName.has(audienceMapper.name)) {
      mappersByName.set(audienceMapper.name, audienceMapper);
    }

    client.protocolMappers = [...mappersByName.values()];
  }
}

async function resourceExists(api, pathname) {
  try {
    await api("GET", pathname, undefined, [200]);
    return true;
  } catch (error) {
    if (String(error.message).includes("failed: 404")) {
      return false;
    }
    throw error;
  }
}

async function findClient(api, realmName, clientId) {
  const clients = await api(
    "GET",
    `/realms/${realmName}/clients?clientId=${encodeURIComponent(clientId)}`,
  );
  return clients[0] ?? null;
}

async function findGroup(api, realmName, name, parentId) {
  if (parentId) {
    const group = await api("GET", `/realms/${realmName}/groups/${parentId}`);
    return (group.subGroups ?? []).find((item) => item.name === name) ?? null;
  }

  const groups = await api(
    "GET",
    `/realms/${realmName}/groups?search=${encodeURIComponent(name)}&exact=true`,
  );
  return groups.find((item) => item.name === name) ?? null;
}

function pickDefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
