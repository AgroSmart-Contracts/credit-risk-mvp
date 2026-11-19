/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLOSED_VIR_0311_2324 as D } from "../../data/pre-harvest/deal-viru-0311";
import { distanceM, parseApplication, readPdfText, REQUIRED_FIELDS, ringAreaHa } from "./application-reader";

const PDF = path.resolve(process.cwd(), "docs/pre-harvest/solicitud-PH-VIR-0311-2324.pdf");

describe("application reader", async () => {
  const buf = readFileSync(PDF);
  const lines = await readPdfText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const app = parseApplication(lines);

  it("reads every required field from the PDF text layer", () => {
    for (const k of REQUIRED_FIELDS) expect(app[k as keyof typeof app], k).toBeDefined();
  });

  it("matches the file record", () => {
    expect(app.ruc!.value).toBe(D.formato.ruc);
    expect(app.amountUsd!.value).toBe(D.envelopeUsd);
    expect(app.tenorDays!.value).toBe(180);
    expect(app.approvalDate!.value).toBe(D.approvalDate);
    expect(app.m3Date!.value).toBe(D.m3Date);
    expect(app.revenueLast3CampaignsUsd!.value).toEqual(D.formato.revenueLast3CampaignsUsd);
    expect(app.waterAllocationM3PerHa!.value).toBe(9500);
    expect(app.salinityEcDsM!.value).toBe(0.9);
    expect(app.crop!.value).toBe("avocado");
    expect(app.variety!.value).toBe("Hass");
    expect(app.hasPackhouseContract!.value).toBe(true);
    expect(app.packhouseAssignment!.value).toBe(true);
    expect(app.exportsDirectly!.value).toBe(false);
    expect(app.packhouseUtilizationPct!.value).toBe(82);
    expect(app.location!.value).toContain("Virú");
  });

  it("turns the UTM vertices back into the surveyed parcel", () => {
    const ring = app.vertices!.value.ring;
    ring.forEach((p, i) => expect(distanceM(p, D.parcel[i])).toBeLessThan(2));
    expect(ringAreaHa(ring)).toBeCloseTo(3.97, 1);
  });
});
