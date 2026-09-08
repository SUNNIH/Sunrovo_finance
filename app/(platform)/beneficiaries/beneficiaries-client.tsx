"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  Landmark,
  Plus,
  Search,
  Shield,
  Star,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { beneficiaryCreateSchema, type BeneficiaryCreateInput } from "@/lib/validation/banking";
import { postJson, patchJson, deleteJson, ApiRequestError } from "@/lib/utilities/api-client";
import { TextField } from "@/components/forms/text-field";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { maskAccountNumber } from "@/lib/utilities/format-account";
import { cn } from "@/lib/utilities/cn";

interface BeneficiaryView {
  id: string;
  type: "INTERNAL_PLT" | "EXTERNAL_BANK";
  nickname: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  isFavorite: boolean;
}

export function BeneficiariesClient({
  initialBeneficiaries,
}: {
  initialBeneficiaries: BeneficiaryView[];
}) {
  const [beneficiaries, setBeneficiaries] = React.useState(initialBeneficiaries);
  const [search, setSearch] = React.useState("");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BeneficiaryCreateInput>({
    resolver: zodResolver(beneficiaryCreateSchema),
    defaultValues: { type: "INTERNAL_PLT" },
  });
  const currentType = watch("type");

  const filtered = beneficiaries.filter((b) =>
    `${b.nickname} ${b.accountName} ${b.accountNumber} ${b.bankName ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  async function onAdd(values: BeneficiaryCreateInput) {
    setFormError(null);
    try {
      const result = await postJson<{ beneficiary: BeneficiaryView }>("/api/beneficiaries", values);
      setBeneficiaries((prev) => [result.beneficiary, ...prev]);
      setShowAddForm(false);
      reset({ type: "INTERNAL_PLT" });
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
    }
  }

  async function toggleFavorite(beneficiary: BeneficiaryView) {
    const next = !beneficiary.isFavorite;
    setBeneficiaries((prev) => prev.map((b) => (b.id === beneficiary.id ? { ...b, isFavorite: next } : b)));
    try {
      await patchJson(`/api/beneficiaries/${beneficiary.id}`, { isFavorite: next });
    } catch {
      setBeneficiaries((prev) => prev.map((b) => (b.id === beneficiary.id ? { ...b, isFavorite: !next } : b)));
    }
  }

  async function confirmDelete(id: string) {
    const previous = beneficiaries;
    setBeneficiaries((prev) => prev.filter((b) => b.id !== id));
    setConfirmDeleteId(null);
    try {
      await deleteJson(`/api/beneficiaries/${id}`);
    } catch {
      setBeneficiaries(previous);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top Controls: Search Bar & Add Beneficiary Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="search"
            placeholder="Search by name, nickname, or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search beneficiaries"
            className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-9 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary p-0.5"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Button
          onClick={() => {
            setShowAddForm((prev) => !prev);
            setFormError(null);
          }}
          variant="primary"
          size="md"
          className="gap-2 font-medium shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Add Beneficiary</span>
        </Button>
      </div>

      {/* ──────────────── ADD BENEFICIARY CARD / FORM ──────────────── */}
      {showAddForm && (
        <Card className="overflow-hidden rounded-2xl border-border bg-surface-elevated shadow-md animate-fade-in">
          <CardContent className="p-5 sm:p-7">
            <div className="mb-6 flex items-start justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary shadow-xs">
                  <UserPlus className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-text-primary">
                    Add Authorized Beneficiary
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Save a verified recipient for faster transfers. Protected by password authorization.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                aria-label="Close form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onAdd)} noValidate className="flex flex-col gap-4">
              {/* Type Selection Tabs */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Recipient Type
                </span>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {[
                    {
                      value: "INTERNAL_PLT" as const,
                      label: "PLT Account",
                      desc: "Instant internal ledger transfer",
                      icon: Landmark,
                    },
                    {
                      value: "EXTERNAL_BANK" as const,
                      label: "External Bank",
                      desc: "Third-party commercial bank transfer",
                      icon: Building2,
                    },
                  ].map((item) => {
                    const isSelected = currentType === item.value;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setValue("type", item.value)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                          isSelected
                            ? "border-primary bg-primary-soft/30 ring-1 ring-primary/30 shadow-xs"
                            : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover/60"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface-hover text-text-secondary"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                          <p className="text-xs text-text-secondary">{item.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label="Nickname"
                  placeholder="e.g. Alex Rivera or Main Savings"
                  error={errors.nickname?.message}
                  {...register("nickname")}
                />
                <TextField
                  label="Account Holder Full Name"
                  placeholder="e.g. Alexandra Rivera"
                  error={errors.accountName?.message}
                  {...register("accountName")}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label={currentType === "INTERNAL_PLT" ? "PLT Account Number" : "Account Number / IBAN"}
                  placeholder={currentType === "INTERNAL_PLT" ? "e.g. 1000000001" : "e.g. 9876543210"}
                  error={errors.accountNumber?.message}
                  className="font-mono financial-value"
                  {...register("accountNumber")}
                />
                {currentType === "EXTERNAL_BANK" && (
                  <TextField
                    label="Bank Name"
                    placeholder="e.g. JPMorgan Chase"
                    error={errors.bankName?.message}
                    {...register("bankName")}
                  />
                )}
              </div>

              {/* Password Authorization Field */}
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-text-primary">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>Security Authorization</span>
                </div>
                <PasswordField
                  label="Confirm Your Password"
                  autoComplete="current-password"
                  placeholder="Enter your account password"
                  hint="Password confirmation is required to save new financial beneficiaries."
                  error={errors.currentPassword?.message}
                  {...register("currentPassword")}
                />
              </div>

              {/* Form Level Error Message */}
              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-xs font-medium text-danger animate-fade-in"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form Action Controls */}
              <div className="mt-2 flex items-center justify-end gap-2.5 border-t border-border/60 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  className="gap-2 font-medium"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Verifying &amp; Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Save Beneficiary</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ──────────────── BENEFICIARIES LIST & EMPTY STATES ──────────────── */}
      {filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border bg-surface-elevated/50 p-8 sm:p-12 text-center">
          <CardContent className="flex flex-col items-center justify-center p-0">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-xs">
              <UserRound className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">
              {beneficiaries.length === 0 ? "No Beneficiaries Saved" : "No Matching Beneficiaries"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-text-secondary">
              {beneficiaries.length === 0
                ? "Add trusted PLT or external bank accounts to transfer money quickly without typing numbers every time."
                : `No saved recipients match "${search}". Try searching with a different name or account number.`}
            </p>
            {beneficiaries.length === 0 ? (
              <Button
                variant="primary"
                size="md"
                className="mt-5 gap-2 font-medium"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4" />
                <span>Add Your First Beneficiary</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setSearch("")}
              >
                Clear Search Filter
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {filtered.map((b) => (
            <Card
              key={b.id}
              className={cn(
                "group relative flex flex-col justify-between rounded-xl border bg-surface-elevated p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                b.isFavorite
                  ? "border-primary/40 ring-1 ring-primary/20 hover:border-primary/60"
                  : "border-border hover:border-border-strong"
              )}
            >
              <div>
                {/* Beneficiary Header: Avatar + Nickname + Type Badge + Actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                        b.type === "INTERNAL_PLT"
                          ? "bg-primary-soft text-primary"
                          : "bg-surface-hover text-text-secondary"
                      )}
                    >
                      {b.type === "INTERNAL_PLT" ? (
                        <Landmark className="h-5 w-5" />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold tracking-tight text-text-primary">
                          {b.nickname}
                        </h3>
                        <Badge
                          variant={b.type === "INTERNAL_PLT" ? "primary" : "neutral"}
                          className="shrink-0 text-[10px] px-1.5 py-0"
                        >
                          {b.type === "INTERNAL_PLT" ? "PLT" : "External"}
                        </Badge>
                      </div>
                      <p className="truncate text-xs font-medium text-text-secondary mt-0.5">
                        {b.accountName}
                      </p>
                    </div>
                  </div>

                  {/* Favorite & Delete Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(b)}
                      aria-pressed={b.isFavorite}
                      aria-label={b.isFavorite ? "Remove from favorites" : "Mark as favorite"}
                      title={b.isFavorite ? "Remove from favorites" : "Mark as favorite"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-warning"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4 transition-transform active:scale-125",
                          b.isFavorite
                            ? "fill-warning text-warning"
                            : "text-text-tertiary hover:text-warning"
                        )}
                      />
                    </button>

                    {confirmDeleteId === b.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="danger"
                          className="h-8 px-2.5 text-xs font-medium"
                          onClick={() => void confirmDelete(b.id)}
                        >
                          Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(b.id)}
                        aria-label={`Delete ${b.nickname}`}
                        title={`Delete ${b.nickname}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Account Details Box */}
                <div className="mt-3.5 rounded-lg border border-border/80 bg-surface/60 p-2.5 text-xs">
                  <div className="flex items-center justify-between font-mono financial-value">
                    <span className="text-text-primary font-medium tracking-wide">
                      {maskAccountNumber(b.accountNumber)}
                    </span>
                    {b.bankName && (
                      <span className="text-text-tertiary truncate max-w-[140px]">
                        {b.bankName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action: Transfer */}
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[11px] text-text-tertiary font-medium">
                  {b.type === "INTERNAL_PLT" ? "Instant Settlement" : "Standard Wire"}
                </span>
                <Link
                  href="/transfers"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                >
                  <span>Send Money</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
