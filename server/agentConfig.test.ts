import { describe, expect, it } from "vitest";
import { getAgentById, getAgentsBySector } from "./agentConfig";

describe("agent catalog", () => {
  it("registers the mandamus writ architect with Nevada context and legal-sector access", () => {
    const agent = getAgentById("mandamus_writ_architect");

    expect(agent).toBeDefined();
    expect(agent?.name).toBe("Mandamus Writ Architect");
    expect(agent?.division).toBe("analysis");
    expect(agent?.capabilities).toContain("mandamus");
    expect(agent?.systemPrompt).toContain("NRS 34.160");
    expect(agent?.systemPrompt).toContain(
      "no plain, speedy, and adequate remedy"
    );
    expect(agent?.systemPrompt).toContain("NEVADA WRIT CONTEXT");
    expect(agent?.systemPrompt).toContain("PETITION SCAFFOLD");
    expect(agent?.systemPrompt).toContain("Record appendix needs");
    expect(agent?.systemPrompt).toContain("FILE_WRIT");
    expect(agent?.systemPrompt).toContain("DEMAND_RECORDS_FIRST");
    expect(agent?.systemPrompt).toContain("PRESERVE_FOR_APPEAL");
    expect(agent?.systemPrompt).toContain("NOT_MANDAMUS");

    const legalAgents = getAgentsBySector("legal").map(
      legalAgent => legalAgent.id
    );
    expect(legalAgents).toContain("mandamus_writ_architect");
  });
});
