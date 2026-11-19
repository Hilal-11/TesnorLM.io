"use client";

import { Badge } from "@/components/ui/badge";
import { CheckboxField } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsGroup, SettingsRow, useAutoSave } from "@/components/ui/settings-group";
import { SettingsSection } from "@/components/ui/settings-section";
import { Demo, ShowcaseSection } from "../showcase";

// Demo save: resolves after a short delay, like a network call.
const fakeSave = () => new Promise<void>((resolve) => setTimeout(resolve, 250));

function LearningSettings() {
  const autoSave = useAutoSave<unknown>(fakeSave);
  return (
    <SettingsSection
      title="Learning"
      description="How TensorLM explains things to you. Changes save as you make them."
    >
      <SettingsGroup title="Answers">
        <SettingsRow
          label="Show citations inline"
          description="Numbered chips after each claim, linked to the passage they came from."
          badge={<Badge variant="cobalt">Recommended</Badge>}
          defaultChecked
          onCheckedChange={autoSave}
        />
        <SettingsRow
          label="Allow general knowledge"
          description={<>Answer beyond your sources, marked &ldquo;Not from your sources&rdquo;.</>}
          onCheckedChange={autoSave}
        />
        <SettingsRow
          label="Explain at a set level"
          description="Otherwise TensorLM matches the level of your question."
          defaultChecked
          onCheckedChange={autoSave}
          right={
            <Select defaultValue="intermediate" onValueChange={autoSave}>
              <SelectTrigger aria-label="Explanation level" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title="Diagrams"
        description="Diagrams draw themselves step by step as the answer explains them."
      >
        <SettingsRow
          label="Show diagrams automatically"
          description="Draw a diagram when an answer explains a process or structure."
          defaultChecked
          onCheckedChange={autoSave}
        >
          <CheckboxField
            label="Animate the drawing"
            description="Off when your device asks for reduced motion."
            defaultChecked
          />
          <CheckboxField
            label="Add a text description"
            description="Lists every node and connection."
            defaultChecked
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Quizzes">
        <SettingsRow
          label="Quiz me after each answer"
          description="One question to check you followed."
          disabled
          disabledReason="Available on the Student plan"
        />
        <SettingsRow
          label="Spaced repetition reminders"
          description="Bring back questions you missed, a few days later."
          onCheckedChange={autoSave}
        >
          <CheckboxField label="Email reminders" />
          <CheckboxField label="Only on weekdays" />
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
  );
}

export function SettingsShowcaseSection() {
  return (
    <ShowcaseSection
      id="settings"
      title="Settings"
      usage="Settings save as you change them, with a Saved toast; there is no Save button. Nested options appear under the switch that enables them. Disabled rows say why."
    >
      <Demo title="Live example" note="Turn on a row with nested options to reveal them.">
        <LearningSettings />
      </Demo>
    </ShowcaseSection>
  );
}
