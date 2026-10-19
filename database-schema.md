# Database Schema Design

The prototype saves profiles in browser localStorage. This document proposes a PostgreSQL/Supabase design for a future version with accounts, multiple companies, and knowledge-base version history.

This design is not connected to the current app. It describes tables, relationships, and access rules; it is not an executable migration. The policies would need implementation and testing before deployment.

## 1. Companies

One record per business workspace.

| Column | Type | Constraints / purpose |
| --- | --- | --- |
| id | uuid | Primary key; defaults to gen_random_uuid() |
| name | text | Required; nonempty |
| website | text | Required; validated by the application |
| created_by | uuid | Required; references auth.users(id) |
| created_at | timestamptz | Required; defaults to now() |
| updated_at | timestamptz | Required; defaults to now() |

Website is not globally unique. Separate customer workspaces may reference the same public website.

A controlled transaction creates the company and its initial owner membership together.

## 2. Company members

Connects users to companies and defines their access.

| Column | Type | Constraints / purpose |
| --- | --- | --- |
| company_id | uuid | Required; references companies(id) |
| user_id | uuid | Required; references auth.users(id) |
| role | text | Required; CHECK value is owner, editor, or viewer |
| created_at | timestamptz | Required; defaults to now() |

Primary key: `(company_id, user_id)`.

A user can belong to multiple companies. A company can have multiple members.

- **Owner:** manages membership and business settings, and can edit knowledge.
- **Editor:** creates and edits knowledge bases and requests scraping.
- **Viewer:** reads company knowledge without changing it.

## 3. Knowledge bases

Identifies a knowledge base and stores its editable working copy.

| Column | Type | Constraints / purpose |
| --- | --- | --- |
| id | uuid | Primary key; defaults to gen_random_uuid() |
| company_id | uuid | Required; references companies(id) |
| title | text | Required; nonempty |
| draft_profile | jsonb | Required; CHECK jsonb_typeof(draft_profile) = 'object' |
| draft_revision | integer | Required; defaults to 1; CHECK greater than 0 |
| schema_version | text | Required; initially '1.0' |
| created_by | uuid | Required; references auth.users(id) |
| updated_by | uuid | Required; references auth.users(id) |
| created_at | timestamptz | Required; defaults to now() |
| updated_at | timestamptz | Required; defaults to now() |
| archived_at | timestamptz | Nullable; supports archiving |

A company can have multiple knowledge bases.

The JSON profile follows the application's `KnowledgeBase` structure. It includes company facts, offerings, branding, people, sources, and marketing preferences.

Validate the complete JSON against its schema version before writing. The JSON object constraint alone does not verify its fields, and TypeScript types do not validate incoming data at runtime.

The relational record ID is authoritative. Any ID inside exported JSON must match it. Company ownership comes from the relational `company_id`, never from a value supplied inside the JSON.

`updated_at` defaults only set its initial value. A database trigger or controlled write operation must refresh it when the record changes, set `updated_by`, and increment `draft_revision`.

## 4. Knowledge-base versions

Stores immutable snapshots when a user saves a version.

| Column | Type | Constraints / purpose |
| --- | --- | --- |
| id | uuid | Primary key; defaults to gen_random_uuid() |
| knowledge_base_id | uuid | Required; references knowledge_bases(id) |
| version_number | integer | Required; CHECK greater than 0 |
| profile | jsonb | Required; CHECK jsonb_typeof(profile) = 'object' |
| schema_version | text | Required |
| change_note | text | Nullable |
| created_by | uuid | Required; references auth.users(id) |
| created_at | timestamptz | Required; defaults to now() |

Unique constraint: `(knowledge_base_id, version_number)`.

Saving a version uses a controlled transaction that checks membership, locks the parent knowledge-base record, checks the expected draft revision, assigns the next version number, and inserts a validated snapshot. Draft updates and version creation must use the same concurrency rules so the saved snapshot represents the intended revision.

Versions are never edited in place. Restoring an older version copies it into the working draft and can create a new version, preserving the intervening history.

## 5. Scrape runs

Records collection attempts and partial failures.

| Column | Type | Constraints / purpose |
| --- | --- | --- |
| id | uuid | Primary key; defaults to gen_random_uuid() |
| knowledge_base_id | uuid | Required; references knowledge_bases(id) |
| requested_url | text | Required; validated by the server |
| status | text | Required; defaults to queued; CHECK queued, running, completed, partial, or failed |
| page_count | integer | Required; defaults to 0; CHECK nonnegative |
| warnings | jsonb | Required; defaults to '[]'::jsonb; CHECK JSON array |
| error_message | text | Nullable; sanitized customer-facing message |
| requested_by | uuid | Required; references auth.users(id) |
| started_at | timestamptz | Nullable |
| completed_at | timestamptz | Nullable |
| created_at | timestamptz | Required; defaults to now() |

Owners and editors can request a run through a controlled operation. New requests start as queued, with no results. Only the trusted worker updates processing status, page counts, warnings, errors, and processing timestamps.

Keep credentials and internal networking errors out of customer-visible records.

## Relationships

- Company → many company members.
- User → many company memberships.
- Company → many knowledge bases.
- Knowledge base → many immutable versions.
- Knowledge base → many scrape runs.

Membership determines access through the parent company. Versions and scrape runs do not accept a separate, potentially conflicting company ID.

## Why use JSONB for the profile?

The knowledge base contains nested categories, optional fields, arrays, and field-level evidence. JSONB preserves that structure and keeps stored snapshots close to exported JSON.

Companies, membership, versions, and scrape runs remain relational because they need explicit relationships and access rules.

Offerings or claims could become separate tables later if reporting across profiles becomes important. For this design, complete snapshots make review and restoration simpler.

## Provenance and confirmation

Each knowledge field retains:

- Its value, or null when unknown.
- Its origin: extracted, inferred, measured, or owner.
- Source URLs and supporting snippets.
- Confirmation and update timestamps.

Owner confirmation does not overwrite the original evidence or independently verify a claim. Marketing approvals and review dates remain inside each saved profile snapshot.

## Row Level Security considerations

Enable RLS on every application table and restrict access to authenticated users with the appropriate company membership. Pair policies with table, column, and function privileges.

### Reading

A user can read a company only when they are a member. Knowledge bases, versions, and scrape runs inherit access through their parent company.

### Editing

Owners and editors can create and update drafts. Viewers cannot write. Only owners can change company settings.

Update policies must check both existing rows and proposed rows using `USING` and `WITH CHECK`. Parent IDs should remain immutable during ordinary edits, preventing records from being reassigned through a general update endpoint.

Creator and requester fields must match the authenticated user on insert. Controlled writes set the updating user from authentication rather than trusting client-supplied audit fields.

### Membership

Only owners can manage membership. Users cannot grant themselves membership or escalate their role.

Use controlled operations for ownership changes and prevent removing or demoting the final owner. Serialize ownership changes per company so simultaneous requests cannot bypass that rule.

Membership lookup helpers must avoid recursive RLS queries. Any privileged helper needs a fixed search path, narrowly scoped permissions, and restricted execution access.

### Version history

Authorized members can read snapshots. Owners and editors create snapshots through the controlled save operation, which checks company membership and validates the profile.

Ordinary clients receive no direct insert, update, or delete privileges on version rows. Snapshot immutability depends on privileges as well as RLS.

### Background scraping

The worker checks the requesting user's current company access before processing a job or applying its results. Its result updates must not silently overwrite newer owner edits; use the draft revision and present changes for review when needed.

Privileged service credentials stay on the server. They must never appear in browser code or exported profiles. A worker using credentials that bypass RLS must enforce the access checks itself.

### Deletion and retention

Archive knowledge bases by default. Permanent deletion is a separate owner-authorized operation with explicit retention rules.

Use restrictive foreign keys for ordinary company and knowledge-base deletion, rather than an unrestricted cascade that erases history. The authorized purge operation handles dependent records deliberately.

Account deletion also needs a defined policy for ownership transfer and audit references; it should not accidentally remove business history.

## Concurrency and indexes

Use `draft_revision` for optimistic concurrency. An update supplies the revision it loaded, and the database atomically updates only that revision and increments it. If no row matches, request a reload or merge instead of silently overwriting another user's changes.

Suggested indexes:

- `company_members(user_id)` for finding a user's memberships.
- `knowledge_bases(company_id, updated_at)` for company profile lists.
- `scrape_runs(knowledge_base_id, created_at)` for collection history.
- `scrape_runs(status, created_at)` for queued-job processing.

The membership primary key supports company membership checks. The version uniqueness constraint supports retrieving a knowledge base's versions in order.

## Policy tests before deployment

Test with users from two different companies:

- One company's users cannot read or change the other's records.
- Viewers cannot write, and editors cannot change membership or company settings.
- Users cannot change parent IDs or forge creator/requester fields.
- Clients cannot insert their own version snapshots or mark scrape jobs as completed.
- Removing membership removes future access, including worker authorization.
- Concurrent ownership changes cannot remove the final owner.
- Concurrent draft updates detect conflicts, and version saves preserve correct snapshots and numbering.
- Restoring a version preserves history, and background results do not overwrite newer edits.
