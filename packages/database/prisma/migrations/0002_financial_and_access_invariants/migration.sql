-- Defense-in-depth invariants that are intentionally database-enforced. Review and
-- run these with the dedicated migration role after 0001_init.

CREATE OR REPLACE FUNCTION public.prevent_immutable_history_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Historical financial and audit records are immutable; use a compensating entry.'
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER financial_ledger_append_only
  BEFORE UPDATE OR DELETE ON "FinancialLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_history_change();

CREATE TRIGGER savings_transaction_append_only
  BEFORE UPDATE OR DELETE ON "SavingsTransaction"
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_history_change();

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION public.prevent_immutable_history_change();

CREATE OR REPLACE FUNCTION public.enforce_group_member_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_member_count integer;
  configured_capacity integer;
BEGIN
  -- Serializes capacity checks for a group across concurrent member registration.
  PERFORM 1 FROM "Group" WHERE id = NEW."groupId" FOR UPDATE;
  SELECT "maxActiveMembersPerGroup" INTO configured_capacity
  FROM "SystemConfiguration" WHERE id = 'global';
  IF configured_capacity IS NULL THEN
    RAISE EXCEPTION 'System configuration is unavailable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.status = 'ACTIVE' THEN
    SELECT COUNT(*) INTO current_member_count
    FROM "GroupMembership"
    WHERE "groupId" = NEW."groupId"
      AND status = 'ACTIVE'
      AND id IS DISTINCT FROM NEW.id;
    IF current_member_count >= configured_capacity THEN
      RAISE EXCEPTION 'Group has reached its active member capacity of %', configured_capacity
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER group_member_capacity
  BEFORE INSERT OR UPDATE OF status, "groupId" ON "GroupMembership"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_member_capacity();

CREATE OR REPLACE FUNCTION public.enforce_group_operational_threshold()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_member_count integer;
  configured_capacity integer;
BEGIN
  IF NEW.status IN ('READY', 'ACTIVE') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM 1 FROM "SystemConfiguration" WHERE id = 'global' FOR SHARE;
    SELECT "maxActiveMembersPerGroup" INTO configured_capacity FROM "SystemConfiguration" WHERE id = 'global';
    SELECT COUNT(*) INTO current_member_count FROM "GroupMembership"
      WHERE "groupId" = NEW.id AND status = 'ACTIVE';
    IF current_member_count <> configured_capacity THEN
      RAISE EXCEPTION 'Group not full: %/% active members', current_member_count, configured_capacity
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER group_operational_threshold
  BEFORE UPDATE OF status ON "Group"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_operational_threshold();

CREATE OR REPLACE FUNCTION public.enforce_privileged_role_cardinality()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  role_code text;
  active_role_count integer;
  allowed_count integer;
BEGIN
  SELECT code INTO role_code FROM "Role" WHERE id = NEW."roleId";
  IF role_code = 'OWNER' THEN allowed_count := 1;
  ELSIF role_code IN ('SUPER_ADMIN', 'ADMIN') THEN allowed_count := 2;
  ELSE RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO active_role_count
  FROM "UserRole" ur
  JOIN "User" u ON u.id = ur."userId"
  JOIN "Role" r ON r.id = ur."roleId"
  WHERE r.code = role_code
    AND u.status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'LOCKED');

  IF active_role_count > allowed_count THEN
    RAISE EXCEPTION 'The maximum number of % accounts is %', role_code, allowed_count
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER privileged_role_cardinality
  AFTER INSERT OR UPDATE OF "roleId" ON "UserRole"
  FOR EACH ROW EXECUTE FUNCTION public.enforce_privileged_role_cardinality();

ALTER TABLE "RegistrationFee" ADD CONSTRAINT registration_fee_amount_positive CHECK ("amountKes" > 0);
ALTER TABLE "SavingsTransaction" ADD CONSTRAINT savings_transaction_amount_positive CHECK ("amountKes" > 0);
ALTER TABLE "CashLoan" ADD CONSTRAINT cash_loan_amount_nonnegative CHECK ("principalKes" > 0 AND "outstandingKes" >= 0);
ALTER TABLE "CashLoanPayment" ADD CONSTRAINT cash_loan_payment_amount_positive CHECK ("amountKes" > 0);
ALTER TABLE "LoanFine" ADD CONSTRAINT loan_fine_amount_positive CHECK ("amountKes" > 0);
ALTER TABLE "Item" ADD CONSTRAINT item_price_positive CHECK ("priceKes" > 0 AND "availableUntil" >= "availableFrom");
ALTER TABLE "ItemLoan" ADD CONSTRAINT item_loan_amount_nonnegative CHECK ("priceKes" > 0 AND "outstandingKes" >= 0);
ALTER TABLE "ItemLoanPayment" ADD CONSTRAINT item_loan_payment_amount_positive CHECK ("amountKes" > 0);
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT ledger_amount_positive CHECK ("amountKes" > 0);

-- Application, migration, report and audit database roles must be created by the
-- deployment/IaC layer. The application role receives only table privileges it
-- needs; revoke UPDATE/DELETE on immutable tables even though triggers exist.
