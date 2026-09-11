# Threat Model, RBAC Matrix and Contract Outline

## Threat model

| Asset / threat | Example attack | Required controls |
|---|---|---|
| Accounts | Credential stuffing, brute force, reset abuse | Argon2id, generic login errors, rate limits, 4-failure deterministic alert/lock policy, MFA, reset-token hashing, session revocation |
| Member privacy | BOLA/IDOR by changing a member UUID | Server service policy, group/member query scope, DTO allowlists, file authorization, REST/WebSocket authorization tests |
| Financial integrity | Parallel loan requests take >50% of savings | Serializable/appropriate transaction isolation, row locks, server recomputation, active-loan predicates, idempotency keys, concurrency test |
| Financial history | Admin overwrites prior transaction | Append-only ledger, correction/reversal entries, audit hash chain, restricted database role |
| Sessions | Cookie theft, CSRF, replay | TLS, HttpOnly/Secure/SameSite cookies, CSRF validation, token rotation/revocation, expiry, device/session management |
| Uploads/documents | Polyglot image, path traversal, public document URL | MIME plus signature validation, image decode/re-encode, EXIF stripping, limits, private storage, authorization before short-lived access |
| API / UI | SQLi, XSS, mass assignment, SSRF | Zod schema validation, ORM parameters, output encoding, CSP, DTOs, allowlisted egress/provider adapters, request limits |
| WebSockets | Join another group’s room / spoof sender | Session auth at handshake, policy check per subscription/message, server-derived sender, private rooms, rate limits |
| Operations | Secret leak / unreviewed destructive deployment | KMS/secret manager, separate environment credentials, secret scanning, least privilege, approvals, backups and restore tests |
| Audit system | Log deletion or alteration | Append-only restricted writer, hashes, WORM export, monitoring and retention |

### High-risk abuse cases

1. A member changes `/members/{ownId}` to another member UUID: policy query requires `memberProfile.userId = actor.userId`; 404/403 without data.
2. A Group Admin requests Group B by UUID: query joins active `StaffGroupAssignment`; reject before serializing.
3. An ADMIN calls a savings mutation: route requires `savings.create`; ADMIN has only read grants.
4. A client sets `approverId`, `groupId`, `status=PAID`, or an amount: API DTO ignores/rejects protected fields; service obtains scope/actor and recalculates business values.
5. An attacker submits the same overdue job repeatedly: unique fine idempotency key makes repeats no-ops.

## RBAC permission matrix

`✓` means potentially allowed only after object/group policy. `—` is always denied.

| Permission | OWNER | SUPER_ADMIN | ADMIN | GROUP_ADMIN | MEMBER |
|---|---:|---:|---:|---:|---:|
| `system.read` | ✓ | limited | limited | — | — |
| `system.configure` | ✓ (step-up) | — | — | — | — |
| `users.create.privileged` | creates exactly 2 SA + 2 ADMIN | — | — | — | — |
| `users.suspend` | ✓ | assigned group admins / group policy | — | assigned members only | — |
| `groups.create/suspend/rename` | ✓ | ✓ if granted | — | — | — |
| `members.create/update/read` | ✓ scoped | ✓ scoped | read scoped | ✓ assigned group | own only |
| `savings.read` | ✓ scoped | explicit scope | read scope | assigned group | own only |
| `savings.create` | ✓ controlled | explicit grant | — | assigned group | request only / policy |
| `cashloan.create` | ✓ controlled | — unless grant | — | verify workflow scope | own request only |
| `cashloan.verify/clear` | ✓ | explicit scope | — | assigned group | — |
| `item.create/itemloan.clear` | ✓ | explicit scope | — | assigned group | — |
| `itemloan.create` | ✓ | explicit scope | — | assigned group | own selection only |
| `reports.read/export` | ✓ | explicit scope | authorized read scope | assigned group | own only |
| `audit.read/security.read` | ✓ | permitted scoped audit | permitted read-only scope | group-relevant only | own events only where provided |
| `chat.use` | authorized | authorized | authorized staff only | authorized | assigned Group Admin only |

Role assignment is not an access grant to a resource. `StaffGroupAssignment` and member ownership are enforced separately. Exactly one OWNER is created only in secure bootstrap. Database/service constraints cap active SUPER_ADMIN and ADMIN accounts at two; the invitation transaction also locks the active-role count.

## REST API specification (v1 outline)

All endpoints are under `/api/v1`. Mutations require cookie session + CSRF token and appropriate policy; responses use DTOs without hashes, tokens, keys or internal secrets. Pagination uses bounded opaque cursors.

### Authentication

| Method / route | Auth | Description |
|---|---|---|
| `POST /auth/login` | public, throttled | Validates credentials. Creates server session, or returns MFA-required challenge. |
| `POST /auth/mfa/verify` | challenge | Verifies enrolled second factor; completes session. |
| `POST /auth/logout` | session | Revokes current session. |
| `GET /auth/sessions` | session | Lists caller’s safe session metadata. |
| `DELETE /auth/sessions/:id` | ownership | Revokes caller’s session. |
| `POST /auth/password/forgot` | public, throttled | Starts reset without account enumeration. |
| `POST /auth/password/reset` | token | Single-use secure password reset, session revocation. |
| `POST /auth/invitations/activate` | invitation token | Sets initial password for an invited account. |

### Domain routes

| Route family | Policy / scope |
|---|---|
| `/system/configuration` | OWNER reads/updates; update requires step-up MFA and audit |
| `/groups`, `/groups/:id` | role permission plus explicit group grant |
| `/groups/:groupId/members` | Group Admin assignment / role-specific scope |
| `/members/me/*` | own member account only |
| `/members/:memberId/*` | own member or explicit granted group/staff access |
| `/savings`, `/cash-loans`, `/item-loans`, `/fines` | separate categories, role policy and server-computed constraints |
| `/reports/*`, `/files/:id/download` | report/file object authorization before generate/download |
| `/audit-logs`, `/security-alerts` | restricted by role and permitted scope |

Errors are generic safe responses (`401`, `403`, `404` as applicable) with correlation ID; implementation logs diagnostics server-side.

## WebSocket specification

- Endpoint: `wss://<host>/ws` after TLS termination; session authentication occurs at handshake with origin validation.
- Client can request only `conversation:join` with a conversation UUID. The server loads participants and group assignment and denies unauthorized rooms. Client never chooses effective sender.
- `message:send`: `{conversationId, clientMessageId, body}`. Server validates bounded body, derives `senderUserId`, authorizes participation, persists then broadcasts an event with server `messageId`, timestamp and delivery state.
- `message:read`: authorized participant only. Rate limits apply to connect, join and send.
- Events: `message:new`, `message:delivery`, `message:read`, `notification:new`; no broad group/user data broadcast.
- Disconnect revokes presence. Session revocation terminates linked socket connections.

## Audit event examples

`AUTH_LOGIN_FAILED`, `AUTH_ACCOUNT_PROTECTED`, `AUTH_SESSION_REVOKED`, `USER_INVITED`, `GROUP_CREATED`, `MEMBER_CREATED`, `SAVINGS_POSTED`, `CASH_LOAN_REQUESTED`, `CASH_LOAN_VERIFIED`, `LOAN_FINE_APPLIED`, `ITEM_LOAN_CLEARED`, `REPORT_EXPORTED`, `FILE_DOWNLOADED`, `SYSTEM_NAME_CHANGED`, `SECURITY_ALERT_CREATED`.
