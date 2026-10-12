/**
 * FREE PUBLIC RESOURCE APIS
 *
 * No keys required. Pulls from federal open-data ArcGIS feature services.
 *
 * Currently wired:
 *   - HUD Public Housing Authorities (housing)
 *   - HUD Housing Counseling Agencies (housing/financial)
 *   - HUD Single-Family Housing Counseling Agencies (housing/financial)
 *
 * All endpoints are queried by Michigan FIPS code (26) or full state name and
 * normalized into the SAINTE Resource shape used by SmartMatcher.
 */

import type { InsertResource } from "@shared/schema";

const HUD_BASE =
  "https://services.arcgis.com/VTyQ9soqVukalItT/ArcGIS/rest/services";

const MI_FIPS = "26";
const MI_NAME = "Michigan";

interface ArcGISFeature {
  attributes: Record<string, any>;
}

interface ArcGISResponse {
  features?: ArcGISFeature[];
  error?: { code: number; message: string };
}

/** Normalize ArcGIS-style padded strings ("Bangor          " → "Bangor"). */
function clean(v: any): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function titleCase(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Format a US phone number as 555-555-5555 if 10 digits, else as-is. */
function formatPhone(raw: any): string | undefined {
  const s = clean(raw);
  if (!s) return undefined;
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return s;
}

async function queryArcGIS(
  layerUrl: string,
  where: string,
  outFields: string,
  resultRecordCount = 1000,
): Promise<ArcGISFeature[]> {
  const params = new URLSearchParams({
    where,
    outFields,
    resultRecordCount: String(resultRecordCount),
    f: "json",
  });
  const res = await fetch(`${layerUrl}/query?${params}`);
  if (!res.ok) {
    throw new Error(`ArcGIS ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as ArcGISResponse;
  if (data.error) {
    throw new Error(`ArcGIS error ${data.error.code}: ${data.error.message}`);
  }
  return data.features || [];
}

/** HUD Public Housing Authorities — 126 in MI as of probe. */
export async function fetchHudPublicHousingAuthorities(
  state: string = MI_FIPS,
): Promise<InsertResource[]> {
  const layer = `${HUD_BASE}/Public_Housing_Authorities/FeatureServer/0`;
  const fields = [
    "FORMAL_PARTICIPANT_NAME",
    "HA_PHN_NUM",
    "HA_EMAIL_ADDR_TEXT",
    "CURCNTY_NM",
    "CURCOSUB_NM",
    "PLACE_NM2KX",
    "HA_PROGRAM_TYPE",
    "STATE2KX",
  ].join(",");
  const features = await queryArcGIS(
    layer,
    `STATE2KX='${state}'`,
    fields,
  );
  return features
    .map((f) => {
      const a = f.attributes;
      const name = clean(a.FORMAL_PARTICIPANT_NAME);
      if (!name) return null;
      const city = titleCase(clean(a.PLACE_NM2KX)?.replace(/ city$/i, "")) ||
        titleCase(clean(a.CURCOSUB_NM));
      const county = titleCase(clean(a.CURCNTY_NM));
      const program = clean(a.HA_PROGRAM_TYPE);
      const description = [
        program ? `${program} housing program.` : "Public housing authority.",
        county ? `Serves ${county} County.` : null,
        "Provides Section 8 vouchers and/or low-rent public housing for income-eligible families.",
      ]
        .filter(Boolean)
        .join(" ");
      return {
        name: titleCase(name) || name,
        description,
        category: "housing",
        contact: {
          phone: formatPhone(a.HA_PHN_NUM),
          email: clean(a.HA_EMAIL_ADDR_TEXT),
          address: city ? `${city}, MI` : "Michigan",
        },
        serviceArea: city ? `${city}, MI` : "Michigan",
        serviceAreaType: "local",
        serviceCities: city ? [city] : undefined,
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility:
          "Income-eligible households (typically below 80% of area median income).",
        isVerified: true,
        connectionType: "external",
        hasSainteAccess: false,
      } satisfies InsertResource;
    })
    .filter((r): r is InsertResource => r !== null);
}

/** HUD Housing Counseling Agencies (full counseling) — 203 in MI. */
export async function fetchHudHousingCounselingAgencies(
  stateFullName: string = MI_NAME,
): Promise<InsertResource[]> {
  const layer = `${HUD_BASE}/Housing_Counseling_Agencies_UAUC/FeatureServer/0`;
  const fields = [
    "AGC_NAME",
    "AGC_ADDRESS",
    "AGC_CITY",
    "AGC_STATE",
    "AGC_ZIP_CODE",
    "AGC_PHONE_NBR",
    "AGC_EMAIL",
    "AGC_WEB_SITE",
  ].join(",");
  const features = await queryArcGIS(
    layer,
    `AGC_STATE='${stateFullName}'`,
    fields,
  );
  return features
    .map((f) => {
      const a = f.attributes;
      const name = clean(a.AGC_NAME);
      if (!name) return null;
      const city = titleCase(clean(a.AGC_CITY));
      const street = clean(a.AGC_ADDRESS);
      const zip = clean(a.AGC_ZIP_CODE);
      const address = [street, city, "MI", zip].filter(Boolean).join(", ");
      return {
        name: titleCase(name) || name,
        description:
          "HUD-approved housing counseling agency. Free help with rental issues, eviction prevention, foreclosure, homebuyer education, budgeting, and reverse mortgages.",
        category: "housing",
        contact: {
          phone: formatPhone(a.AGC_PHONE_NBR),
          email: clean(a.AGC_EMAIL),
          website: clean(a.AGC_WEB_SITE),
          address: address || (city ? `${city}, MI` : "Michigan"),
        },
        serviceArea: city ? `${city}, MI` : "Michigan",
        serviceAreaType: "local",
        serviceZipCodes: zip ? [zip.split("-")[0]] : undefined,
        serviceCities: city ? [city] : undefined,
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Open to the public. Most services are free.",
        isVerified: true,
        connectionType: "external",
        hasSainteAccess: false,
      } satisfies InsertResource;
    })
    .filter((r): r is InsertResource => r !== null);
}

/** HUD Single-Family Housing Counseling Agencies — 62 in MI. */
export async function fetchHudSingleFamilyCounseling(
  state: string = MI_FIPS,
): Promise<InsertResource[]> {
  const layer = `${HUD_BASE}/Single_Family_Housing_Counseling_Agencies/FeatureServer/0`;
  const fields = [
    "AGC_NAME",
    "AGC_ADDRESS",
    "AGC_CITY",
    "AGC_STATE",
    "AGC_ZIP_CODE",
    "AGC_PHONE_NBR",
    "AGC_EMAIL",
    "AGC_WEB_SITE",
    "STATE2KX",
  ].join(",");
  const features = await queryArcGIS(
    layer,
    `STATE2KX='${state}'`,
    fields,
  );
  return features
    .map((f) => {
      const a = f.attributes;
      const name = clean(a.AGC_NAME);
      if (!name) return null;
      const city = titleCase(clean(a.AGC_CITY));
      const street = clean(a.AGC_ADDRESS);
      const zip = clean(a.AGC_ZIP_CODE);
      const address = [street, city, "MI", zip].filter(Boolean).join(", ");
      return {
        name: titleCase(name) || name,
        description:
          "HUD-approved single-family housing counseling. Free help with foreclosure prevention, homebuyer education, mortgage default, and reverse mortgages.",
        category: "financial",
        contact: {
          phone: formatPhone(a.AGC_PHONE_NBR),
          email: clean(a.AGC_EMAIL),
          website: clean(a.AGC_WEB_SITE),
          address: address || (city ? `${city}, MI` : "Michigan"),
        },
        serviceArea: city ? `${city}, MI` : "Michigan",
        serviceAreaType: "local",
        serviceZipCodes: zip ? [zip.split("-")[0]] : undefined,
        serviceCities: city ? [city] : undefined,
        serviceStates: ["MI"],
        isNationwide: false,
        eligibility: "Open to the public. Most services are free.",
        isVerified: true,
        connectionType: "external",
        hasSainteAccess: false,
      } satisfies InsertResource;
    })
    .filter((r): r is InsertResource => r !== null);
}

/**
 * Sync all free public sources for Michigan in one shot.
 * Each provider is independent — a failure in one won't stop the others.
 * Returns flat list of normalized InsertResource objects ready for storage.
 */
export async function fetchAllFreePublicResources(): Promise<{
  resources: InsertResource[];
  bySource: Record<string, number>;
  errors: { source: string; error: string }[];
}> {
  const results = await Promise.allSettled([
    fetchHudPublicHousingAuthorities().then((r) => ({
      source: "HUD-PHA",
      resources: r,
    })),
    fetchHudHousingCounselingAgencies().then((r) => ({
      source: "HUD-HousingCounseling",
      resources: r,
    })),
    fetchHudSingleFamilyCounseling().then((r) => ({
      source: "HUD-SingleFamilyCounseling",
      resources: r,
    })),
  ]);

  const allResources: InsertResource[] = [];
  const bySource: Record<string, number> = {};
  const errors: { source: string; error: string }[] = [];
  const sourceNames = [
    "HUD-PHA",
    "HUD-HousingCounseling",
    "HUD-SingleFamilyCounseling",
  ];

  results.forEach((result, i) => {
    const source = sourceNames[i];
    if (result.status === "fulfilled") {
      bySource[source] = result.value.resources.length;
      allResources.push(...result.value.resources);
    } else {
      bySource[source] = 0;
      errors.push({
        source,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  });

  return { resources: allResources, bySource, errors };
}
