"use client";

import { useId, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { en } from "@/messages/en";
import { Button } from "@/components/ui/button";
import { InspectorEmptyState } from "@/components/inspector/inspector-empty-state";
import { useKnowledge } from "@/components/knowledge/knowledge-provider";
import { UniverseNameText } from "@/components/universes/universe-name-text";
import { useWorkspaceLayout } from "@/components/workspace/workspace-layout";
import { useWorkspaceState } from "@/components/workspace/workspace-state";
import type { EntityDetailsDto, PointDto, RelationshipReadingDto } from "@/modules/knowledge";

const ENTITY_TYPE_LABELS: Readonly<Record<string, string>> = en.knowledge.entityTypes;
const STATUS_TEXTS: Readonly<Record<string, { label: string }>> = en.entityCreation.statuses;

/** The fewest entities a relationship needs: a source and a different target (FR-7). */
const ENTITIES_NEEDED_FOR_A_RELATIONSHIP = 2;

// The details panel (spec 006, FR-10): while an entity is selected, its name, type, introduction point,
// first fragment and every relationship as read from it, with the way to the relationship form; else an
// honest state that invites selecting an entity or says the universe has none. What the panel does not
// show yet (events, sources, reading positions) is said under every state. Every text of the person is
// plain text that wraps inside the panel (004 FR-19).
export function EntityDetailsPanel() {
  const { state } = useWorkspaceState();
  if (state.selectedUniverseId === null) return <InspectorEmptyState />;

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto p-4">
      <EntityDetailsContent />
      <p className="text-ink-muted text-sm">{en.inspector.emptyText}</p>
    </div>
  );
}

function EntityDetailsContent(): ReactNode {
  const { state } = useWorkspaceState();
  const { knowledgeLoad, retryKnowledgeLoad, entityDetailsLoad, retryEntityDetailsLoad } = useKnowledge();

  if (state.selectedEntityId !== null && entityDetailsLoad !== null) {
    if (entityDetailsLoad.phase === "loading") {
      return (
        <p role="status" className="text-ink-muted text-sm">
          {en.entityDetails.loading}
        </p>
      );
    }
    if (entityDetailsLoad.phase === "failed") {
      return <LoadFailure message={en.entityDetails.loadFailed} onTryAgain={retryEntityDetailsLoad} />;
    }
    return <EntityDetailsView details={entityDetailsLoad.details} />;
  }

  if (knowledgeLoad === null || knowledgeLoad.phase === "loading") {
    return (
      <p role="status" className="text-ink-muted text-sm">
        {en.entityDetails.loadingUniverse}
      </p>
    );
  }
  if (knowledgeLoad.phase === "failed") {
    return <LoadFailure message={en.entityList.loadFailed} onTryAgain={retryKnowledgeLoad} />;
  }
  if (knowledgeLoad.knowledge.entities.length === 0) {
    return <PanelMessage title={en.entityDetails.noEntitiesTitle} text={en.entityDetails.noEntitiesText} />;
  }
  return <PanelMessage title={en.entityDetails.selectEntityTitle} text={en.entityDetails.selectEntityText} />;
}

function PanelMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-serif text-lg">{title}</h3>
      <p className="text-ink-muted text-sm">{text}</p>
    </div>
  );
}

function LoadFailure({ message, onTryAgain }: { message: string; onTryAgain: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p role="status" className="text-ink text-sm">
        {message}
      </p>
      <Button variant="secondary" size="sm" onClick={onTryAgain}>
        {en.knowledge.tryAgain}
      </Button>
    </div>
  );
}

function EntityDetailsView({ details }: { details: EntityDetailsDto }) {
  const headingId = useId();
  const fragmentHeadingId = useId();
  const relationshipsHeadingId = useId();

  return (
    <article aria-labelledby={headingId} className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-2">
        <h3 id={headingId} className="font-serif text-lg">
          <UniverseNameText text={details.name} />
        </h3>
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-muted">{en.entityDetails.typeLabel}</dt>
          <dd>{ENTITY_TYPE_LABELS[details.type] ?? details.type}</dd>
          <dt className="text-ink-muted">{en.entityDetails.introducedAtLabel}</dt>
          <dd className="min-w-0">
            <PointText point={details.introducedAt} />
          </dd>
        </dl>
      </div>

      <section aria-labelledby={fragmentHeadingId} className="flex min-w-0 flex-col gap-2">
        <h4 id={fragmentHeadingId} className="text-sm font-medium">
          {en.entityDetails.firstFragmentHeading}
        </h4>
        {details.firstFragment === null ? (
          <p className="text-ink-muted text-sm">{en.entityDetails.noFragment}</p>
        ) : (
          <>
            {/* The content keeps its line breaks, is shown whole and wraps inside the panel (FR-10). */}
            <p className="min-w-0 text-sm whitespace-pre-wrap [overflow-wrap:anywhere] [unicode-bidi:plaintext]">
              {details.firstFragment.content}
            </p>
            <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-muted">{en.entityDetails.statusLabel}</dt>
              <dd>{STATUS_TEXTS[details.firstFragment.status]?.label ?? details.firstFragment.status}</dd>
              <dt className="text-ink-muted">{en.entityDetails.revealedAtLabel}</dt>
              <dd className="min-w-0">
                <PointText point={details.firstFragment.point} />
              </dd>
            </dl>
          </>
        )}
      </section>

      <section aria-labelledby={relationshipsHeadingId} className="flex min-w-0 flex-col gap-2">
        <h4 id={relationshipsHeadingId} className="text-sm font-medium">
          {en.entityDetails.relationshipsHeading}
        </h4>
        {details.relationships.length === 0 ? (
          <p className="text-ink-muted text-sm">{en.entityDetails.noRelationships}</p>
        ) : (
          <ul aria-labelledby={relationshipsHeadingId} className="flex min-w-0 flex-col gap-2">
            {details.relationships.map((relationship) => (
              <RelationshipItem key={relationship.id} relationship={relationship} />
            ))}
          </ul>
        )}
        <NewRelationshipEntry />
      </section>
    </article>
  );
}

/** "<subject> — <label> → <other>" as read from the entity of the panel, with its status and point. */
function RelationshipItem({ relationship }: { relationship: RelationshipReadingDto }) {
  const { afterSubject, afterLabel } = en.entityDetails.readingConnectors;

  return (
    <li className="border-line rounded-control flex min-w-0 flex-col gap-0.5 border px-2 py-1.5 text-sm">
      <p className="min-w-0">
        <UniverseNameText text={relationship.subjectName} className="font-medium" />
        {afterSubject}
        {relationship.label}
        {afterLabel}
        <UniverseNameText text={relationship.otherName} className="font-medium" />
      </p>
      <p className="text-ink-muted min-w-0 text-xs">
        {STATUS_TEXTS[relationship.status]?.label ?? relationship.status}
        {" · "}
        <PointText point={relationship.point} />
      </p>
    </li>
  );
}

function PointText({ point }: { point: PointDto }) {
  return (
    <span className="[overflow-wrap:anywhere]">
      {en.entityDetails.pointUnitOf(en.unitPicker.wordingLabels[point.unitWording], point.unitLabel)}{" "}
      <UniverseNameText text={point.workTitle} />
    </span>
  );
}

/** The way to the relationship form, which proposes the selected entity as source; or why there is none yet. */
function NewRelationshipEntry(): ReactNode {
  const { dispatch } = useWorkspaceState();
  const { knowledgeLoad } = useKnowledge();
  const { closeInspectorAfterNavigation } = useWorkspaceLayout();
  if (knowledgeLoad?.phase !== "loaded") return null;

  if (knowledgeLoad.knowledge.entities.length < ENTITIES_NEEDED_FOR_A_RELATIONSHIP) {
    return <p className="text-ink-muted text-sm">{en.relationshipCreation.twoEntitiesNeeded}</p>;
  }

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          dispatch({ type: "knowledgeFormOpened", form: "relationship" });
          // On a narrow screen the panel is a drawer over the form; it closes so the form is reachable.
          closeInspectorAfterNavigation();
        }}
      >
        <Plus aria-hidden />
        {en.entityDetails.newRelationship}
      </Button>
    </div>
  );
}
