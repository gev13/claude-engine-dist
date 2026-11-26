'use client';

import { ChoiceField, ColorField, LengthField } from '@/components/admin/styleFields';

type Path = readonly (string | number)[];

/** 3.37 — Appearance → Form fields: the placeholder, and a text box's own corners, top padding and grip. Every form the site draws takes them. */
export function FieldsExtraFields({ get, set }: { get: (path: Path) => string | undefined; set: (path: Path) => (value: unknown) => void }) {
  return (
    <>
      <ColorField label="Placeholder colour" hint="the hint inside an empty field" placeholder="the muted text" value={get(['fields', 'placeholder'])} onChange={set(['fields', 'placeholder'])} />
      <LengthField label="Placeholder letter spacing" placeholder="e.g. -0.2px" emptyLabel="as the field’s text" value={get(['fields', 'placeholderTracking'])} onChange={set(['fields', 'placeholderTracking'])} />
      <LengthField label="Text box corners" placeholder="e.g. 16px" emptyLabel="as the fields’ corners" value={get(['fields', 'textareaRadius'])} onChange={set(['fields', 'textareaRadius'])} />
      <LengthField label="Text box space at the top" placeholder="e.g. 16px" emptyLabel="as drawn" value={get(['fields', 'textareaPaddingTop'])} onChange={set(['fields', 'textareaPaddingTop'])} />
      <ChoiceField
        label="Text box resize grip"
        value={get(['fields', 'textareaResize']) as 'none' | 'vertical' | undefined}
        inherited="vertical"
        options={[
          { value: 'vertical', label: 'Shown — it can be pulled taller' },
          { value: 'none', label: 'None' },
        ]}
        onChange={set(['fields', 'textareaResize'])}
      />
    </>
  );
}
