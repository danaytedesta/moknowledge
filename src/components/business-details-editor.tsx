"use client";

import KnowledgeFieldEditor from "@/components/knowledge-field-editor";
import KnowledgeListEditor from "@/components/knowledge-list-editor";
import type { KnowledgeBase, KnowledgeField } from "@/types/knowledge";

interface BusinessDetailsEditorProps {
  profile: KnowledgeBase;
  onChange: (profile: KnowledgeBase) => void;
  section?: "business" | "brand";
}

interface TextField {
  label: string;
  optional?: boolean;
  field: KnowledgeField<string>;
  update: (field: KnowledgeField<string>) => void;
}

interface ListField {
  label: string;
  optional?: boolean;
  field: KnowledgeField<string[]>;
  update: (field: KnowledgeField<string[]>) => void;
}

interface EntryGroup {
  label: string;
  fields: KnowledgeField<string>[];
  update: (fields: KnowledgeField<string>[]) => void;
}

interface Section {
  id: "positioning" | "market" | "brand";
  title: string;
  textFields: TextField[];
  listFields: ListField[];
  entryGroups: EntryGroup[];
}

type MarketListKey =
  | "targetBuyers"
  | "customerNeeds"
  | "industryGroupings"
  | "channels"
  | "funnels";

type Person = KnowledgeBase["people"][number];
type PersonField = "name" | "title" | "role" | "background" | "gender";

const sectionStyle = "kb-group";

const summaryStyle = "kb-group-title";

const buttonStyle =
  "rounded border border-[#CEC3B7] px-3 py-2 text-sm text-[#705747] hover:bg-[#F2EDE6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#705747]";

const controlStyle =
  "mt-2 w-full rounded-lg border border-[#CEC3B7] bg-[#FAF8F5] px-4 py-3 text-[#3F352E] outline-none focus:border-[#785E4B] focus:ring-2 focus:ring-[#785E4B]/20";

// New entries begin empty. Adding a field does not confirm its contents.
function emptyText(): KnowledgeField<string> {
  return {
    value: null,
    origin: "owner",
    evidence: [],
    confirmedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

// These collections store evidence separately for every entry.
// They differ from fields such as targetBuyers, which share list metadata.
function EvidenceEntries({ label, fields, update }: EntryGroup) {
  return (
    <div>
      <h3 className="font-bold">{label}</h3>

      {fields.length === 0 && (
        <p className="mt-2 text-sm text-[#756D66]">
          Nothing added yet. Leave blank if unknown.
        </p>
      )}

      <div className="mt-3 space-y-4">
        {fields.map((field, index) => (
          <div
            key={index}
            className="space-y-3 rounded-lg border border-[#DED6CD] p-4"
          >
            <KnowledgeFieldEditor
              label={`${label}: item ${index + 1}`}
              field={field}
              multiline
              onChange={(updated) =>
                update(
                  fields.map((item, itemIndex) =>
                    itemIndex === index ? updated : item,
                  ),
                )
              }
            />

            <button
              type="button"
              className={buttonStyle}
              onClick={() => {
                if (window.confirm("Remove this entry?")) {
                  update(fields.filter((_, itemIndex) => itemIndex !== index));
                }
              }}
            >
              Remove entry
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={`${buttonStyle} mt-3`}
        onClick={() => update([...fields, emptyText()])}
      >
        Add entry
      </button>
    </div>
  );
}

export default function BusinessDetailsEditor({
  profile,
  onChange,
  section = "business",
}: BusinessDetailsEditorProps) {
  // All changes update the same profile used by Save and Download JSON.
  function commit(changes: Partial<KnowledgeBase>) {
    onChange({
      ...profile,
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  }

  function updatePositioning(
    key: "pitch" | "foundingStory",
    field: KnowledgeField<string>,
  ) {
    commit({
      positioning: { ...profile.positioning, [key]: field },
    });
  }

  function updateMarketText(
    key: "idealCustomerPersona" | "industryOutlook",
    field: KnowledgeField<string>,
  ) {
    commit({
      market: { ...profile.market, [key]: field },
    });
  }

  function updateMarketList(
    key: MarketListKey,
    field: KnowledgeField<string[]>,
  ) {
    commit({
      market: { ...profile.market, [key]: field },
    });
  }

  function updateBranding(
    key: "writingStyle" | "artStyle",
    field: KnowledgeField<string>,
  ) {
    commit({
      branding: { ...profile.branding, [key]: field },
    });
  }

  function updatePerson(
    id: string,
    key: PersonField,
    field: KnowledgeField<string>,
  ) {
    commit({
      people: profile.people.map((person) =>
        person.id === id ? { ...person, [key]: field } : person,
      ),
    });
  }

  function addPerson() {
    const person: Person = {
      id: crypto.randomUUID(),
      name: emptyText(),
      title: emptyText(),
      role: emptyText(),
      background: emptyText(),
      gender: emptyText(),
    };

    commit({ people: [...profile.people, person] });
  }

  function addSocialProfile() {
    commit({
      socialProfiles: [
        ...profile.socialProfiles,
        {
          id: crypto.randomUUID(),
          platform: "",
          url: emptyText(),
        },
      ],
    });
  }

  // Configuration keeps the shared category layout in one place.
  const sections: Section[] = [
    {
      id: "positioning",
      title: "What makes your business stand out",
      textFields: [
        {
          label: "Your business in a few words",
          field: profile.positioning.pitch,
          update: (field) => updatePositioning("pitch", field),
        },
        {
          label: "How your business started",
          field: profile.positioning.foundingStory,
          update: (field) => updatePositioning("foundingStory", field),
        },
      ],
      listFields: [],
      entryGroups: [
        {
          label: "What makes your business different",
          fields: profile.positioning.differentiators,
          update: (differentiators) =>
            commit({
              positioning: {
                ...profile.positioning,
                differentiators,
              },
            }),
        },
      ],
    },
    {
      id: "market",
      title: "Customers and market",
      textFields: [
        {
          label: "Your ideal customer",
          field: profile.market.idealCustomerPersona,
          update: (field) => updateMarketText("idealCustomerPersona", field),
        },
        {
          label: "Where your industry is heading",
          optional: true,
          field: profile.market.industryOutlook,
          update: (field) => updateMarketText("industryOutlook", field),
        },
      ],
      listFields: [
        {
          label: "Customers you currently serve",
          field: profile.market.targetBuyers,
          update: (field) => updateMarketList("targetBuyers", field),
        },
        {
          label: "Customer needs",
          field: profile.market.customerNeeds,
          update: (field) => updateMarketList("customerNeeds", field),
        },
        {
          label: "Industry categories",
          optional: true,
          field: profile.market.industryGroupings,
          update: (field) => updateMarketList("industryGroupings", field),
        },
        {
          label: "Marketing channels",
          field: profile.market.channels,
          update: (field) => updateMarketList("channels", field),
        },
        {
          label: "How people become customers",
          optional: true,
          field: profile.market.funnels,
          update: (field) => updateMarketList("funnels", field),
        },
      ],
      entryGroups: [
        {
          label: "Actions found on your website",
          fields: profile.market.callsToAction,
          update: (callsToAction) =>
            commit({
              market: { ...profile.market, callsToAction },
            }),
        },
        {
          label: "Suppliers and partners",
          fields: profile.market.suppliersAndPartners,
          update: (suppliersAndPartners) =>
            commit({
              market: { ...profile.market, suppliersAndPartners },
            }),
        },
      ],
    },
    {
      id: "brand",
      title: "Writing and visual style",
      textFields: [
        {
          label: "Writing style",
          field: profile.branding.writingStyle,
          update: (field) => updateBranding("writingStyle", field),
        },
        {
          label: "Visual style",
          field: profile.branding.artStyle,
          update: (field) => updateBranding("artStyle", field),
        },
      ],
      listFields: [],
      entryGroups: [],
    },
  ];

  const personFields: {
    key: PersonField;
    label: string;
    multiline?: boolean;
  }[] = [
    { key: "name", label: "Name" },
    { key: "title", label: "Job title" },
    { key: "role", label: "Role in the business" },
    { key: "background", label: "Background", multiline: true },
    { key: "gender", label: "Gender — optional, only if explicitly provided" },
  ];

  return (
    <>
      {sections
        .filter((group) =>
          section === "brand" ? group.id === "brand" : group.id !== "brand",
        )
        .map((group) => (
          <section key={group.title} className={sectionStyle}>
            <h4 className={summaryStyle}>{group.title}</h4>

            <p className="mt-3 text-sm text-[#756D66]">
              Review the details you want your content to reflect.
            </p>

            <div className="mt-5 space-y-6">
              {group.textFields
                .filter((item) => !item.optional)
                .map((item) => (
                  <KnowledgeFieldEditor
                    key={item.label}
                    label={item.label}
                    field={item.field}
                    onChange={item.update}
                    multiline
                  />
                ))}

              {group.listFields
                .filter((item) => !item.optional)
                .map((item) => (
                  <KnowledgeListEditor
                    key={item.label}
                    label={item.label}
                    field={item.field}
                    onChange={item.update}
                  />
                ))}

              {group.id === "market" && (
                <details className="kb-optional">
                  <summary>
                    More market context{" "}
                    <span className="kb-optional-tag">Optional</span>
                  </summary>
                  <div className="kb-fields">
                    {group.textFields
                      .filter((item) => item.optional)
                      .map((item) => (
                        <KnowledgeFieldEditor
                          key={item.label}
                          label={item.label}
                          field={item.field}
                          onChange={item.update}
                          multiline
                        />
                      ))}
                    {group.listFields
                      .filter((item) => item.optional)
                      .map((item) => (
                        <KnowledgeListEditor
                          key={item.label}
                          label={item.label}
                          field={item.field}
                          onChange={item.update}
                        />
                      ))}
                  </div>
                </details>
              )}

              {group.entryGroups.map((group) => (
                <EvidenceEntries key={group.label} {...group} />
              ))}
            </div>
          </section>
        ))}

      {section === "business" && (
        <>
          {/* People stay optional; names and gender are never guessed. */}
          <section className={sectionStyle}>
            <h4 className={summaryStyle}>
              Key people ({profile.people.length})
            </h4>

            <p className="mt-3 text-sm text-[#756D66]">
              Add public business contacts where useful. Unknown details can
              stay blank.
            </p>

            <div className="mt-5 space-y-4">
              {profile.people.length === 0 && (
                <p className="text-sm text-[#756D66]">No people added yet.</p>
              )}

              {profile.people.map((person) => (
                <details key={person.id} className="kb-item">
                  <summary className="font-bold">
                    {person.name.value || "New person"}
                  </summary>

                  <div className="kb-item-body kb-fields">
                    {personFields.map((item) => (
                      <KnowledgeFieldEditor
                        key={item.key}
                        label={item.label}
                        field={person[item.key]}
                        multiline={item.multiline}
                        onChange={(field) =>
                          updatePerson(person.id, item.key, field)
                        }
                      />
                    ))}

                    <button
                      type="button"
                      className={buttonStyle}
                      onClick={() => {
                        if (window.confirm("Remove this person?")) {
                          commit({
                            people: profile.people.filter(
                              (item) => item.id !== person.id,
                            ),
                          });
                        }
                      }}
                    >
                      Remove person
                    </button>
                  </div>
                </details>
              ))}
            </div>

            <button
              type="button"
              className={`${buttonStyle} mt-4`}
              onClick={addPerson}
            >
              Add person
            </button>
          </section>

          {/* URLs remain plain text rather than rendering scraped HTML. */}
          <section className={sectionStyle}>
            <h4 className={summaryStyle}>
              Social profiles ({profile.socialProfiles.length})
            </h4>

            <div className="mt-5 space-y-4">
              {profile.socialProfiles.length === 0 && (
                <p className="text-sm text-[#756D66]">
                  No social profiles added yet.
                </p>
              )}

              {profile.socialProfiles.map((social) => (
                <div
                  key={social.id}
                  className="space-y-4 rounded-lg border border-[#DED6CD] p-4"
                >
                  <label className="block font-bold">
                    Platform
                    <input
                      type="text"
                      maxLength={80}
                      value={social.platform}
                      placeholder="For example: Instagram"
                      className={controlStyle}
                      onChange={(event) =>
                        commit({
                          socialProfiles: profile.socialProfiles.map((item) =>
                            item.id === social.id
                              ? { ...item, platform: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>

                  <KnowledgeFieldEditor
                    label="Profile URL"
                    field={social.url}
                    placeholder="https://..."
                    onChange={(url) =>
                      commit({
                        socialProfiles: profile.socialProfiles.map((item) =>
                          item.id === social.id ? { ...item, url } : item,
                        ),
                      })
                    }
                  />

                  <button
                    type="button"
                    className={buttonStyle}
                    onClick={() => {
                      if (window.confirm("Remove this social profile?")) {
                        commit({
                          socialProfiles: profile.socialProfiles.filter(
                            (item) => item.id !== social.id,
                          ),
                        });
                      }
                    }}
                  >
                    Remove social profile
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className={`${buttonStyle} mt-4`}
              onClick={addSocialProfile}
            >
              Add social profile
            </button>
          </section>
        </>
      )}
    </>
  );
}
