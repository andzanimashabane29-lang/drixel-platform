import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { AuthenticationError, bearerToken } from './oidc.js'

const sendJson = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  response.end(JSON.stringify(body))
}

const readJson = async (request) => {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > 16_384) throw new Error('Request body too large')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new Error('Invalid JSON body') }
}

const normalizeEmail = (value) => typeof value === 'string' && value.trim().length <= 254
  ? value.trim().toLowerCase() : ''

function accountsQuery() {
  return `
    WITH RECURSIVE actor AS (
      SELECT account.id
      FROM drixel.accounts AS account
      JOIN drixel.account_identities AS identity ON identity.account_id = account.id
      WHERE identity.issuer = $1 AND identity.subject = $2
        AND account.status = 'active'
    ), permissions AS (
      SELECT assignment.scope, assignment.organization_id
      FROM drixel.role_assignments AS assignment
      JOIN drixel.roles AS role ON role.id = assignment.role_id
      JOIN actor ON actor.id = assignment.account_id
      WHERE (assignment.expires_at IS NULL OR assignment.expires_at > now())
        AND ((assignment.scope = 'group' AND role.code IN ('group_owner', 'group_admin'))
          OR (assignment.scope = 'organization' AND role.code = 'business_admin'))
        AND EXISTS (
          SELECT 1 FROM drixel.organization_memberships AS actor_membership
          WHERE actor_membership.account_id = actor.id
            AND actor_membership.organization_id = assignment.organization_id
            AND actor_membership.status = 'active'
        )
    ), scope_tree(root_id, organization_id) AS (
      SELECT organization_id, organization_id FROM permissions WHERE scope = 'group'
      UNION ALL
      SELECT scope_tree.root_id, child.id
      FROM drixel.organizations AS child
      JOIN scope_tree ON child.parent_organization_id = scope_tree.organization_id
    ), allowed_organizations AS (
      SELECT permissions.organization_id FROM permissions
      JOIN drixel.organizations AS scoped_org ON scoped_org.id = permissions.organization_id
      WHERE permissions.scope = 'organization' AND scoped_org.kind <> 'customer'
      UNION
      SELECT scope_tree.organization_id FROM scope_tree
      JOIN drixel.organizations AS scoped_org ON scoped_org.id = scope_tree.organization_id
      WHERE scoped_org.kind <> 'customer'
    ), visible AS (
      SELECT DISTINCT target.id, target.display_name, target.status, email.email,
             membership.organization_id, organization.display_name AS organization_name,
             NULL::text AS service_name, membership.kind AS membership_kind,
             membership.status AS membership_status, assigned_role.code AS role_code
      FROM drixel.accounts AS target
      JOIN drixel.organization_memberships AS membership ON membership.account_id = target.id
      JOIN drixel.organizations AS organization ON organization.id = membership.organization_id
      LEFT JOIN drixel.account_emails AS email ON email.account_id = target.id AND email.is_primary
      LEFT JOIN drixel.role_assignments AS role_assignment
        ON role_assignment.account_id = target.id AND role_assignment.scope = 'organization'
        AND role_assignment.organization_id = membership.organization_id
        AND (role_assignment.expires_at IS NULL OR role_assignment.expires_at > now())
      LEFT JOIN drixel.roles AS assigned_role ON assigned_role.id = role_assignment.role_id
      WHERE membership.status <> 'ended'
        AND EXISTS (SELECT 1 FROM allowed_organizations WHERE id = membership.organization_id)
      UNION ALL
      SELECT DISTINCT target.id, target.display_name, target.status, email.email,
             membership.organization_id, organization.display_name AS organization_name,
             application.display_name AS service_name, membership.kind AS membership_kind,
             application_membership.status AS membership_status, application_role.code AS role_code
      FROM drixel.accounts AS target
      JOIN drixel.organization_memberships AS membership ON membership.account_id = target.id
      JOIN drixel.organizations AS organization ON organization.id = membership.organization_id
      JOIN drixel.application_memberships AS application_membership
        ON application_membership.account_id = target.id AND application_membership.status <> 'ended'
      JOIN drixel.applications AS application
        ON application.id = application_membership.application_id
        AND application.owner_organization_id = membership.organization_id
      LEFT JOIN drixel.account_emails AS email ON email.account_id = target.id AND email.is_primary
      LEFT JOIN drixel.role_assignments AS app_assignment
        ON app_assignment.account_id = target.id AND app_assignment.scope = 'application'
        AND app_assignment.application_id = application.id
        AND (app_assignment.expires_at IS NULL OR app_assignment.expires_at > now())
      LEFT JOIN drixel.roles AS application_role ON application_role.id = app_assignment.role_id
      WHERE membership.status <> 'ended'
        AND EXISTS (SELECT 1 FROM allowed_organizations WHERE id = membership.organization_id)
    )
    SELECT EXISTS (SELECT 1 FROM permissions) AS authorized,
           EXISTS (SELECT 1 FROM permissions WHERE scope = 'group') AS can_assign_business_admin,
           COALESCE((SELECT jsonb_agg(to_jsonb(visible) ORDER BY visible.organization_name, visible.display_name)
                     FROM visible), '[]'::jsonb) AS accounts
  `
}

function auditQuery() {
  return `
    WITH RECURSIVE actor AS (
      SELECT account.id
      FROM drixel.accounts AS account
      JOIN drixel.account_identities AS identity ON identity.account_id = account.id
      WHERE identity.issuer = $1 AND identity.subject = $2 AND account.status = 'active'
    ), permissions AS (
      SELECT assignment.scope, assignment.organization_id
      FROM drixel.role_assignments AS assignment
      JOIN drixel.roles AS role ON role.id = assignment.role_id
      JOIN actor ON actor.id = assignment.account_id
      WHERE (assignment.expires_at IS NULL OR assignment.expires_at > now())
        AND ((assignment.scope = 'group' AND role.code IN ('group_owner', 'group_admin'))
          OR (assignment.scope = 'organization' AND role.code = 'business_admin'))
        AND EXISTS (
          SELECT 1 FROM drixel.organization_memberships AS actor_membership
          WHERE actor_membership.account_id = actor.id
            AND actor_membership.organization_id = assignment.organization_id
            AND actor_membership.status = 'active'
        )
    ), scope_tree(root_id, organization_id) AS (
      SELECT organization_id, organization_id FROM permissions WHERE scope = 'group'
      UNION ALL
      SELECT scope_tree.root_id, child.id
      FROM drixel.organizations AS child
      JOIN scope_tree ON child.parent_organization_id = scope_tree.organization_id
    ), allowed_organizations AS (
      SELECT permissions.organization_id FROM permissions
      JOIN drixel.organizations AS scoped_org ON scoped_org.id = permissions.organization_id
      WHERE permissions.scope = 'organization' AND scoped_org.kind <> 'customer'
      UNION
      SELECT scope_tree.organization_id FROM scope_tree
      JOIN drixel.organizations AS scoped_org ON scoped_org.id = scope_tree.organization_id
      WHERE scoped_org.kind <> 'customer'
    ), visible_events AS (
      SELECT event.id, event.action, event.target_type, event.target_id, event.details,
             event.occurred_at, actor_account.display_name AS actor_name,
             organization.display_name AS organization_name
      FROM drixel.audit_events AS event
      LEFT JOIN drixel.accounts AS actor_account ON actor_account.id = event.actor_account_id
      LEFT JOIN drixel.organizations AS organization ON organization.id = event.organization_id
      WHERE event.organization_id IN (SELECT organization_id FROM allowed_organizations)
      ORDER BY event.occurred_at DESC
      LIMIT 100
    )
    SELECT EXISTS (SELECT 1 FROM permissions) AS authorized,
           COALESCE((SELECT jsonb_agg(to_jsonb(visible_events) ORDER BY visible_events.occurred_at DESC)
                     FROM visible_events), '[]'::jsonb) AS events
  `
}

function portfolioAdministratorQuery() {
  return `
    SELECT actor.id AS actor_id, group_org.id AS group_id
    FROM drixel.accounts AS actor
    JOIN drixel.account_identities AS identity ON identity.account_id = actor.id
    JOIN drixel.organizations AS group_org ON group_org.slug = 'drixel-labs' AND group_org.kind = 'group'
    WHERE identity.issuer = $1 AND identity.subject = $2 AND actor.status = 'active'
      AND EXISTS (
        SELECT 1 FROM drixel.role_assignments AS assignment
        JOIN drixel.roles AS role ON role.id = assignment.role_id
        JOIN drixel.organization_memberships AS membership
          ON membership.account_id = actor.id AND membership.organization_id = group_org.id AND membership.status = 'active'
        WHERE assignment.account_id = actor.id AND assignment.scope = 'group'
          AND assignment.organization_id = group_org.id AND role.code IN ('group_owner', 'group_admin')
          AND (assignment.expires_at IS NULL OR assignment.expires_at > now())
      )
  `
}

const validSlug = (value) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
const validRecordName = (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120
const validRecordStatus = (value) => ['active', 'suspended', 'closed'].includes(value)
const isUniqueViolation = (error) => error?.code === '23505'

export function createApiServer(query, options = {}) {
  const managementQuery = options.managementQuery ?? query
  const transaction = options.transaction
  const verifyToken = options.verifyToken
  const verifyIdToken = options.verifyIdToken
  const runTransaction = transaction ?? (async (operation) => operation(managementQuery))

  const authenticate = async (request) => {
    if (!verifyToken) throw new AuthenticationError('Identity provider is not configured')
    const token = bearerToken(request)
    if (!token) throw new AuthenticationError('Bearer token required')
    return verifyToken(token)
  }

  return createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname

    if ((pathname === '/api/health' || pathname === '/api/portfolio') && request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      return sendJson(response, 405, { error: 'Method not allowed' })
    }

    if (request.method === 'GET' && pathname === '/api/health') {
      try {
        await Promise.all([query('SELECT 1'), managementQuery('SELECT 1')])
        return sendJson(response, 200, { status: 'ok', database: 'connected', management_database: 'connected' })
      } catch {
        return sendJson(response, 503, { status: 'unavailable', database: 'unavailable', management_database: 'unavailable' })
      }
    }

    if (request.method === 'GET' && pathname === '/api/portfolio') {
      try {
        const [businessResult, serviceResult] = await Promise.all([
          query(`
            SELECT id, slug, display_name AS name, kind, status
            FROM drixel.organizations
            WHERE kind IN ('business_unit', 'subsidiary')
            ORDER BY display_name
          `),
          query(`
            SELECT app.id, app.slug, app.display_name AS name, app.status,
                   owner.slug AS owner_slug, owner.display_name AS owner_name
            FROM drixel.applications AS app
            JOIN drixel.organizations AS owner ON owner.id = app.owner_organization_id
            WHERE owner.kind IN ('group', 'business_unit', 'subsidiary')
            ORDER BY owner.display_name, app.display_name
          `),
        ])
        return sendJson(response, 200, {
          businesses: businessResult.rows,
          services: serviceResult.rows,
        })
      } catch {
        return sendJson(response, 503, { error: 'Portfolio directory is unavailable' })
      }
    }

    if (pathname === '/api/portfolio/manage-access' && request.method === 'GET') {
      let claims
      try { claims = await authenticate(request) }
      catch { return sendJson(response, 401, { error: 'Authentication required' }) }
      try {
        const result = await managementQuery(portfolioAdministratorQuery(), [claims.iss, claims.sub])
        if (!result.rows[0]) return sendJson(response, 403, { error: 'Group administrator access is required' })
        return sendJson(response, 200, { can_manage_portfolio: true })
      } catch {
        return sendJson(response, 503, { error: 'Portfolio permissions are unavailable' })
      }
    }

    const businessRecord = pathname.match(/^\/api\/portfolio\/businesses\/([0-9a-f-]{36})$/i)
    const serviceRecord = pathname.match(/^\/api\/portfolio\/services\/([0-9a-f-]{36})$/i)
    const businessCollection = pathname === '/api/portfolio/businesses'
    const serviceCollection = pathname === '/api/portfolio/services'
    if ((businessCollection && request.method === 'POST') || (serviceCollection && request.method === 'POST')
      || (businessRecord && request.method === 'PATCH') || (serviceRecord && request.method === 'PATCH')) {
      let claims
      try { claims = await authenticate(request) }
      catch { return sendJson(response, 401, { error: 'Authentication required' }) }
      let body
      try { body = await readJson(request) }
      catch (error) { return sendJson(response, 400, { error: error.message }) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return sendJson(response, 400, { error: 'Invalid portfolio details' })
      const isBusiness = businessCollection || businessRecord
      const isCreate = businessCollection || serviceCollection
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const status = body.status
      const slug = body.slug
      const kind = body.kind
      const ownerId = body.owner_organization_id
      if (!validRecordName(name) || (isCreate && !validSlug(slug))
        || (isCreate && isBusiness && !['business_unit', 'subsidiary'].includes(kind))
        || (isCreate && !isBusiness && (typeof ownerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(ownerId)))
        || (!isCreate && !validRecordStatus(status))) {
        return sendJson(response, 400, { error: 'Provide a valid name, slug, business type or owner, and status' })
      }
      try {
        const result = await runTransaction(async (tx) => {
          const administrator = await tx(portfolioAdministratorQuery(), [claims.iss, claims.sub])
          const actor = administrator.rows[0]
          if (!actor) return { forbidden: true }
          let saved
          if (isCreate && isBusiness) {
            saved = await tx(`
              INSERT INTO drixel.organizations (parent_organization_id, kind, slug, display_name)
              VALUES ($1, $2::drixel.organization_kind, $3, $4)
              RETURNING id, slug, display_name AS name, kind, status
            `, [actor.group_id, kind, slug, name])
          } else if (isCreate) {
            saved = await tx(`
              INSERT INTO drixel.applications (owner_organization_id, slug, display_name)
              SELECT organization.id, $3, $4
              FROM drixel.organizations AS organization
              WHERE organization.id = $1 AND organization.parent_organization_id = $2
                AND organization.kind IN ('business_unit', 'subsidiary') AND organization.status <> 'closed'
              RETURNING id, slug, display_name AS name, status, owner_organization_id
            `, [ownerId, actor.group_id, slug, name])
          } else if (isBusiness) {
            saved = await tx(`
              UPDATE drixel.organizations
              SET display_name = $3, status = $4::drixel.record_status, updated_at = now()
              WHERE id = $1 AND parent_organization_id = $2
                AND kind IN ('business_unit', 'subsidiary')
              RETURNING id, slug, display_name AS name, kind, status
            `, [businessRecord[1], actor.group_id, name, status])
          } else {
            saved = await tx(`
              UPDATE drixel.applications AS application
              SET display_name = $3, status = $4::drixel.record_status, updated_at = now()
              FROM drixel.organizations AS owner
              WHERE application.id = $1 AND application.owner_organization_id = owner.id
                AND owner.parent_organization_id = $2 AND owner.kind IN ('business_unit', 'subsidiary')
              RETURNING application.id, application.slug, application.display_name AS name,
                        application.status, application.owner_organization_id
            `, [serviceRecord[1], actor.group_id, name, status])
          }
          if (!saved.rows[0]) return { notFound: true }
          const record = saved.rows[0]
          const eventOrganizationId = isBusiness
            ? record.id
            : (isCreate ? ownerId : record.owner_organization_id)
          await tx(`
            INSERT INTO drixel.audit_events
              (actor_account_id, organization_id, application_id, action, target_type, target_id, details)
            VALUES ($1, $2, $3, $4, $5, $6, jsonb_build_object('name', $7, 'status', $8, 'slug', $9))
          `, [actor.actor_id, eventOrganizationId, isBusiness ? null : record.id,
            `${isBusiness ? 'business' : 'service'}.${isCreate ? 'created' : 'updated'}`,
            isBusiness ? 'organization' : 'application', record.id, record.name, record.status, record.slug])
          return { record }
        })
        if (result.forbidden) return sendJson(response, 403, { error: 'Group administrator access is required' })
        if (result.notFound) return sendJson(response, 404, { error: 'The portfolio record or owning business was not found' })
        return sendJson(response, isCreate ? 201 : 200, { record: result.record })
      } catch (error) {
        if (isUniqueViolation(error)) return sendJson(response, 409, { error: 'That portfolio slug is already in use' })
        return sendJson(response, 503, { error: 'Portfolio record could not be saved' })
      }
    }

    if (request.method === 'GET' && pathname === '/api/accounts') {
      let claims
      try { claims = await authenticate(request) }
      catch { return sendJson(response, 401, { error: 'Authentication required' }) }
      try {
        const result = await managementQuery(accountsQuery(), [claims.iss, claims.sub])
        const row = result.rows[0]
        if (!row?.authorized) return sendJson(response, 403, { error: 'Account administration access is required' })
        return sendJson(response, 200, { accounts: row.accounts, can_assign_business_admin: row.can_assign_business_admin })
      } catch {
        return sendJson(response, 503, { error: 'Account directory is unavailable' })
      }
    }

    if (request.method === 'GET' && pathname === '/api/audit-log') {
      let claims
      try { claims = await authenticate(request) }
      catch { return sendJson(response, 401, { error: 'Authentication required' }) }
      try {
        const result = await managementQuery(auditQuery(), [claims.iss, claims.sub])
        const row = result.rows[0]
        if (!row?.authorized) return sendJson(response, 403, { error: 'Audit log access is required' })
        return sendJson(response, 200, { events: row.events })
      } catch {
        return sendJson(response, 503, { error: 'Audit log is unavailable' })
      }
    }

    if (request.method === 'POST' && pathname === '/api/invitations') {
      let claims
      try { claims = await authenticate(request) }
      catch { return sendJson(response, 401, { error: 'Authentication required' }) }
      let body
      try { body = await readJson(request) }
      catch (error) { return sendJson(response, 400, { error: error.message }) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return sendJson(response, 400, { error: 'Invalid invitation details' })
      const email = normalizeEmail(body.email)
      const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : ''
      const organizationId = typeof body.organization_id === 'string' ? body.organization_id : ''
      const applicationId = typeof body.application_id === 'string' ? body.application_id : ''
      const roleCode = typeof body.role_code === 'string' ? body.role_code : ''
      const roleScope = applicationId ? 'application' : 'organization'
      const membershipKind = body.membership_kind
      if (!email || !email.includes('@') || !displayName || displayName.length > 120
        || !organizationId || !/^[0-9a-f-]{36}$/i.test(organizationId)
        || (applicationId && !/^[0-9a-f-]{36}$/i.test(applicationId))
        || (roleScope === 'organization' && !['business_admin', 'manager', 'employee'].includes(roleCode))
        || (roleScope === 'application' && !['app_admin', 'support_agent', 'end_user'].includes(roleCode))
        || !['employee', 'contractor', 'partner', 'customer'].includes(membershipKind)
        || (membershipKind === 'customer' && (!applicationId || roleCode !== 'end_user'))) {
        return sendJson(response, 400, { error: 'Provide a valid business or service, email, name, membership type, and scoped role' })
      }

      const token = randomBytes(32).toString('base64url')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      try {
        const invite = await runTransaction(async (tx) => {
          const permission = await tx(`
            SELECT actor.id AS actor_id, organization.id AS organization_id,
                   role.id AS role_id, organization.display_name AS organization_name,
                   application.display_name AS application_name
            FROM drixel.accounts AS actor
            JOIN drixel.account_identities AS identity ON identity.account_id = actor.id
            JOIN drixel.organizations AS organization ON organization.id = $3
            LEFT JOIN drixel.applications AS application
              ON application.id = NULLIF($5::text, '')::uuid AND application.owner_organization_id = organization.id
            JOIN drixel.roles AS role ON role.code = $4 AND role.scope = $6::drixel.role_scope
            WHERE identity.issuer = $1 AND identity.subject = $2
              AND actor.status = 'active'
              AND organization.status = 'active'
              AND organization.kind IN ('business_unit', 'subsidiary')
              AND ($5::text = '' OR application.id IS NOT NULL)
              AND (application.id IS NULL OR application.status = 'active')
              AND (
                EXISTS (
                  SELECT 1 FROM drixel.role_assignments assignment
                  JOIN drixel.roles grant_role ON grant_role.id = assignment.role_id
                  WHERE assignment.account_id = actor.id AND assignment.scope = 'group'
                    AND assignment.organization_id = organization.parent_organization_id
                    AND grant_role.code IN ('group_owner', 'group_admin')
                    AND (assignment.expires_at IS NULL OR assignment.expires_at > now())
                    AND EXISTS (
                      SELECT 1 FROM drixel.organization_memberships membership
                      WHERE membership.account_id = actor.id
                        AND membership.organization_id = assignment.organization_id
                        AND membership.status = 'active'
                    )
                )
                OR ((role.scope = 'organization' AND role.code IN ('manager', 'employee')
                    OR role.scope = 'application' AND role.code IN ('app_admin', 'support_agent', 'end_user')) AND EXISTS (
                  SELECT 1 FROM drixel.role_assignments assignment
                  JOIN drixel.roles grant_role ON grant_role.id = assignment.role_id
                  WHERE assignment.account_id = actor.id AND assignment.scope = 'organization'
                    AND assignment.organization_id = organization.id AND grant_role.code = 'business_admin'
                    AND (assignment.expires_at IS NULL OR assignment.expires_at > now())
                    AND EXISTS (
                      SELECT 1 FROM drixel.organization_memberships membership
                      WHERE membership.account_id = actor.id
                        AND membership.organization_id = assignment.organization_id
                        AND membership.status = 'active'
                    )
                ))
              )
          `, [claims.iss, claims.sub, organizationId, roleCode, applicationId, roleScope])
          if (!permission.rows[0]) return { forbidden: true }
          const existing = await tx(`
            SELECT account.id,
                   CASE WHEN $3::text = '' THEN membership.id ELSE application_membership.id END AS membership_id
            FROM drixel.account_emails AS email
            JOIN drixel.accounts AS account ON account.id = email.account_id
            LEFT JOIN drixel.organization_memberships AS membership
              ON membership.account_id = account.id AND membership.organization_id = $2
            LEFT JOIN drixel.application_memberships AS application_membership
              ON application_membership.account_id = account.id
              AND application_membership.application_id = NULLIF($3::text, '')::uuid
            WHERE email.normalized_email = $1
            LIMIT 1
          `, [email, organizationId, applicationId])
          if (existing.rows[0]?.membership_id) return { duplicate: true }
          let accountId = existing.rows[0]?.id
          if (!accountId) {
            const account = await tx(`INSERT INTO drixel.accounts (display_name) VALUES ($1) RETURNING id`, [displayName])
            accountId = account.rows[0].id
            await tx(`INSERT INTO drixel.account_emails (account_id, email, is_primary) VALUES ($1, $2, true)`, [accountId, email])
          }
          await tx(`INSERT INTO drixel.organization_memberships (organization_id, account_id, kind, status, invited_by)
                   VALUES ($1, $2, $3, 'invited', $4) ON CONFLICT (organization_id, account_id) DO NOTHING`, [organizationId, accountId, membershipKind, permission.rows[0].actor_id])
          if (applicationId) {
            await tx(`INSERT INTO drixel.application_memberships (application_id, account_id, status)
                      VALUES ($1, $2, 'invited')`, [applicationId, accountId])
          }
          const inserted = await tx(`INSERT INTO drixel.invitations
              (token_hash, account_id, organization_id, application_id, role_id, membership_kind, invited_by, expires_at)
            VALUES ($1, $2, $3, NULLIF($4::text, '')::uuid, $5, $6, $7, now() + interval '7 days') RETURNING id`,
          [tokenHash, accountId, organizationId, applicationId, permission.rows[0].role_id, membershipKind, permission.rows[0].actor_id])
          await tx(`INSERT INTO drixel.audit_events (actor_account_id, organization_id, action, target_type, target_id, details)
                   VALUES ($1, $2, 'account.invited', 'account', $3, jsonb_build_object('email', $4, 'role', $5, 'service', $6))`,
          [permission.rows[0].actor_id, organizationId, accountId, email, roleCode, permission.rows[0].application_name ?? null])
          return { id: inserted.rows[0].id, organizationName: permission.rows[0].organization_name, applicationName: permission.rows[0].application_name }
        })
        if (invite.forbidden) return sendJson(response, 403, { error: 'You cannot invite users into this business or service, or assign that role' })
        if (invite.duplicate) return sendJson(response, 409, { error: 'An account already uses this email address' })
        return sendJson(response, 201, { invitation: { id: invite.id, email, organization: invite.organizationName, service: invite.applicationName ?? null, expires_in_days: 7 }, token })
      } catch {
        return sendJson(response, 503, { error: 'Invitation could not be created' })
      }
    }

    if (request.method === 'POST' && pathname === '/api/invitations/accept') {
      let claims
      try { claims = await authenticate(request) }
      catch { return sendJson(response, 401, { error: 'Authentication required' }) }
      let body
      try { body = await readJson(request) }
      catch (error) { return sendJson(response, 400, { error: error.message }) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return sendJson(response, 400, { error: 'Invalid invitation details' })
      if (typeof body.token !== 'string' || body.token.length < 32 || body.token.length > 256 || typeof body.id_token !== 'string') {
        return sendJson(response, 400, { error: 'A valid invitation token is required' })
      }
      let identityClaims
      try { identityClaims = verifyIdToken ? await verifyIdToken(body.id_token) : undefined }
      catch { return sendJson(response, 401, { error: 'A verified identity-provider sign-in is required' }) }
      if (!identityClaims || identityClaims.iss !== claims.iss || identityClaims.sub !== claims.sub) {
        return sendJson(response, 401, { error: 'Access token and verified identity do not match' })
      }
      const email = normalizeEmail(identityClaims.email)
      if (!email || identityClaims.email_verified !== true) return sendJson(response, 403, { error: 'Sign in with a verified email address to accept an invitation' })
      const tokenHash = createHash('sha256').update(body.token).digest('hex')
      try {
        const result = await runTransaction(async (tx) => {
          const invitation = await tx(`
            SELECT invitation.id, invitation.account_id, invitation.organization_id, invitation.application_id,
                   invitation.role_id, invitation.invited_by,
                   account.display_name, identity.account_id AS existing_account_id
                   , EXISTS (
                     SELECT 1 FROM drixel.account_identities AS linked
                     WHERE linked.account_id = account.id
                       AND NOT (linked.issuer = $3 AND linked.subject = $4)
                   ) AS has_other_identity
            FROM drixel.invitations AS invitation
            JOIN drixel.accounts AS account ON account.id = invitation.account_id
            JOIN drixel.account_emails AS email ON email.account_id = account.id
            LEFT JOIN drixel.account_identities AS identity
              ON identity.issuer = $3 AND identity.subject = $4
            WHERE invitation.token_hash = $1 AND email.normalized_email = $2
              AND invitation.accepted_at IS NULL AND invitation.expires_at > now()
            FOR UPDATE OF invitation
          `, [tokenHash, email, claims.iss, claims.sub])
          if (!invitation.rows[0]) return { invalid: true }
          if (invitation.rows[0].existing_account_id && invitation.rows[0].existing_account_id !== invitation.rows[0].account_id) {
            return { identityConflict: true }
          }
          if (!invitation.rows[0].existing_account_id && invitation.rows[0].has_other_identity) return { identityConflict: true }
          await tx(`INSERT INTO drixel.account_identities (account_id, issuer, subject)
                    VALUES ($1, $2, $3) ON CONFLICT (issuer, subject) DO NOTHING`,
          [invitation.rows[0].account_id, claims.iss, claims.sub])
          const linkedIdentity = await tx(`SELECT account_id FROM drixel.account_identities WHERE issuer = $1 AND subject = $2`,
            [claims.iss, claims.sub])
          if (linkedIdentity.rows[0]?.account_id !== invitation.rows[0].account_id) return { identityConflict: true }
          await tx(`UPDATE drixel.account_emails SET is_verified = true WHERE account_id = $1 AND normalized_email = $2`,
          [invitation.rows[0].account_id, email])
          await tx(`UPDATE drixel.organization_memberships SET status = 'active', joined_at = now()
                    WHERE account_id = $1 AND organization_id = $2 AND status = 'invited'`,
          [invitation.rows[0].account_id, invitation.rows[0].organization_id])
          if (invitation.rows[0].application_id) {
            await tx(`UPDATE drixel.application_memberships SET status = 'active'
                      WHERE account_id = $1 AND application_id = $2 AND status = 'invited'`,
            [invitation.rows[0].account_id, invitation.rows[0].application_id])
            await tx(`INSERT INTO drixel.role_assignments (account_id, role_id, scope, application_id, granted_by)
                      VALUES ($1, $2, 'application', $3, $4) ON CONFLICT DO NOTHING`,
            [invitation.rows[0].account_id, invitation.rows[0].role_id, invitation.rows[0].application_id, invitation.rows[0].invited_by])
          } else {
            await tx(`INSERT INTO drixel.role_assignments (account_id, role_id, scope, organization_id, granted_by)
                      VALUES ($1, $2, 'organization', $3, $4) ON CONFLICT DO NOTHING`,
            [invitation.rows[0].account_id, invitation.rows[0].role_id, invitation.rows[0].organization_id, invitation.rows[0].invited_by])
          }
          await tx(`UPDATE drixel.invitations SET accepted_at = now() WHERE id = $1`, [invitation.rows[0].id])
          await tx(`INSERT INTO drixel.audit_events (actor_account_id, organization_id, application_id, action, target_type, target_id)
                    VALUES ($1, $2, $3, 'account.invitation_accepted', 'account', $1)`,
          [invitation.rows[0].account_id, invitation.rows[0].organization_id, invitation.rows[0].application_id])
          return { accepted: true, accountName: invitation.rows[0].display_name }
        })
        if (result.invalid) return sendJson(response, 404, { error: 'Invitation is invalid, expired, or belongs to another email address' })
        if (result.identityConflict) return sendJson(response, 409, { error: 'This identity is already linked to a different account' })
        return sendJson(response, 200, { accepted: true, account_name: result.accountName })
      } catch {
        return sendJson(response, 503, { error: 'Invitation could not be accepted' })
      }
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST')
      return sendJson(response, 405, { error: 'Method not allowed' })
    }
    return sendJson(response, 404, { error: 'Not found' })
  })
}
