export type EditableDraftStatus = 'Reviewed' | 'Needs review' | 'Generated';

export interface EditableDraftSection {
  id: string;
  title: string;
  status: EditableDraftStatus;
  lineage: string;
  requirements: string;
  content: string;
  locked?: boolean;
  editedAt?: string;
}

export function markSectionEdited(
  sections: EditableDraftSection[],
  sectionId: string,
  patch: Partial<Pick<EditableDraftSection, 'title' | 'content'>>,
  editedAt = new Date().toISOString()
): EditableDraftSection[] {
  return sections.map((section) =>
    section.id === sectionId
      ? {
          ...section,
          ...patch,
          status: 'Reviewed',
          locked: true,
          editedAt,
        }
      : section
  );
}

export function toggleSectionLock(sections: EditableDraftSection[], sectionId: string): EditableDraftSection[] {
  return sections.map((section) =>
    section.id === sectionId
      ? {
          ...section,
          locked: !section.locked,
        }
      : section
  );
}

function cleanGeneratedSection(section: EditableDraftSection): EditableDraftSection {
  const { locked: _locked, editedAt: _editedAt, ...cleaned } = section;
  return cleaned;
}

function findCurrentSectionForGenerated(
  current: EditableDraftSection[],
  generated: EditableDraftSection[],
  generatedIndex: number
) {
  const generatedSection = generated[generatedIndex];
  return current.find((section) => section.id === generatedSection.id) || current[generatedIndex];
}

export function mergeGeneratedDraftSections(
  current: EditableDraftSection[],
  generated: EditableDraftSection[]
): EditableDraftSection[] {
  const merged = generated.map((section, index) => {
    const existing = findCurrentSectionForGenerated(current, generated, index);
    if (existing?.locked) {
      return existing;
    }
    return cleanGeneratedSection(section);
  });

  const mergedIds = new Set(merged.map((section) => section.id));
  const lockedRemainders = current.filter((section) => section.locked && !mergedIds.has(section.id));
  return [...merged, ...lockedRemainders];
}

export function replaceDraftSectionFromGenerated(
  current: EditableDraftSection[],
  generated: EditableDraftSection[],
  targetSectionId: string
): EditableDraftSection[] {
  const targetIndex = current.findIndex((section) => section.id === targetSectionId);
  if (targetIndex === -1) {
    return current;
  }

  const target = current[targetIndex];
  if (target.locked) {
    return current;
  }

  const replacement =
    generated.find((section) => section.id === target.id) ||
    generated[targetIndex] ||
    generated[0];

  if (!replacement) {
    return current;
  }

  return current.map((section) =>
    section.id === targetSectionId
      ? {
          ...cleanGeneratedSection(replacement),
          id: section.id,
        }
      : section
  );
}
