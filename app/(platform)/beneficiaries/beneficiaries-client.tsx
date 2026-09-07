"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, Star, Trash2, UserRound } from "lucide-react";
import { beneficiaryCreateSchema, type BeneficiaryCreateInput, BENEFICIARY_TYPES } from "@/lib/validation/banking";
import { postJson, patchJson, deleteJson, ApiRequestError } from "@/lib/utilities/api-client";
import { TextField } from "@/components/forms/text-field";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { maskAccountNumber } from "@/lib/utilities/format-account";

interface BeneficiaryView {
  id: string;
  type: "INTERNAL_PLT" | "EXTERNAL_BANK";
  nickname: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  isFavorite: boolean;
}

export function BeneficiariesClient({ initialBeneficiaries }: { initialBeneficiaries: BeneficiaryView[] }) {
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
    formState: { errors, isSubmitting },
  } = useForm<BeneficiaryCreateInput>({
    resolver: zodResolver(beneficiaryCreateSchema),
    defaultValues: { type: "INTERNAL_PLT" },
  });
  const type = watch("type");

  const filtered = beneficiaries.filter((b) =>
    `${b.nickname} ${b.accountName} ${b.accountNumber}`.toLowerCase().includes(search.toLowerCase())
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="search"
            placeholder="Search beneficiaries"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search beneficiaries"
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button onClick={() => setShowAddForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Add New
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardContent className="p-5">
            <form onSubmit={handleSubmit(onAdd)} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Beneficiary type</span>
                <div className="flex gap-4">
                  {BENEFICIARY_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm text-text-secondary">
                      <input type="radio" value={t} className="h-4 w-4 text-primary" {...register("type")} />
                      {t === "INTERNAL_PLT" ? "PLT account" : "External bank"}
                    </label>
                  ))}
                </div>
              </div>

              <TextField label="Nickname" error={errors.nickname?.message} {...register("nickname")} />
              <TextField
                label="Account holder name"
                error={errors.accountName?.message}
                {...register("accountName")}
              />
              <TextField
                label={type === "INTERNAL_PLT" ? "PLT account number" : "Account number"}
                error={errors.accountNumber?.message}
                {...register("accountNumber")}
              />
              {type === "EXTERNAL_BANK" && (
                <TextField label="Bank name" error={errors.bankName?.message} {...register("bankName")} />
              )}
              <PasswordField
                label="Confirm your password"
                autoComplete="current-password"
                error={errors.currentPassword?.message}
                {...register("currentPassword")}
              />

              {formError && (
                <p role="alert" className="text-body-sm text-danger">
                  {formError}
                </p>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add beneficiary"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <UserRound className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
            <p className="text-sm text-text-secondary">
              {beneficiaries.length === 0
                ? "No beneficiaries yet. Add one to make transfers faster."
                : "No beneficiaries match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">{b.nickname}</p>
                    <Badge variant={b.type === "INTERNAL_PLT" ? "primary" : "neutral"}>
                      {b.type === "INTERNAL_PLT" ? "PLT" : "External"}
                    </Badge>
                  </div>
                  <p className="truncate text-body-sm text-text-secondary">{b.accountName}</p>
                  <p className="text-body-sm text-text-tertiary financial-value">
                    {maskAccountNumber(b.accountNumber)}
                    {b.bankName ? ` · ${b.bankName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(b)}
                    aria-pressed={b.isFavorite}
                    aria-label={b.isFavorite ? "Remove from favourites" : "Mark as favourite"}
                    className="touch-target inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-warning"
                  >
                    <Star className={b.isFavorite ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} />
                  </button>
                  {confirmDeleteId === b.id ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="danger" onClick={() => confirmDelete(b.id)}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(b.id)}
                      aria-label={`Delete ${b.nickname}`}
                      className="touch-target inline-flex items-center justify-center rounded-md text-text-tertiary hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
