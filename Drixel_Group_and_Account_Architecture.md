# Drixel Labs Inc — Group and Account Architecture
Version 1.1 · 2 October 2026

## Purpose

Establish a group structure that lets Drixel Labs Inc launch and operate multiple businesses and digital services under one connected ecosystem. A person should be able to use a consistent Drixel sign-in, while each business controls its own people, permissions, customers, and operational data.

This is a proposed operating and software architecture. The names below describe the current working portfolio; they do not assert that every business unit is a separately registered legal entity.

## 1. Group structure

```text
Drixel Labs Inc — Group parent
├── Group Office — shared corporate functions
│   ├── Executive leadership
│   ├── Finance and administration
│   ├── People operations
│   ├── Legal and governance
│   └── Technology, security, and shared platform
├── Drixel SA — fashion and ecommerce business
│   └── Drixel SA online store and customer services
├── Excel Tutoring Academy SA — education business
│   └── Excel Tutoring Academy learning platform
├── DrixelOne — technology business
├── Drixel Digital Products — digital products business
│   ├── A-Chatz — messaging product
│   └── SkrpTure — church presentation product
└── Future businesses and products
```

### Structure rules

- **Drixel Labs Inc** owns the group strategy, shared identity platform, group policies, and shared services.
- **Drixel SA, Excel Tutoring Academy SA, DrixelOne, and Drixel Digital Products** are recorded as business units under the group. Each owns its business plan, budget, staff allocation, customers, and operating decisions within group policy.
- **A product or service** is registered under one owning business unit. A product can remain a product while it grows; it does not need a new company record just to get its own team, users, or data.
- Create a separate legal-entity record only when Drixel decides that a venture is or should become a distinct legal entity. Legal ownership and registration details should be confirmed from company records.

## 2. Shared account platform

Working name: **Drixel ID**.

Drixel ID is the shared sign-in and account directory for Drixel services. It connects accounts to businesses and products, but it does not combine their private business data.

### Account types and contexts

- **Person account:** one human identity, with verified contact methods and sign-in credentials managed by a central identity provider.
- **Employee membership:** a person’s employment-related membership in Drixel Labs Inc or a business unit, with role and status. A work email alone does not grant employee access.
- **Customer membership:** a person’s relationship with one or more products. It does not grant access to staff tools.
- **Business account:** an organization or customer business that may have its own members, administrator, billing, and product subscriptions.
- **External collaborator:** a time-limited or scoped invitation to a specific business or product.

A person may have more than one context. After signing in, they use an account or workspace switcher to enter the relevant business or service. Each context has its own permissions.

## 3. Organization and service hierarchy

Use a tenant hierarchy that can grow without redesign:

```text
Drixel Labs Inc (group tenant)
└── Business unit / subsidiary tenant
    └── Product or service
        └── Workspace, team, or customer organization
```

The hierarchy is configurable. A business can own multiple services, and a service can contain many customer workspaces. A business unit can later be promoted to a separate subsidiary tenant without changing the person’s Drixel ID.

## 4. Roles and access

Permissions are assigned at a scope. Group membership does not automatically grant access to every business or product.

| Scope | Example roles | Intended access |
| --- | --- | --- |
| Group | Group owner, group administrator, finance, people administrator, security administrator | Group-wide settings or records needed for that function |
| Business | Business owner, business administrator, manager, staff member | One business’s operations |
| Product | Product administrator, support agent, contributor | One product’s administrative or support functions |
| Customer workspace | Workspace owner, administrator, member | That customer’s own workspace and records |
| End user | Customer, subscriber, learner, viewer | The features and records assigned by that service |

Apply least privilege: grant only the role and scope needed, require stronger verification for administrators, record sensitive access changes, and remove or suspend access when a membership ends.

## 5. Data boundaries

### Central Drixel ID directory stores

- Stable person/account ID
- Verified sign-in identifiers (such as email)
- Basic account status and recovery methods
- Organization and service memberships
- Role assignments and consent/preferences
- Security and administrative audit events

### Each business or service stores

- Its own operational records and business data
- Its own customer profile extensions, where needed
- Its own billing/subscription records
- Its own service-specific permissions and activity

Services reference the stable Drixel account ID. They should not copy another service’s private records into their database or make them visible merely because both services use Drixel ID. Share additional profile fields only when a clear service need and appropriate user notice/consent exist.

## 6. Minimum platform components

1. **Identity provider:** central sign-in, account recovery, multi-factor authentication, and single sign-on using standard protocols such as OpenID Connect.
2. **Organization registry:** group, business, subsidiary, product, and customer workspace records.
3. **Membership and policy service:** scoped roles, invitations, status changes, and authorization checks.
4. **Admin console:** manage businesses, products, employees, customer organizations, and access.
5. **Audit trail:** record sign-ins and important administrative actions, such as granting administrator access or disabling a membership.
6. **Service integration layer:** each Drixel service integrates with Drixel ID and checks its own permissions before returning data.

Do not build one shared database that allows every business and product to read all group data. The shared platform should provide identity and authorization decisions; service data remains owned by the relevant service.

## 7. Example account journeys

### Employee

1. A manager invites a person to Drixel Labs Inc or a specific business unit.
2. The person verifies their identity and accepts the scoped membership.
3. An administrator assigns business-specific roles.
4. The employee signs in through Drixel ID and sees only the workspaces and tools granted to them.
5. When employment or a project ends, the membership is suspended or removed and the change is audited.

### Customer

1. A person creates or uses a Drixel ID account in a product.
2. The product creates its own customer profile and records, linked by the stable account ID.
3. The person may use the same sign-in in another Drixel service, but that service receives no access to the first service’s private records by default.
4. The person can review and manage connected services and consent from account settings.

### New venture

1. Group administrators register a business unit or subsidiary and identify its owner.
2. They register the venture’s products under that business.
3. The venture receives its own memberships, roles, data boundaries, and admin settings.
4. It uses Drixel ID without inheriting access to other businesses’ customer or employee records.

## 8. Governance and account rules

- Keep a clear distinction between legal entities, internal business units, and products.
- Give every business and product an owner responsible for access reviews and data handling.
- Require MFA for privileged accounts and use role-based, scoped authorization.
- Separate employee identities from customer profiles while allowing one person to link contexts.
- Provide account export, correction, deactivation, and deletion workflows consistent with business and legal obligations.
- Log administrative changes, not ordinary browsing beyond what is needed for security and service operation.
- Never use a customer account as an employee account or infer employment from an email address.
- Design recovery and account linking to resist takeover; do not merge accounts solely because emails look similar.

## 9. Delivery sequence

### Phase 1 — Portfolio register
Confirm the group name, list each business and product, assign an owner, and identify whether each is a product, business unit, or registered legal entity.

### Phase 2 — Identity foundation
Choose an identity provider and define account IDs, sign-in methods, MFA, invitations, recovery, and account linking.

### Phase 3 — Organization and permission model
Implement the organization registry, membership lifecycle, scoped roles, admin console, and audit events.

### Phase 4 — First service integration
Integrate one service end to end. Verify employee access, customer access, account recovery, offboarding, and cross-service data isolation.

### Phase 5 — Progressive rollout
Connect each remaining service one at a time. Migrate accounts carefully, preserve service data ownership, and review access after each launch.

## Decisions to record before implementation

- Which current and planned ventures belong in the Drixel group portfolio
- Whether each business unit is a separate legal entity or an operating unit of Drixel Labs Inc
- The identity provider and the first service to integrate
- Who can create businesses, products, employees, and customer workspaces
- Whether users may link accounts across services and how consent is presented

## Initial portfolio register

| Group | Business unit | Service / product | Initial classification |
| --- | --- | --- | --- |
| Drixel Labs Inc | Drixel SA | Drixel SA store | Business unit and service |
| Drixel Labs Inc | Excel Tutoring Academy SA | Excel Tutoring Academy learning platform | Business unit and service |
| Drixel Labs Inc | DrixelOne | To be registered when its services are defined | Business unit |
| Drixel Labs Inc | Drixel Digital Products | A-Chatz | Business unit and product |
| Drixel Labs Inc | Drixel Digital Products | SkrpTure | Business unit and product |
| Drixel Labs Inc | Group Office | Drixel ID | Group-wide identity service |

The initial database seed uses these names and relationships. A business can add products later without changing global account IDs or another business's data boundaries.
