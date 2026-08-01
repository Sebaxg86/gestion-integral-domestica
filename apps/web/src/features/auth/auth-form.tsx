"use client";

import { Button, Field, FieldLabel, FieldMessage, Input } from "@gid/ui";
import { Apple } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import {
  type AuthFormState,
  requestPasswordResetAction,
  resendVerificationAction,
  signInAction,
  signInWithOAuthAction,
  signUpAction,
  updatePasswordAction,
} from "./actions";

const initialState: AuthFormState = {};

export function OAuthErrorNotice({
  context,
}: {
  context: "acceso" | "registro";
}) {
  return (
    <p
      className="rounded-[var(--radius-md)] bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)]"
      role="alert"
    >
      No se completó el {context} con el proveedor. Puedes intentarlo nuevamente.
    </p>
  );
}

export function OAuthButtons({ returnTo }: { returnTo: "/login" | "/registro" }) {
  const [state, action, pending] = useActionState(
    signInWithOAuthAction,
    initialState,
  );

  return (
    <div className="grid gap-5">
      <form action={action} className="grid gap-3">
        <input name="returnTo" type="hidden" value={returnTo} />
        <Button
          disabled={pending}
          fullWidth
          name="provider"
          size="mobile"
          type="submit"
          value="google"
          variant="secondary"
        >
          <GoogleMark />
          Continuar con Google
        </Button>
        <Button
          disabled={pending}
          fullWidth
          name="provider"
          size="mobile"
          type="submit"
          value="apple"
          variant="secondary"
        >
          <Apple aria-hidden="true" className="size-5" strokeWidth={1.8} />
          Continuar con Apple
        </Button>
      </form>
      <AuthMessage state={state} />
      <div className="flex items-center gap-3" role="separator">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
          o continúa con correo
        </span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-5 place-items-center rounded-full border border-[var(--color-border-strong)] text-[12px] font-bold leading-none"
    >
      G
    </span>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initialState);
  return (
    <form action={action} className="grid gap-5">
      <AuthMessage state={state} />
      <EmailField errors={state.errors?.email} />
      <PasswordField
        errors={state.errors?.password}
        autoComplete="current-password"
      />
      <div className="text-right">
        <Link
          className="text-sm font-semibold text-[var(--color-brand-800)]"
          href="/recuperar-contrasena"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Entrando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initialState);
  return (
    <form action={action} className="grid gap-5">
      <AuthMessage state={state} />
      <Field>
        <FieldLabel htmlFor="fullName">Nombre</FieldLabel>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          invalid={Boolean(state.errors?.fullName)}
        />
        <FieldMessage error>{state.errors?.fullName?.[0]}</FieldMessage>
      </Field>
      <EmailField errors={state.errors?.email} />
      <PasswordField
        errors={state.errors?.password}
        autoComplete="new-password"
        showHint
      />
      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}

export function PasswordResetRequestForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );
  return (
    <form action={action} className="grid gap-5">
      <AuthMessage state={state} />
      <EmailField errors={state.errors?.email} />
      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(
    updatePasswordAction,
    initialState,
  );
  return (
    <form action={action} className="grid gap-5">
      <AuthMessage state={state} />
      <PasswordField
        errors={state.errors?.password}
        autoComplete="new-password"
        showHint
      />
      <Button disabled={pending} fullWidth size="mobile" type="submit">
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(
    resendVerificationAction,
    initialState,
  );
  return (
    <form action={action} className="grid gap-4">
      <AuthMessage state={state} />
      <EmailField errors={state.errors?.email} />
      <Button disabled={pending} fullWidth variant="secondary" type="submit">
        {pending ? "Enviando…" : "Reenviar verificación"}
      </Button>
    </form>
  );
}

function EmailField({ errors }: { errors?: string[] }) {
  return (
    <Field>
      <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        invalid={Boolean(errors)}
      />
      <FieldMessage error>{errors?.[0]}</FieldMessage>
    </Field>
  );
}

function PasswordField({
  errors,
  autoComplete,
  showHint,
}: {
  errors?: string[];
  autoComplete: string;
  showHint?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="password">Contraseña</FieldLabel>
      <Input
        id="password"
        name="password"
        type="password"
        autoComplete={autoComplete}
        invalid={Boolean(errors)}
      />
      <FieldMessage error={Boolean(errors)}>
        {errors?.[0] ??
          (showHint
            ? "12 caracteres, mayúscula, minúscula y número."
            : undefined)}
      </FieldMessage>
    </Field>
  );
}

function AuthMessage({ state }: { state: AuthFormState }) {
  if (!state.message) return null;
  return (
    <p
      className="rounded-[var(--radius-md)] bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)]"
      role="status"
    >
      {state.message}
    </p>
  );
}
