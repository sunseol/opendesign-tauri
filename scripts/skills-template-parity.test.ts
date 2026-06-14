import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { listPromptTemplates, readPromptTemplate } from "../apps/daemon/src/prompt-templates.js";
import { listSkills } from "../apps/daemon/src/skills.js";

const repoRoot = path.resolve(import.meta.dirname, "..");
const skillsRoot = path.join(repoRoot, "skills");
const promptTemplatesRoot = path.join(repoRoot, "prompt-templates");

const restoredParityFiles = [
  "design-templates/html-ppt/.clawscan-allow",
  "design-templates/open-design-landing/assets/agents/anthropic.svg",
  "design-templates/open-design-landing/assets/agents/deepseek.svg",
  "design-templates/open-design-landing/assets/agents/gemini.svg",
  "design-templates/open-design-landing/assets/agents/minimax.svg",
  "design-templates/open-design-landing/assets/agents/moonshot.svg",
  "design-templates/open-design-landing/assets/agents/openai.svg",
  "design-templates/open-design-landing/assets/agents/qwen.svg",
  "design-templates/open-design-landing/assets/agents/xai.svg",
  "design-templates/open-design-landing/assets/agents/xiaomi.svg",
  "design-templates/open-design-landing/assets/agents/zhipu.svg",
  "prompt-templates/video/video-seedance-desk-hologram-ar-realdesk.json",
  "skills/brandkit/LICENSE",
  "skills/brandkit/SKILL.md",
  "skills/ecommerce-image-workflow/SKILL.md",
  "skills/ecommerce-image-workflow/example.html",
  "skills/ecommerce-image-workflow/references/checklist.md",
  "skills/export-download-debugging/SKILL.md",
  "skills/frontend-design/LICENSE.txt",
  "skills/gsap-frameworks/SKILL.md",
  "skills/gsap-performance/SKILL.md",
  "skills/gsap-plugins/SKILL.md",
  "skills/gsap-utils/SKILL.md",
  "skills/image-to-code-skill/SKILL.md",
  "skills/imagegen-frontend-mobile/SKILL.md",
  "skills/imagegen-frontend-web/SKILL.md",
  "skills/pr-feedback-quality-gate/SKILL.md",
  "skills/reference-design-contract/SKILL.md",
  "skills/reference-design-contract/example.html",
  "skills/reference-design-contract/references/checklist.md",
  "skills/research-decision-room/SKILL.md",
  "skills/research-decision-room/example.html",
  "skills/research-decision-room/references/checklist.md",
  "skills/research-decision-room/references/evidence-model.md",
  "skills/stitch-skill/DESIGN.md",
  "skills/stitch-skill/SKILL.md",
  "skills/taste-skill-v1/SKILL.md",
  "skills/taste-skill/LICENSE",
] as const;

const restoredSkillIds = [
  "brandkit",
  "ecommerce-image-workflow",
  "export-download-debugging",
  "frontend-design",
  "gsap-frameworks",
  "gsap-performance",
  "gsap-plugins",
  "gsap-utils",
  "image-to-code",
  "imagegen-frontend-mobile",
  "imagegen-frontend-web",
  "pr-feedback-quality-gate",
  "reference-design-contract",
  "research-decision-room",
  "stitch-design-taste",
  "design-taste-frontend-v1",
] as const;

function repoPath(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

test("ported #49 upstream skill and template files stay present", () => {
  for (const relativePath of restoredParityFiles) {
    assert.equal(existsSync(repoPath(relativePath)), true, `${relativePath} is missing`);
  }
});

test("ported #49 skills load through the built-in skill registry", async () => {
  const skills = await listSkills(skillsRoot);
  const byId = new Map(skills.map((skill) => [skill.id, skill]));

  for (const skillId of restoredSkillIds) {
    assert.ok(byId.has(skillId), `${skillId} is missing from listSkills()`);
  }

  assert.equal(byId.get("ecommerce-image-workflow")?.mode, "image");
  assert.match(byId.get("ecommerce-image-workflow")?.body ?? "", /references\/checklist\.md/);
  assert.equal(byId.get("reference-design-contract")?.mode, "design-system");
  assert.match(byId.get("reference-design-contract")?.body ?? "", /example\.html/);
  assert.equal(byId.get("research-decision-room")?.mode, "prototype");
  assert.match(byId.get("research-decision-room")?.body ?? "", /evidence-model\.md/);
  assert.equal(byId.get("stitch-design-taste")?.mode, "design-system");
});

test("ported #49 video prompt template loads through the prompt registry", async () => {
  const templateId = "video-seedance-desk-hologram-ar-realdesk";
  const template = await readPromptTemplate(promptTemplatesRoot, "video", templateId);
  assert.ok(template);
  assert.equal(template.id, templateId);
  assert.equal(template.surface, "video");
  assert.equal(template.source.repo, "nexu-io/open-design");
  assert.match(template.prompt, /Seedance 2\.0/);

  const listed = await listPromptTemplates(promptTemplatesRoot);
  assert.ok(
    listed.some((entry) => entry.id === templateId && entry.surface === "video"),
    `${templateId} is missing from listPromptTemplates()`,
  );
});

test("guard runs the #49 skill and template parity check", () => {
  const manifest = JSON.parse(readFileSync(repoPath("package.json"), "utf8")) as {
    readonly scripts?: Readonly<Record<string, string>>;
  };

  assert.match(manifest.scripts?.guard ?? "", /scripts\/skills-template-parity\.test\.ts/);
});
